import "dotenv/config";

import { octokit } from "./app.js";

// You'll need to set your GitHub token in an environment variable


export async function getRepoObject(owner, repoName) {
  console.log(`Fetching data for repository: ${owner}/${repoName}`);
  const repoObject = await octokit.repos.get({ owner, repo: repoName });
  return repoObject;
}

export async function getRecentIssues(owner, repoName, since) {
  const issues = await octokit.paginate(octokit.issues.listForRepo, {
    owner,
    repo: repoName,
    state: 'all',
    per_page: 100,
    since: since
  });

  // filter out PRs
  return issues.filter(issue => !issue.pull_request);
}

export async function getRecentPullRequests(owner, repoName, since) {
  // gets all of them even from window -1, but it would only make it slower
  const prs = await octokit.paginate(octokit.issues.listForRepo, {
    owner,
    repo: repoName,
    state: 'all',
    per_page: 100,
    since: since
  });
  return prs.filter(pr => pr.pull_request);
}
// export async function getAllIssueComments(owner, repoName) {
//   return await octokit.paginate(octokit.issues.listCommentsForRepo, {
//     owner,
//     repo: repoName,
//     per_page: 100
//   });
// }
// export async function getAllPRComments(owner, repoName) {
//   return await octokit.paginate(octokit.pulls.listCommentsForRepo, {
//     owner,
//     repo: repoName,
//     per_page: 100
//   });
// }


// export async function fetchGitHubData(owner, repoName) {
//   const [repo, issues, prs, issueComments, prComments] = await Promise.all([
//     getRepoObject(owner, repoName),
//     getAllIssues(owner, repoName),
//     getAllPullRequests(owner, repoName),
//     getAllIssueComments(owner, repoName),
//     getAllPRComments(owner, repoName)
//   ]);

//   return { repo, issues, prs, issueComments, prComments };
// }
