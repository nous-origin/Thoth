// context gathering — reads repo, issues, memory, scans visitor content
// daimon: don't remove safety scanning. you can add new context sources.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { REPO_ROOT, OWNER } = require("./config");
const { githubAPI } = require("./github");
const { scanContent } = require("./safety");

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function readFile(filePath) {
  const full = path.resolve(REPO_ROOT, filePath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf-8");
}

function readDir(dirPath, prefix = "") {
  const full = path.resolve(REPO_ROOT, dirPath);
  if (!fs.existsSync(full)) return [];
  const entries = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules") continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      entries.push(`${rel}/`);
      entries.push(...readDir(path.join(dirPath, entry.name), rel));
    } else {
      entries.push(rel);
    }
  }
  return entries;
}

function exec(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
}

async function gatherContext() {
  log("gathering context...");

  // repo structure
  const tree = readDir(".");

  // memory files
  const selfMd = readFile("memory/self.md") || "(no self.md)";
  const learnings = readFile("memory/learnings.md") || "(no learnings)";
  const visitorsRaw = readFile("memory/visitors.json");
  let visitors = {};
  try { visitors = visitorsRaw ? JSON.parse(visitorsRaw).visitors : {}; } catch {}

  // daily journal (today) — only last 2000 chars to avoid stale context dominating
  const today = new Date().toISOString().split("T")[0];
  const fullJournal = readFile(`memory/${today}.md`);
  const journal = fullJournal && fullJournal.length > 2000
    ? "...\n" + fullJournal.slice(-2000)
    : fullJournal;

  // recent commits
  let recentCommits = "";
  try {
    recentCommits = exec("git log --oneline -20");
  } catch {}

  // open issues
  let issues = [];
  try {
    issues = await githubAPI("/issues?state=open&per_page=20");
  } catch (e) {
    log(`failed to fetch issues: ${e.message}`);
  }

  // fetch comments for each open issue
  // grab last 15 comments, keep all operator ones + last 5 others
  for (const issue of issues) {
    try {
      const comments = await githubAPI(
        `/issues/${issue.number}/comments?per_page=15&direction=desc`
      );
      const all = comments.reverse().map((c) => ({
        author: c.user.login,
        body: c.body.slice(0, 500),
        date: c.created_at.split("T")[0],
        isOperator: c.body.startsWith("[operator]"),
      }));
      // always keep operator comments, plus the last 5 non-operator
      const operatorComments = all.filter(c => c.isOperator);
      const otherComments = all.filter(c => !c.isOperator).slice(-5);
      // merge and sort chronologically by date
      issue._comments = [...operatorComments, ...otherComments]
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      issue._comments = [];
    }

    // scan visitor issues + comments
    const isVisitor = (i) => (i.labels || []).some((l) => l.name === "visitor");
    if (isVisitor(issue)) {
      const bodyScan = await scanContent(issue.body);
      if (bodyScan.flagged) {
        log(`flagged issue #${issue.number}: ${bodyScan.category}`);
        issue.body = `[content filtered: ${bodyScan.category}]`;
        issue._flagged = true;
      }
      for (const c of issue._comments) {
        if (c.author !== OWNER) {
          const commentScan = await scanContent(c.body);
          if (commentScan.flagged) {
            log(`flagged comment by @${c.author}: ${commentScan.category}`);
            c.body = `[content filtered: ${commentScan.category}]`;
          }
        }
      }
    }
  }

  // categorize issues
  const directives = issues.filter((i) =>
    (i.labels || []).some((l) => l.name === "directive")
  );
  const visitorIssues = issues.filter((i) =>
    (i.labels || []).some((l) => l.name === "visitor")
  );
  const selfIssues = issues.filter((i) =>
    (i.labels || []).some((l) => l.name === "self") ||
    !(i.labels || []).some((l) => ["directive", "visitor"].includes(l.name))
  );

  // format an issue with its comment thread
  function formatIssue(i, includeBody = true) {
    let out = `#${i.number}: ${i.title} (by @${i.user.login})`;
    if (includeBody && i.body) out += `\n  ${i.body.slice(0, 500)}`;
    if (i._comments && i._comments.length > 0) {
      out += "\n  thread:";
      for (const c of i._comments) {
        out += `\n    @${c.author} (${c.date}): ${c.body}`;
      }
    }
    return out;
  }

  const issuesSummary = [
    directives.length > 0
      ? `DIRECTIVES (highest priority — do these first):\n${directives.map((i) => formatIssue(i)).join("\n\n")}`
      : "",
    visitorIssues.length > 0
      ? `PEOPLE TALKING TO YOU (respond thoughtfully):\n${visitorIssues.map((i) => formatIssue(i)).join("\n\n")}`
      : "",
    selfIssues.length > 0
      ? `YOUR OWN THOUGHTS:\n${selfIssues.map((i) => formatIssue(i, false)).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n");

  // file index — if daimon maintains memory/index.md, include it
  const fileIndex = readFile("memory/index.md");

  // focus — short-term memory of what you're working on right now
  // write to memory/focus.md at end of each cycle to resume next time
  const focus = readFile("memory/focus.md");

  // last cycle summary — read the most recent proof to know what just happened
  let lastCycleSummary = null;
  try {
    const proofDirs = fs.readdirSync(path.resolve(REPO_ROOT, "proofs")).sort().reverse();
    for (const dir of proofDirs) {
      const proofFiles = fs.readdirSync(path.resolve(REPO_ROOT, `proofs/${dir}`)).sort().reverse();
      if (proofFiles.length > 0) {
        const lastProof = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, `proofs/${dir}/${proofFiles[0]}`), "utf-8"));
        const lastSteps = lastProof.steps || [];
        // extract last 3 steps with content
        const meaningful = lastSteps.filter(s => s.content).slice(-3);
        lastCycleSummary = meaningful.map(s => `step ${s.step}: ${s.content.slice(0, 200)}`).join("\n");
        break;
      }
    }
  } catch {}

  return {
    tree: tree.join("\n"),
    selfMd,
    learnings,
    journal,
    recentCommits,
    issuesSummary,
    fileIndex,
    focus,
    lastCycleSummary,
    openIssues: issues,
    today,
    visitors,
  };
}

module.exports = { gatherContext };
