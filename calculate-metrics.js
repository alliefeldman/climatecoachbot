import dayjs from "dayjs";
import { findToxicity } from "./find-toxicity.js";
import { getTime, checkQuota, getBots } from "./helpers.js";
import { median, average } from "simple-statistics";
import { Octokit } from "@octokit/rest";
import "dotenv/config";
import {
  getRepoObject,
  getRecentIssues,
  getRecentPullRequests,
  getRecentIssueComments,
  getRecentPRComments,
} from "./github-helpers.js";
import { argv0 } from "process";

const DEBUG = true;

async function getAvgTenure(tenures) {
  let tenuresArray = [];
  for (let userLogin of Object.keys(tenures)) {
    tenuresArray.push(tenures[userLogin]);
  }
  return tenuresArray.length > 0 ? average(tenuresArray) : 0;
}

async function getAuthorStats(repo, since, end, uniqueAuthors, tenures) {
  let octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  // Ensure that you can safely update 'repo' without breaking the input value

  const newAuthors = [];
  const recurringAuthors = [];

  for (const user of uniqueAuthors) {
    await checkQuota(octokit);
    let found = false;
    let count = 0;

    const userIssuesAndPRs = (
      await octokit.issues.listForRepo({
        owner: repo.data.owner.login,
        repo: repo.data.name,
        state: "all",
        creator: user.login,
        sort: "created",
        direction: "asc",
        per_page: 100,
      })
    ).data;

    let earliestCreatedAtDate = null;

    for (const issue of userIssuesAndPRs) {
      let createdAt = new Date(issue.created_at);
      if (!earliestCreatedAtDate || (earliestCreatedAtDate && createdAt < earliestCreatedAtDate)) {
        earliestCreatedAtDate = createdAt;
      }
    }

    const tenure = dayjs(end).diff(dayjs(earliestCreatedAtDate), "month", true);

    if (!(user.login in tenures)) {
      tenures[user.login] = tenure;
    }
    // console.log("tenures -", tenures);
    if (earliestCreatedAtDate < new Date(since)) {
      recurringAuthors.push(user); // eventually change to just 'user' to make it a hyperlink
    } else {
      newAuthors.push(user); // eventually change to just 'user' to make it a hyperlink
    }
  }

  return { newAuthors, recurringAuthors };
}

export async function calculateMetrics(owner, repoName, period, ago) {
  const repo = await getRepoObject(owner, repoName);
  const since = getTime(period == "week" ? ago + 1 : 0, period == "day" ? ago + 1 : 0);
  const end = getTime(period == "week" ? ago : 0, period == "day" ? ago : 0);

  console.log("Starting metrics calculation for", owner, "/", repoName);

  const res = {
    since: since,
    end: end,
    num_unique_authors: {
      issues: 0,
      pull_requests: 0,
    },
    unique_authors: {
      issues: [],
      pull_requests: [],
    },
    new_authors: {
      // also this is just the logins for now, eventually it will be a link
      issues: [], //btw, this is authors of issues who are new to ANY creation, git or pr
      pull_requests: [],
    },
    num_new_authors: {
      issues: 0,
      pull_requests: 0,
    },
    recur_authors: {
      issues: [],
      pull_requests: [],
    },
    num_recur_authors: {
      issues: 0,
      pull_requests: 0,
    },
    num_closed: {
      issues: 0,
      pull_requests: 0,
    },
    num_closed_0_comments: {
      issues: 0,
      pull_requests: 0,
    },
    avg_close_time: {
      issues: 0,
      pull_requests: 0,
    },
    median_close_time: {
      issues: 0,
      pull_requests: 0,
    },
    median_comments_before_close: {
      issues: 0,
      pull_requests: 0,
    },
    avg_comments_before_close: {
      issues: 0,
      pull_requests: 0,
    },
    num_opened: {
      issues: 0,
      pull_requests: 0,
    },

    avg_recent_comments: {
      issues: 0,
      pull_requests: 0,
    },
    median_recent_comments: {
      issues: 0,
      pull_requests: 0,
    },
    new_label_counts: {},
    num_toxic_convos: {
      issues: 0,
      pull_requests: 0,
    },
    num_toxic_comments: {
      issues: 0,
      pull_requests: 0,
    },
    toxic_convos: {
      issues: [],
      pull_requests: [],
    },
    toxic_comments: {
      issues: [],
      pull_requests: [],
    },
    max_toxic: {
      // as of now, its max toxicity for RECENT comments
      issues: 0,
      pull_requests: 0,
    },
    // "max_attack": {
    //   "issues": 0,
    //   "pull_requests": 0
    // },
    avg_tenure: 0, // in months
  };

  const allIssues = await getRecentIssues(owner, repoName, since);

  const allPullRequests = await getRecentPullRequests(owner, repoName, since);

  // num_closed
  const issuesClosedInCurrentWindow = allIssues.filter((issue) => {
    const issueState = issue.state;
    const closedAt = issue.closed_at;
    return issueState === "closed" && closedAt >= since && closedAt < end;
  });

  const numIssuesClosed = issuesClosedInCurrentWindow.length;
  res["num_closed"]["issues"] = numIssuesClosed;

  const pullRequestsClosedInCurrentWindow = allPullRequests.filter((issue) => {
    const issueState = issue.state;
    const closedAt = issue.closed_at;
    return issueState === "closed" && closedAt >= since && closedAt < end;
  });

  const numPullRequestsClosed = pullRequestsClosedInCurrentWindow.length;
  // console.log("pr closed =", numPullRequestsClosed);
  res["num_closed"]["pull_requests"] = numPullRequestsClosed;

  res.num_closed.issues = numIssuesClosed;
  res.num_closed.pull_requests = numPullRequestsClosed;

  // median_close_time, avg_close_time, median_comments_before_close, avg_comments_before_close
  // const testIssue = issuesClosedInCurrentWindow[0];
  // console.log("result =", (new Date(testIssue.closed_at)) - (new Date(testIssue.created_at)));

  const issueCloseTimes = issuesClosedInCurrentWindow.map(
    (item) => (new Date(item.closed_at) - new Date(item.created_at)) / (1000 * 60 * 60 * 24)
  );
  const medianIssueCloseTime = numIssuesClosed != 0 ? median(issueCloseTimes) : 0;
  res["median_close_time"]["issues"] = medianIssueCloseTime;

  const avgIssueCloseTime = numIssuesClosed != 0 ? average(issueCloseTimes) : 0;
  res["avg_close_time"]["issues"] = avgIssueCloseTime;

  const issueCommentsBeforeCloses = issuesClosedInCurrentWindow.map((item) => item.comments);
  const medianIssueCommentsBeforeClose =
    numIssuesClosed != 0 ? median(issueCommentsBeforeCloses) : 0;
  res["median_comments_before_close"]["issues"] = medianIssueCommentsBeforeClose;

  const avgIssueCommentsBeforeClose = numIssuesClosed != 0 ? average(issueCommentsBeforeCloses) : 0;
  res["avg_comments_before_close"]["issues"] = avgIssueCommentsBeforeClose;

  const pullRequestCloseTimes = pullRequestsClosedInCurrentWindow.map(
    (item) => (new Date(item.closed_at) - new Date(item.created_at)) / (1000 * 60 * 60 * 24)
  );
  const medianPullRequestCloseTime = numPullRequestsClosed != 0 ? median(pullRequestCloseTimes) : 0;
  res["median_close_time"]["pull_requests"] = medianPullRequestCloseTime;

  const avgPullRequestCloseTime = numPullRequestsClosed != 0 ? average(pullRequestCloseTimes) : 0;
  res["avg_close_time"]["pull_requests"] = avgPullRequestCloseTime;

  const pullRequestCommentsBeforeCloses = pullRequestsClosedInCurrentWindow.map(
    (item) => item.comments
  );
  const medianPullRequestCommentsBeforeClose =
    numPullRequestsClosed != 0 ? median(pullRequestCommentsBeforeCloses) : 0;
  res["median_comments_before_close"]["pull_requests"] = medianPullRequestCommentsBeforeClose;
  const avgPullRequestCommentsBeforeClose =
    numPullRequestsClosed != 0 ? average(pullRequestCommentsBeforeCloses) : 0;
  res["avg_comments_before_close"]["pull_requests"] = avgPullRequestCommentsBeforeClose;

  // num_closed_0_comments
  const numClosedIssuesWith0Comments = issuesClosedInCurrentWindow.filter((issue) => {
    const numComments = issue.comments;
    return numComments === 0;
  }).length;
  res["num_closed_0_comments"]["issues"] = numClosedIssuesWith0Comments;

  const numClosedPullRequestsWith0Comments = pullRequestsClosedInCurrentWindow.filter((pr) => {
    const numComments = pr.comments;
    return numComments === 0;
  }).length;
  res["num_closed_0_comments"]["pull_requests"] = numClosedPullRequestsWith0Comments;

  // num_opened

  const issuesOpenedInCurrentWindow = allIssues.filter((issue) => {
    const createdAt = issue.created_at;
    return createdAt >= since && createdAt < end;
  });

  const numIssuesOpened = issuesOpenedInCurrentWindow.length;
  res["num_opened"]["issues"] = numIssuesOpened;

  const pullRequestsOpenedInCurrentWindow = allPullRequests.filter((pr) => {
    const createdAt = pr.created_at;
    return createdAt >= since && createdAt < end;
  });

  const numPullRequestsOpened = pullRequestsOpenedInCurrentWindow.length;
  res["num_opened"]["pull_requests"] = numPullRequestsOpened;

  // median_recent_comments (on issues and prs)

  const numIssueComments = issuesOpenedInCurrentWindow.map((item) => item.comments);
  const medianRecentIssueComments = numIssuesOpened != 0 ? median(numIssueComments) : 0;
  res["median_recent_comments"]["issues"] = medianRecentIssueComments;
  const avgRecentIssueComments = numIssuesOpened != 0 ? average(numIssueComments) : 0;
  res["avg_recent_comments"]["issues"] = avgRecentIssueComments;

  const numPullRequestComments = pullRequestsOpenedInCurrentWindow.map((item) => item.comments);
  const medianRecentPullRequestComments =
    numPullRequestsOpened != 0 ? median(numPullRequestComments) : 0;
  res["median_recent_comments"]["pull_requests"] = medianRecentPullRequestComments;
  const avgRecentPullRequestComments =
    numPullRequestsOpened != 0 ? average(numPullRequestComments) : 0;
  res["avg_recent_comments"]["pull_requests"] = avgRecentPullRequestComments;

  //unique_authors
  const bots = await getBots();

  const issueAuthors = issuesOpenedInCurrentWindow.map((issue) => issue.user);
  const nonBotIssueAuthors = issueAuthors.filter((author) => {
    return !bots.includes(author);
  });
  const uniqueIssueAuthors = [
    ...new Map(nonBotIssueAuthors.map((author) => [author.login, author])).values(),
  ];
  const uniqueIssueAuthorLogins = uniqueIssueAuthors.map((author) => author.login);
  res["unique_authors"]["issues"] = uniqueIssueAuthors;

  const pullRequestAuthors = pullRequestsOpenedInCurrentWindow.map((pr) => pr.user);
  const nonBotPullRequestAuthors = pullRequestAuthors.filter((author) => {
    return !bots.includes(author);
  });
  const uniquePullRequestAuthors = [
    ...new Map(nonBotPullRequestAuthors.map((author) => [author.login, author])).values(),
  ];

  const uniquePullRequestAuthorLogins = uniquePullRequestAuthors.map((author) => author.login);
  res["unique_authors"]["pull_requests"] = uniquePullRequestAuthors;

  //num_unique_authors
  const numUniqueIssueAuthors = uniqueIssueAuthorLogins.length;
  res["num_unique_authors"]["issues"] = numUniqueIssueAuthors;
  const numUniquePullRequestAuthors = uniquePullRequestAuthorLogins.length;
  res["num_unique_authors"]["pull_requests"] = numUniquePullRequestAuthors;

  let tenures = {};
  //new_authors, recurring authors
  const { newAuthors: newIssueAuthors, recurringAuthors: recurringIssueAuthors } =
    await getAuthorStats(repo, since, end, uniqueIssueAuthors, tenures); // new authors did not contribute before this window
  const { newAuthors: newPullRequestAuthors, recurringAuthors: recurringPullRequestAuthors } =
    await getAuthorStats(repo, since, end, uniquePullRequestAuthors, tenures); // new authors did not contribute before this window

  const avgTenure = await getAvgTenure(tenures);

  res["avg_tenure"] = avgTenure;

  // num_new_authors
  res["num_new_authors"]["issues"] = newIssueAuthors.length;
  res["num_new_authors"]["pull_requests"] = newPullRequestAuthors.length;

  // new_authors
  res["new_authors"]["issues"] = newIssueAuthors;
  res["new_authors"]["pull_requests"] = newPullRequestAuthors;

  // recurring_authors
  res["num_recur_authors"]["issues"] = recurringIssueAuthors.length;
  res["num_recur_authors"]["pull_requests"] = recurringPullRequestAuthors.length;

  res["recur_authors"]["issues"] = recurringIssueAuthors;
  res["recur_authors"]["pull_requests"] = recurringPullRequestAuthors;

  const allIssueComments = await getRecentIssueComments(owner, repoName, since);

  const filteredIssueComments = allIssueComments.filter((comment) => {
    const createdAt = comment.created_at;
    return createdAt >= since && createdAt < end;
  });

  // toxic_convos, toxic_comments, max_toxic
  const {
    toxicConvos: toxicIssueConvos,
    toxicComments: toxicIssueComments,
    maxToxicity: maxIssueCommentToxicity,
  } = await findToxicity(repo, filteredIssueComments, since, end);

  // console.log("toxicISsueConvos", toxicIssueConvos.length);
  res["toxic_convos"]["issues"] = toxicIssueConvos;

  const allPullRequestComments = await getRecentPRComments(owner, repoName, since);
  // console.log("recent pr comments", allPullRequestComments.length);
  const filteredPullRequestComments = allPullRequestComments.filter((comment) => {
    const createdAt = comment.created_at;
    return createdAt >= since && createdAt < end;
  });
  // console.log("filtered pr comments", filteredPullRequestComments.length);
  const {
    toxicConvos: toxicPullRequestConvos,
    toxicComments: toxicPullRequestComments,
    maxToxicity: maxPullRequestCommentToxicity,
  } = await findToxicity(repo, filteredPullRequestComments, since, end);

  res["toxic_convos"]["pull_requests"] = toxicPullRequestConvos;

  res["toxic_comments"]["issues"] = toxicIssueComments;
  res["toxic_comments"]["pull_requests"] = toxicPullRequestComments;

  res["max_toxic"]["issues"] = maxIssueCommentToxicity;
  res["max_toxic"]["pull_requests"] = maxPullRequestCommentToxicity;

  // num_toxic_convos, num_toxic_comments
  const numToxicIssueConvos = toxicIssueConvos.length;
  const numToxicPullRequestConvos = toxicPullRequestConvos.length;
  const numToxicIssueComments = toxicIssueComments.length;
  const numToxicPullRequestComments = toxicPullRequestComments.length;

  res["num_toxic_convos"]["issues"] = numToxicIssueConvos;
  res["num_toxic_convos"]["pull_requests"] = numToxicPullRequestConvos;
  res["num_toxic_comments"]["issues"] = numToxicIssueComments;
  res["num_toxic_comments"]["pull_requests"] = numToxicPullRequestComments;

  return res;
}
