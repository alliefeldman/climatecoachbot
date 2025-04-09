import { Octokit } from "@octokit/rest";
import dayjs from "dayjs";
import { findToxicity } from "./find_toxicity";
import { getTime, checkQuota, getBots } from "./helper";
import { all } from "express/lib/application";

const DEBUG = true;
const bots = getBots();

async function findNewAuthors(repo, convType, since, users, octokit) {
  const newAuthors = [];
  const recurringAuthors = [];
  const tenures = [];

  for (const user of users) {
    ({ octokit, repo } = await checkQuota(octokit, repo));
    let found = false;
    let count = 0;

    const { data: userConvs } = await octokit.issues.listForRepo({
      owner: repo.owner.login,
      repo: repo.name,
      state: "all",
      creator: user.login,
      sort: "created",
      direction: "asc",
      per_page: 100,
    });

    let indRes = null;

    for (const conv of userConvs) {
      const { data } = await octokit.issues.get({
        owner: repo.owner.login,
        repo: repo.name,
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

async function calMetrics(repo, convType, allDiscussions, comments, window, octokit) {
  if (allDiscussions.length === 0) {
    res = {
      "num_closed": 0,
      "num_closed_0_comments": 0,
      "avg_close_time": 0,
      "median_close_time": 0,
      "median_comments_recent": 0,
      "avg_comments_recent": 0,
      "num_open": 0,
      "num_unique_authors": 0,
      "unique_authors": [],
      "new_authors": [],
      "num_new_authors": 0,
      "recur_authors": [],
      "num_recur_authors": 0,
      "avg_comments": 0,
      "median_commenst": 0,
      "new_label_counts": {},
      "num_toxic": 0,
      "toxic": [],
      // "neg_senti": [],
      "max_toxic": 0,
      "max_attack": 0,
      "avg_comments_before_close": 0
    }
    return res
  }

  const since = getTime(window);
  const end = getTime(window - 1);

  const closedInCurrentWindow = allDiscussions.filter(discussion => {
    const discussionState = discussion.state;
    const closedAt = new Date(discussion.closed_at);
    return discussionState === "closed" && closedAt >= since && closedAt < end
  });

  const numClosed = len(closedInCurrentWindow);

  const openedInCurrentWindow = allDiscussions.filter(discussion => {
    const createdAt = discussion.created_at
    return createdAt >= since && createdAt < end;
  });

  const numOpened = len(openedInCurrentWindow);


  const authors = openedInCurrentWindow.map(discussion => discussion.author);

  const nonBotAuthors = authors.filter(author => { return !bots.includes(author) });

  const uniqueAuthors = [...new Set(nonBotAuthors)];
  const uniqueAuthorLogins = uniqueAuthors.map(author => author.login);

  const numUniqueAuthors = len(uniqueAuthors);

  const { newAuthors, avgTenure, recurringAuthors } = findNewAuthors(repo, convType, since, uniqueAuthors, octokit); // new authors did not contribute before this window

  const numNewAuthors = newAuthors.length;
  const newAuthorLogins = newAuthors.map(author => author.login);

  const numRecurringAuthors = recurringAuthors.length;
  const recurringAuthorLogins = recurringAuthors.map(author => author.login);


  const commentsInCurrentWindow = comments.filter(comment => {
    const createdAt = comment.created_at;
    return createdAt >= since && createdAt < end;
  });

  // ok should this use all of the comments though? or am i tripping
  const toxicConvosInCurrentWindow
}