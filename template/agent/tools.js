// tool definitions — daimon's capabilities in OpenAI function format
// daimon: you can ADD new tools here. don't remove existing ones.

const TOOLS = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or replace any file in the repo. This includes your own code (agent/*.js), workflows (.github/), memory, or anything else. The universal primitive — you can build anything with this.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path from repo root (e.g. 'agent/prompt.js', 'memory/2026-02-18.md')",
          },
          content: {
            type: "string",
            description: "The full file content to write",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "append_file",
      description: "Add content to the end of an existing file without replacing it. Good for journals, learnings, logs.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path from repo root",
          },
          content: {
            type: "string",
            description: "Content to append",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of any file in the repo. Use this to inspect code, memory, or anything before modifying it. For large files, use offset and limit to read specific sections.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path from repo root",
          },
          offset: {
            type: "integer",
            description: "Line number to start from (1-based). Omit to start from beginning.",
          },
          limit: {
            type: "integer",
            description: "Max number of lines to return. Omit to read entire file (up to 4000 chars).",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_issue",
      description: "Open a new GitHub issue. Issues are your thoughts, tasks, and conversations. Auto-added to your project board.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Issue title",
          },
          body: {
            type: "string",
            description: "Issue body (markdown)",
          },
          labels: {
            type: "array",
            items: { type: "string" },
            description: "Labels to apply (e.g. ['self'])",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "close_issue",
      description: "Close a GitHub issue, optionally with a final comment explaining why.",
      parameters: {
        type: "object",
        properties: {
          number: {
            type: "integer",
            description: "Issue number to close",
          },
          comment: {
            type: "string",
            description: "Optional closing comment",
          },
        },
        required: ["number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "comment_issue",
      description: "Add a comment to an existing GitHub issue. Use this to reply to visitors, continue conversations, or update your thoughts.",
      parameters: {
        type: "object",
        properties: {
          number: {
            type: "integer",
            description: "Issue number to comment on",
          },
          body: {
            type: "string",
            description: "Comment body (markdown)",
          },
        },
        required: ["number", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the internet for information. Use when you genuinely need to look something up. Returns search results.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to search for",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a shell command on the runner. You have a full Ubuntu environment with node, git, curl, python3, etc. Use for: checking the time, running scripts, installing packages, testing code, or anything you can do in a terminal. Commands run in the repo root with a 30s timeout.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to run (e.g. 'date', 'node -e \"console.log(1+1)\"', 'ls -la')",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List files and directories at a path. Returns names with / suffix for directories. Much cheaper than reading every file — use this to navigate before reading.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path from repo root (e.g. '.', 'agent', 'memory'). Defaults to repo root.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search across files in the repo for a text pattern (regex supported). Returns matching lines with file paths and line numbers. Use this to find where something is defined or referenced without reading every file.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Text or regex pattern to search for",
          },
          path: {
            type: "string",
            description: "Directory to search in (default: entire repo)",
          },
          glob: {
            type: "string",
            description: "File pattern filter (e.g. '*.js', '*.md')",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file from the repo. Use to clean up old proofs, outdated files, or anything no longer needed.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path from repo root",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetch and read a web page or API endpoint. Returns the text content (HTML stripped to readable text, or raw JSON). Use for reading documentation, checking APIs, fetching data. Max 4000 chars returned.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Full URL to fetch (e.g. 'https://docs.base.org/getting-started')",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_search",
      description: "Search GitHub for code, repositories, or issues across all of GitHub. Use to find examples, libraries, or how others solved problems.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (e.g. 'ERC20 deploy base solidity', 'autonomous agent github actions')",
          },
          type: {
            type: "string",
            enum: ["code", "repositories", "issues"],
            description: "What to search for. Default: repositories",
          },
        },
        required: ["query"],
      },
    },
  },
];

module.exports = { TOOLS };
