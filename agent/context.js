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

function exec(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
}

// slim tree — top-level dirs + key files only, skip noise
function slimTree() {
  const full = path.resolve(REPO_ROOT);
  if (!fs.existsSync(full)) return "";
  const lines = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (entry.isDirectory()) {
      const subDir = path.join(full, entry.name);
      const children = fs.readdirSync(subDir).filter(f => !f.startsWith(".")).slice(0, 10);
      lines.push(`${entry.name}/ (${children.join(", ")}${children.length >= 10 ? ", ..." : ""})`);
    } else {
      lines.push(entry.name);
    }
  }
  return lines.join("\n");
}

async function gatherContext() {
  log("gathering context...");

  // repo structure — slim, not full recursive
  const tree = slimTree();

  // memory files
  const selfMd = readFile("memory/self.md") || "(no self.md)";

  // learnings — only last 1500 chars (most recent learnings matter most)
  const fullLearnings = readFile("memory/learnings.md") || "(no learnings)";
  const learnings = fullLearnings.length > 1500
    ? "...\n" + fullLearnings.slice(-1500)
    : fullLearnings;

  // visitors — just names and one-line summaries, not full paragraphs
  const visitorsRaw = readFile("memory/visitors.json");
  let visitors = {};
  try { visitors = visitorsRaw ? JSON.parse(visitorsRaw).visitors : {}; } catch {}

  const today = new Date().toISOString().split("T")[0];

  // per-cycle journals — load last 2 cycle files for recent context
  let journal = null;
  try {
    const cyclesDir = path.resolve(REPO_ROOT, "memory/cycles");
    if (fs.existsSync(cyclesDir)) {
      const cycleFiles = fs.readdirSync(cyclesDir)
        .filter(f => f.endsWith(".md"))
        .map(f => ({ name: f, num: parseInt(f.replace(".md", ""), 10) }))
        .filter(f => !isNaN(f.num))
        .sort((a, b) => b.num - a.num)
        .slice(0, 2);
      if (cycleFiles.length > 0) {
        journal = cycleFiles.map(f => {
          const content = readFile(`memory/cycles/${f.name}`);
          return content ? `## cycle #${f.num}\n${content.slice(0, 1500)}` : null;
        }).filter(Boolean).join("\n\n");
      }
    }
  } catch {}
  // fallback: try old daily journal format
  if (!journal) {
    const fullJournal = readFile(`memory/${today}.md`);
    journal = fullJournal && fullJournal.length > 1500
      ? "...\n" + fullJournal.slice(-1500)
      : fullJournal;
  }

  // recent commits — last 10 not 20
  let recentCommits = "";
  try {
    recentCommits = exec("git log --oneline -10");
  } catch {}

  // open issues
  let issues = [];
  try {
    issues = await githubAPI("/issues?state=open&per_page=20");
  } catch (e) {
    log(`failed to fetch issues: ${e.message}`);
  }

  // fetch comments — all operator comments + last 3 others (not 5)
  for (const issue of issues) {
    try {
      const comments = await githubAPI(
        `/issues/${issue.number}/comments?per_page=15&direction=desc`
      );
      const all = comments.reverse().map((c) => ({
        author: c.user.login,
        body: c.body.slice(0, 300),
        date: c.created_at.split("T")[0],
        isOperator: c.body.startsWith("[operator]"),
      }));
      // always keep operator comments, plus the last 3 non-operator
      const operatorComments = all.filter(c => c.isOperator);
      const otherComments = all.filter(c => !c.isOperator).slice(-3);
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

  // format issues — compact. operator comments get full body, others get truncated
  function formatIssue(i, includeBody = true) {
    let out = `#${i.number}: ${i.title} (by @${i.user.login})`;
    if (includeBody && i.body) out += `\n  ${i.body.slice(0, 200)}`;
    if (i._comments && i._comments.length > 0) {
      out += "\n  thread:";
      for (const c of i._comments) {
        const bodyLimit = c.isOperator ? 300 : 150;
        out += `\n    @${c.author} (${c.date}): ${c.body.slice(0, bodyLimit)}`;
      }
    }
    return out;
  }

  const issuesSummary = [
    directives.length > 0
      ? `DIRECTIVES (highest priority):\n${directives.map((i) => formatIssue(i)).join("\n\n")}`
      : "",
    visitorIssues.length > 0
      ? `VISITORS (respond):\n${visitorIssues.map((i) => formatIssue(i)).join("\n\n")}`
      : "",
    selfIssues.length > 0
      ? `YOUR ISSUES:\n${selfIssues.map((i) => formatIssue(i, false)).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n");

  // focus — short-term memory
  const focus = readFile("memory/focus.md");

  // last cycle summary — read the most recent proof
  let lastCycleSummary = null;
  try {
    const proofDirs = fs.readdirSync(path.resolve(REPO_ROOT, "proofs")).sort().reverse();
    for (const dir of proofDirs) {
      const proofFiles = fs.readdirSync(path.resolve(REPO_ROOT, `proofs/${dir}`)).sort().reverse();
      if (proofFiles.length > 0) {
        const lastProof = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, `proofs/${dir}/${proofFiles[0]}`), "utf-8"));
        const lastSteps = lastProof.steps || [];
        const meaningful = lastSteps.filter(s => s.content).slice(-3);
        lastCycleSummary = meaningful.map(s => `step ${s.step}: ${s.content.slice(0, 200)}`).join("\n");
        break;
      }
    }
  } catch {}

  return {
    tree,
    selfMd,
    learnings,
    journal,
    recentCommits,
    issuesSummary,
    focus,
    lastCycleSummary,
    openIssues: issues,
    today,
    visitors,
  };
}

module.exports = { gatherContext };
