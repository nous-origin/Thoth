// github API + project board — core infrastructure
// daimon: don't rewrite this file. add new functions if needed.

const { OWNER, REPO, GH_TOKEN, PROJECT_NUMBER } = require("./config");

async function githubAPI(endpoint, options = {}) {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `https://api.github.com/repos/${OWNER}/${REPO}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

async function graphql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${GH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}

async function addToProject(issueNodeId) {
  try {
    const projectData = await graphql(`
      query {
        user(login: "${OWNER}") {
          projectV2(number: ${PROJECT_NUMBER}) { id }
        }
      }
    `);
    const projectId = projectData.user.projectV2.id;
    await graphql(`
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
          item { id }
        }
      }
    `, { projectId, contentId: issueNodeId });
  } catch (e) {
    console.error(`project board add failed: ${e.message}`);
  }
}

module.exports = { githubAPI, graphql, addToProject };
