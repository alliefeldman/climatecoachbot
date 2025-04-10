import dayjs from "dayjs";
import { findToxicity } from "./find-toxicity.js";
import { getTime, checkQuota, getBots } from "./helpers.js";
import { median, average } from 'simple-statistics';
import { Octokit } from "@octokit/rest";
import "dotenv/config";
import { getRepoObject, getAllIssues, getAllPullRequests } from "./github-helpers.js";

const DEBUG = true;

async function findNewAuthors(repo, convType, since, users) {
  let octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  await checkQuota(octokit);
  // Ensure that you can safely update 'repo' without breaking the input value

  const newAuthors = [];
  const recurringAuthors = [];
  const tenures = [];

  for (const user of users) {

    let found = false;
    let count = 0;

    const { data: userConvs } = await octokit.issues.listForRepo({
      owner: repo.data.owner.login,
      repo: repo.data.name,
      state: "all",
      creator: user.login,
      sort: "created",
      direction: "asc",
      per_page: 100,
    });


    let indRes = null;

    for (const conv of userConvs) {
      const { data } = await octokit.issues.get({
        owner: repo.data.owner.login,
        repo: repo.data.name,
        issue_number: conv.number,
      });

      if (count === 0) {
        const tenure = dayjs().diff(dayjs(data.created_at), "month", true);
        tenures.push(tenure);
      }

      if (convType === "issue" && !data.pull_request) {
        found = true;
      } else if (convType === "pr" && data.pull_request) {
        found = true;
      }

      if (found) {
        indRes = data;
        break;
      }
    }

    if (indRes && dayjs(indRes.created_at).isAfter(dayjs(since))) {
      newAuthors.push(user);
    } else {
      recurringAuthors.push(user);
    }
  }

  const avgTenure = tenures.length > 0 ? tenures.reduce((a, b) => a + b) / tenures.length : 0;
  return { newAuthors, avgTenure, recurringAuthors };
}

export async function calculateMetrics(owner, repoName) {

  const repo = await getRepoObject(owner, repoName);
  const window = 1; // this if from the past week (TODO: run this for window 1 and 2 so we can use emojis to mark trends)


  const since = getTime(window);
  const end = getTime(window - 1);

  const res = {
    "num_closed": {
      "issues": 0,
      "pull_requests": 0
    },
    "num_closed_0_comments": {
      "issues": 0,
      "pull_requests": 0
    },
    "avg_close_time": {
      "issues": 0,
      "pull_requests": 0
    },
    "median_close_time": {
      "issues": 0,
      "pull_requests": 0
    },
    "median_comments_recent": {
      "issues": 0,
      "pull_requests": 0
    },
    "avg_comments_recent": {
      "issues": 0,
      "pull_requests": 0
    },
    "num_opened": {
      "issues": 0,
      "pull_requests": 0
    },
    "num_unique_authors": {
      "issues": 0,
      "pull_requests": 0
    },
    "unique_authors": {
      "issues": [],
      "pull_requests": []
    },
    "new_authors": {
      "issues": [],
      "pull_requests": []
    },
    "num_new_authors": {
      "issues": 0,
      "pull_requests": 0
    },
    "recur_authors": {
      "issues": [],
      "pull_requests": []
    },
    "num_recur_authors": {
      "issues": 0,
      "pull_requests": 0
    },
    "avg_recent_comments": {
      "issues": 0,
      "pull_requests": 0
    },
    "median_recent_comments": {
      "issues": 0,
      "pull_requests": 0
    },
    "new_label_counts": {},
    "num_toxic": 0,
    "toxic_convos": {
      "issues": [],
      "pull_requests": []
    },
    // "neg_senti":  {
    //   "issues": [],
    //   "pull_requests": []
    // },
    "max_toxic": {
      "issues": 0,
      "pull_requests": 0
    },
    "max_attack": {
      "issues": 0,
      "pull_requests": 0
    },
    "avg_comments_before_close": {
      "issues": 0,
      "pull_requests": 0
    },
  };

  const allIssues = getAllIssues(owner, repoName);

  const allPullRequests = getAllPullRequests(owner, repoName);

  if (allIssues.length === 0 && allPullRequests.length === 0) {
    return res
  }

  // num_closed
  const issuesClosedInCurrentWindow = allIssues.filter(issue => {
    const issueState = issue.state;
    const closedAt = new Date(issue.closed_at);
    return issueState === "closed" && closedAt >= since && closedAt < end
  });

  const numIssuesClosed = issuesClosedInCurrentWindow.length;

  const pullRequestsClosedInCurrentWindow = allPullRequests.filter(issue => {
    const issueState = issue.state;
    const closedAt = new Date(issue.closed_at);
    return issueState === "closed" && closedAt >= since && closedAt < end
  });

  const numPullRequestsClosed = issuesClosedInCurrentWindow.length;


  res.num_closed.issues = numIssuesClosed;
  res.num_closed.pull_requests = numPullRequestsClosed;

  // median_close_time, avg_close_time, median_comments_before_close, avg_comments_before_close

  let medianIssueCloseTime = 0;
  let avgIssueCloseTime = 0;
  let medianIssueCommentsBeforeClose = 0;
  let avgIssueCommentsBeforeClose = 0;

  let medianPullRequestCloseTime = 0;
  let avgPullRequestCloseTime = 0;
  let medianPullRequestCommentsBeforeClose = 0;
  let avgPullRequestCommentsBeforeClose = 0;

  if (numIssuesClosed > 0) {
    // Assuming curWinClosed is an array of objects with a `close_len` property
    const closeTimes = issuesClosedInCurrentWindow.map(item => item.close_len);
    medianIssueCloseTime = median(closeTimes);
    avgIssueCloseTime = average(closeTimes);

    const issueCommentsBeforeCloses = issuesClosedInCurrentWindow.map(item => item.num_comments);
    medianIssueCommentsBeforeClose = median(issueCommentsBeforeCloses);
    avgIssueCommentsBeforeClose = average(issueCommentsBeforeCloses);
  }

  if (numPullRequestsClosed > 0) {
    const closeTimes = pullRequestsClosedInCurrentWindow.map(item => item.close_len);
    medianIssueCloseTime = median(closeTimes);
    avgIssueCloseTime = average(closeTimes);

    const pullRequestCommentsBeforeCloses = pullRequestsClosedInCurrentWindow.map(item => item.num_comments);
    medianIssueCommentsBeforeClose = median(pullRequestCommentsBeforeCloses);
    avgIssueCommentsBeforeClose = average(pullRequestCommentsBeforeCloses);
  }

  // num_closed_0_comments
  const numClosedIssuesWith0Comments = issuesClosedInCurrentWindow.filter(issue => {
    const numComments = issue.num_comments;
    return numComments === 0;
  }).length;

  const numClosedPullRequestsWith0Comments = pullRequestsClosedInCurrentWindow.filter(pr => {
    const numComments = pr.num_comments;
    return numComments === 0;
  }).length;


  // num_opened

  const issuesOpenedInCurrentWindow = allIssues.filter(issue => {
    const createdAt = issue.created_at
    return createdAt >= since && createdAt < end;
  });

  const numIssuesOpened = issuesOpenedInCurrentWindow.length;

  const pullRequestsOpenedInCurrentWindow = allPullRequests.filter(pr => {
    const createdAt = pr.created_at
    return createdAt >= since && createdAt < end;
  });

  const numPullRequestsOpened = pullRequestsOpenedInCurrentWindow.length;


  // median_recent_comments (on issues and prs)

  let medianRecentIssueComments = 0;
  let avgRecentIssueComments = 0;

  if (numIssuesOpened > 0) {
    const numComments = issuesOpenedInCurrentWindow.map(item => item.num_comments);
    medianRecentIssueComments = median(numComments);
    avgRecentIssueComments = average(numComments);
  }

  let medianRecentPullRequestComments = 0;
  let avgRecentPullRequestComments = 0;

  if (numPullRequestsOpened > 0) {
    const numComments = pullRequestsOpenedInCurrentWindow.map(item => item.num_comments);
    medianRecentPullRequestComments = median(numComments);
    avgRecentPullRequestComments = average(numComments);
  }

  //unique_authors
  const bots = await getBots();

  const issueAuthors = issuesOpenedInCurrentWindow.map(issue => issue.user);
  const nonBotIssueAuthors = issueAuthors.filter(author => { return !bots.includes(author) });
  const uniqueIssueAuthors = [...new Set(nonBotIssueAuthors)];
  const uniqueIssueAuthorLogins = uniqueIssueAuthors.map(author => author.login);

  const pullRequestAuthors = pullRequestsOpenedInCurrentWindow.map(pr => pr.user);
  const nonBotPullRequestAuthors = pullRequestAuthors.filter(author => { return !bots.includes(author) });
  const uniquePullRequestAuthors = [...new Set(nonBotPullRequestAuthors)];
  const uniquePullRequestAuthorLogins = uniquePullRequestAuthors.map(author => author.login);



  //num_unique_authors
  const numUniqueIssueAuthors = uniqueIssueAuthorLogins.length;
  const numUniquePullRequestAuthors = uniquePullRequestAuthorLogins.length;


  //new_authors, recurring authors
  const { newIssueAuthors, avgIssueAuthorTenure, recurringIssueAuthors } = await findNewAuthors(repo, convType, since, uniqueAuthors); // new authors did not contribute before this window


  //
  const numNewIssueAuthors = newIssueAuthors.length;

  //
  const newIssueAuthorLogins = newIssueAuthors.map(author => author.login);

  const numRecurringIssueAuthors = recurringIssueAuthors.length;
  const recurringIssueAuthorLogins = recurringIssueAuthors.map(author => author.login);


  // const commentsInCurrentWindow = comments.filter(comment => {
  //   const createdAt = comment.created_at;
  //   return createdAt >= since && createdAt < end;
  // });

  // ok should this use all of the comments though? or am i tripping
  // console.log("comment 0 just so i can see", comments[0]);
  // get the comments that were made since "since and before end"
  // with those comments, find the conversations that they're associated to


  // active discussions = discussions with at least one comment the past week
  // const toxicIssueConvosInCurrentWindow = findToxicity(repo, commentsInCurrentWindow, allDiscussions, since, end);

  // const numToxicIssueConvos = toxicConvosInCurrentWindow.toxic.length;

  // res = {
  //   "num_closed": numClosed,
  //   "num_closed_0_comments": numClosed0Comments,
  //   "median_close_time": medianCloseTime,
  //   "avg_close_time": avgCloseTime,
  //   "num_opened": numOpened,
  //   "num_unique_authors": numUniqueAuthors,
  //   "unique_authors": uniqueAuthorLogins,
  //   "new_authors": newAuthorLogins,
  //   "num_new_authors": numNewAuthors,
  //   "recur_authors": recurringAuthorLogins,
  //   "num_recur_authors": numRecurringAuthors,
  //   "avg_tenure": avgTenure,
  //   "median_comments_before_close": medianCommentsBeforeClose,
  //   "avg_comments_before_close": avgCommentsBeforeClose,
  //   "median_comments_recent": round(median_comments_recent, 1),
  //   "avg_comments_recent": round(avg_comments_recent, 1),
  //   "num_toxic": numToxicConvos,
  //   "toxic": copy.deepcopy(toxic_convs["toxic"]),
  //   // "neg_senti": copy.deepcopy(toxic_convs["neg_senti"]),
  //   "max_toxic": round(toxic_convs["max_toxic"], 3),
  //   "max_attack": round(toxic_convs["max_attack"], 3)
  // }
  return res;


}