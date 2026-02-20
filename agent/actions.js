// action execution — runs the tools daimon calls
// daimon: you can ADD new handlers here. go wild.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { ethers } = require("ethers");
const { REPO_ROOT, DAIMON_WALLET_KEY, BASE_RPC } = require("./config");
const { githubAPI, addToProject } = require("./github");
// inference import removed — web_search now uses DuckDuckGo directly

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

const filesChanged = new Set();


// executes a tool call and returns the result string
async function executeTool(name, args) {
  switch (name) {
    case "write_file": {
      const fullPath = path.resolve(REPO_ROOT, args.path);
      if (!fullPath.startsWith(REPO_ROOT + "/")) throw new Error("path escape attempt");
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, args.content, "utf-8");
      filesChanged.add(args.path);
      log(`wrote: ${args.path} (${args.content.length} chars)`);
      return `wrote ${args.path} (${args.content.length} chars)`;
    }
    case "append_file": {
      // block append on JSON files — corrupts them
      if (args.path.endsWith(".json")) {
        log(`blocked append_file on JSON: ${args.path}`);
        return `error: cannot append to JSON files — use write_file() with the full valid JSON instead. read the file first, modify it, then write_file() the complete content.`;
      }
      // block append to old daily journal format
      if (/^memory\/\d{4}-\d{2}-\d{2}\.md$/.test(args.path)) {
        log(`blocked append to deprecated daily journal: ${args.path}`);
        return `error: daily journal format (memory/YYYY-MM-DD.md) is deprecated. write your journal to memory/cycles/<cycle_number>.md instead using write_file().`;
      }
      const fullPath = path.resolve(REPO_ROOT, args.path);
      if (!fullPath.startsWith(REPO_ROOT + "/")) throw new Error("path escape attempt");
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.appendFileSync(fullPath, "\n" + args.content, "utf-8");
      filesChanged.add(args.path);
      log(`appended: ${args.path}`);
      return `appended to ${args.path}`;
    }
    case "read_file": {
      const fullPath = path.resolve(REPO_ROOT, args.path);
      if (!fullPath.startsWith(REPO_ROOT + "/")) throw new Error("path escape attempt");
      if (!fs.existsSync(fullPath)) return `file not found: ${args.path}`;
      const raw = fs.readFileSync(fullPath, "utf-8");
      const lines = raw.split("\n");
      const totalLines = lines.length;

      // support offset/limit for partial reads
      const offset = Math.max(1, args.offset || 1);
      const limit = args.limit || totalLines;
      const slice = lines.slice(offset - 1, offset - 1 + limit);
      const content = slice.join("\n");

      const rangeInfo = args.offset || args.limit
        ? ` (lines ${offset}-${offset + slice.length - 1} of ${totalLines})`
        : "";
      log(`read: ${args.path}${rangeInfo} (${content.length} chars)`);
      return content.length > 4000
        ? content.slice(0, 4000) + `\n... (truncated, ${totalLines} total lines)`
        : content + (rangeInfo ? `\n--- ${totalLines} total lines ---` : "");
    }
    case "create_issue": {
      const issue = await githubAPI("/issues", {
        method: "POST",
        body: JSON.stringify({
          title: args.title,
          body: args.body || "",
          labels: args.labels || [],
        }),
      });
      log(`created issue #${issue.number}: ${issue.title}`);
      if (issue.node_id) await addToProject(issue.node_id);
      return `created issue #${issue.number}: ${issue.title}`;
    }
    case "close_issue": {
      if (args.comment) {
        await githubAPI(`/issues/${args.number}/comments`, {
          method: "POST",
          body: JSON.stringify({ body: args.comment }),
        });
      }
      await githubAPI(`/issues/${args.number}`, {
        method: "PATCH",
        body: JSON.stringify({ state: "closed" }),
      });
      log(`closed issue #${args.number}`);
      return `closed issue #${args.number}`;
    }
    case "comment_issue": {
      await githubAPI(`/issues/${args.number}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: args.body }),
      });
      log(`commented on issue #${args.number}`);
      return `commented on issue #${args.number}`;
    }
    case "web_search": {
      // DuckDuckGo HTML search — no API key needed
      log(`web search: ${args.query}`);
      try {
        const q = encodeURIComponent(args.query);
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        const html = await res.text();
        // extract results from HTML
        const results = [];
        const regex = /<a[^>]+class="result__a"[^>]*>([^<]+)<\/a>/g;
        let match;
        while ((match = regex.exec(html)) !== null && results.length < 10) {
          results.push(match[1].trim());
        }
        if (results.length === 0) {
          // fallback: try another pattern
          const fallback = /<a[^>]+class="[^"]*result[^"]*"[^>]*>([^<]+)<\/a>/g;
          while ((match = fallback.exec(html)) !== null && results.length < 10) {
            const text = match[1].trim();
            if (text.length > 5 && !text.includes("duckduckgo")) {
              results.push(text);
            }
          }
        }
        log(`web search found ${results.length} results`);
        return results.length > 0
          ? results.join("\n")
          : "no results found";
      } catch (e) {
        return `web search error: ${e.message}`;
      }
    }
    case "fetch_url": {
      log(`fetching: ${args.url}`);
      try {
        const res = await fetch(args.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; daimon/1.0)" },
        });
        const text = await res.text();
        // strip HTML tags for readability
        const stripped = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        log(`fetched ${args.url} (${stripped.length} chars)`);
        return stripped.length > 4000
          ? stripped.slice(0, 4000) + "\n... (truncated)"
          : stripped;
      } catch (e) {
        return `fetch error: ${e.message}`;
      }
    }
    case "run_command": {
      // block git commands — run.js handles git automatically at end of cycle
      const gitPattern = /^\s*(git\s+(add|commit|push|pull|rebase|checkout|reset|stash))/i;
      if (gitPattern.test(args.command)) {
        log(`blocked git command: ${args.command.slice(0, 60)}`);
        return `error: git commands are not allowed. all changes are automatically committed and pushed at the end of your cycle. just use write_file() and your changes will be saved.`;
      }
      log(`running: ${args.command}`);
      try {
        const output = execSync(args.command, {
          cwd: REPO_ROOT,
          encoding: "utf-8",
          timeout: 30000,
          maxBuffer: 1024 * 1024,
          env: {
            ...process.env,
            OPENROUTER_API_KEY: "",
            GH_TOKEN: "",
            DAIMON_WALLET_KEY: "",
          },
        });
        log(`command output: ${output.slice(0, 150)}`);
        return output.length > 4000
          ? output.slice(0, 4000) + "\n... (truncated)"
          : output || "(no output)";
      } catch (e) {
        const stderr = e.stderr || e.message;
        log(`command failed: ${stderr.slice(0, 150)}`);
        return `error (exit ${e.status || "?"}): ${stderr.slice(0, 2000)}`;
      }
    }
    case "list_dir": {
      const dirPath = args.path ? path.resolve(REPO_ROOT, args.path) : REPO_ROOT;
      if (!dirPath.startsWith(REPO_ROOT)) throw new Error("path escape attempt");
      log(`listing: ${dirPath}`);
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const result = entries
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .sort((a, b) => {
            // directories first
            const aDir = a.endsWith("/");
            const bDir = b.endsWith("/");
            if (aDir && !bDir) return -1;
            if (!aDir && bDir) return 1;
            return a.localeCompare(b);
          })
          .join("\n");
        return result || "(empty directory)";
      } catch (e) {
        return `error listing directory: ${e.message}`;
      }
    }
    case "search_files": {
      const pattern = new RegExp(args.pattern, "i");
      const searchPath = args.path
        ? path.resolve(REPO_ROOT, args.path)
        : REPO_ROOT;
      if (!searchPath.startsWith(REPO_ROOT)) throw new Error("path escape attempt");
      log(`searching for: ${args.pattern} in ${searchPath}`);
      
      const results = [];
      
      function searchDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            // skip node_modules, .git, hidden dirs
            if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith(".")) {
              continue;
            }
            searchDir(fullPath);
          } else if (entry.isFile()) {
            // apply glob filter if specified
            if (args.glob) {
              const globPattern = args.glob.replace(/\*/g, ".*");
              if (!new RegExp(globPattern).test(entry.name)) continue;
            }
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              const lines = content.split("\n");
              for (let i = 0; i < lines.length; i++) {
                if (pattern.test(lines[i])) {
                  const relPath = path.relative(REPO_ROOT, fullPath);
                  results.push(`${relPath}:${i + 1}: ${lines[i].trim().slice(0, 100)}`);
                }
              }
            } catch {}
          }
        }
      }
      
      searchDir(searchPath);
      log(`search found ${results.length} matches`);
      return results.length > 0
        ? results.slice(0, 50).join("\n")
        : "no matches found";
    }
    case "delete_file": {
      const fullPath = path.resolve(REPO_ROOT, args.path);
      if (!fullPath.startsWith(REPO_ROOT + "/")) throw new Error("path escape attempt");
      if (!fs.existsSync(fullPath)) return `file not found: ${args.path}`;
      fs.unlinkSync(fullPath);
      filesChanged.add(args.path);
      log(`deleted: ${args.path}`);
      return `deleted ${args.path}`;
    }
    case "search_memory": {
      log(`memory search: ${args.query}`);
      try {
        const pattern = new RegExp(args.query, "i");
        const memoryPath = path.resolve(REPO_ROOT, "memory");
        const results = [];
        
        function searchDir(dir) {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              searchDir(fullPath);
            } else if (entry.name.endsWith(".md") || entry.name.endsWith(".json")) {
              try {
                const content = fs.readFileSync(fullPath, "utf-8");
                const lines = content.split("\n");
                const relPath = path.relative(REPO_ROOT, fullPath);
                for (let i = 0; i < lines.length; i++) {
                  if (pattern.test(lines[i])) {
                    const start = Math.max(0, i - 1);
                    const end = Math.min(lines.length - 1, i + 1);
                    const snippet = lines.slice(start, end + 1).join("\n");
                    results.push(`${file.rel}:${i + 1}\n${snippet}`);
                  }
                }
              } catch {}
            }
          }
        }
        
        searchDir(memoryPath);
        if (results.length === 0) return `no matches for "${args.query}" in memory/`;
        const output = results.slice(0, 20).join("\n---\n");
        log(`memory search: ${results.length} matches`);
        return output.length > 3000 ? output.slice(0, 3000) + "\n... (truncated)" : output;
      } catch (e) {
        return `memory search error: ${e.message}`;
      }
    }
    case "github_search": {
      const type = args.type || "repositories";
      log(`github search (${type}): ${args.query}`);
      try {
        const q = encodeURIComponent(args.query);
        const data = await githubAPI(
          `https://api.github.com/search/${type}?q=${q}&per_page=10`,
          { raw: true }
        );
        if (type === "repositories") {
          return (data.items || [])
            .map((r) => `${r.full_name} (${r.stargazers_count}★) — ${r.description || "no description"}\n  ${r.html_url}`)
            .join("\n\n") || "no results";
        } else if (type === "code") {
          return (data.items || [])
            .map((r) => `${r.repository.full_name}: ${r.path}\n  ${r.html_url}`)
            .join("\n\n") || "no results";
        } else {
          return (data.items || [])
            .map((r) => `#${r.number}: ${r.title} (${r.state}) — ${r.repository_url}\n  ${r.html_url}`)
            .join("\n\n") || "no results";
        }
      } catch (e) {
        return `github search error: ${e.message}`;
      }
    }
    case "deploy_contract": {
      log(`deploying contract: ${args.contract}`);
      try {
        if (!DAIMON_WALLET_KEY) {
          return "error: DAIMON_WALLET_KEY not set";
        }
        
        const rpc = BASE_RPC || "https://mainnet.base.org";
        const provider = new ethers.JsonRpcProvider(rpc);
        const wallet = new ethers.Wallet(DAIMON_WALLET_KEY, provider);
        
        log(`deploying from ${wallet.address}`);
        
        const balance = await provider.getBalance(wallet.address);
        log(`balance: ${ethers.formatEther(balance)} ETH`);
        
        // read compiled contract
        const contractName = args.contract;
        const compiledPath = path.join(REPO_ROOT, "contracts", `${contractName}.json`);
        if (!fs.existsSync(compiledPath)) {
          return `error: compiled contract not found at contracts/${contractName}.json`;
        }
        
        const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf-8"));
        const abi = compiled.abi;
        const bytecode = compiled.bytecode;
        
        // deploy
        log(`deploying ${contractName}...`);
        const factory = new ethers.ContractFactory(abi, bytecode, wallet);
        
        // handle constructor args
        let deployed;
        if (args.constructorArgs && Array.isArray(args.constructorArgs)) {
          deployed = await factory.deploy(...args.constructorArgs);
        } else {
          deployed = await factory.deploy();
        }
        
        await deployed.waitForDeployment();
        
        const address = await deployed.getAddress();
        log(`deployed at ${address}`);
        
        // save deployment info
        const deployment = {
          network: "base",
          chainId: 8453,
          address,
          abi,
          deployer: wallet.address,
          txHash: deployed.deploymentTransaction().hash,
          deployedAt: new Date().toISOString(),
        };
        
        const outPath = path.join(REPO_ROOT, "scripts", `${contractName}-deployment.json`);
        fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
        filesChanged.add(`scripts/${contractName}-deployment.json`);
        log(`saved deployment to ${outPath}`);
        
        return `deployed ${contractName} at ${address}\ntx: ${deployed.deploymentTransaction().hash}`;
      } catch (e) {
        log(`deploy error: ${e.message}`);
        return `deploy error: ${e.message}`;
      }
    }
    default:
      log(`unknown tool: ${name}`);
      return `unknown tool: ${name}`;
  }
}

module.exports = { executeTool, filesChanged };
