function calculateChangeRatio(last, current) {
  return (current - last) / last;
}

function addTrendEmoji(trend) {
  if (trend > 0) {
    return " :chart_with_upwards_trend:";
  } else if (trend < 0) {
    return " :chart_with_downwards_trend:";
  } else {
    return " :balance_scale:";
  }
}

function getMetricTrends(lastMetrics, currentMetrics) {

  const res = {
    // Community
    "delta_num_unique_authors": {
      "issues": calculateChangeRatio(
        lastMetrics["num_unique_authors"]["issues"],
        currentMetrics["num_unique_authors"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["num_unique_authors"]["pull_requests"],
        currentMetrics["num_unique_authors"]["pull_requests"])
    },
    "delta_num_new_authors": {
      "issues": calculateChangeRatio(
        lastMetrics["num_new_authors"]["issues"],
        currentMetrics["num_new_authors"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["num_new_authors"]["pull_requests"],
        currentMetrics["num_new_authors"]["pull_requests"])
    },
    "delta_num_recur_authors": {
      "issues": calculateChangeRatio(
        lastMetrics["num_recur_authors"]["issues"],
        currentMetrics["num_recur_authors"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["num_recur_authors"]["pull_requests"],
        currentMetrics["num_recur_authors"]["pull_requests"])
    },

    // Close Activity
    "delta_num_closed": {
      "issues": calculateChangeRatio(
        lastMetrics["num_closed"]["issues"],
        currentMetrics["num_closed"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["num_closed"]["pull_requests"],
        currentMetrics["num_closed"]["pull_requests"])
    },
    "delta_num_closed_0_comments": {
      "issues": calculateChangeRatio(
        lastMetrics["num_closed_0_comments"]["issues"],
        currentMetrics["num_closed_0_comments"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["num_closed_0_comments"]["pull_requests"],
        currentMetrics["num_closed_0_comments"]["pull_requests"])
    },
    "delta_avg_close_time": {
      "issues": calculateChangeRatio(
        lastMetrics["avg_close_time"]["issues"],
        currentMetrics["avg_close_time"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["avg_close_time"]["pull_requests"],
        currentMetrics["avg_close_time"]["pull_requests"])
    },
    "delta_median_close_time": {
      "issues": calculateChangeRatio(
        lastMetrics["median_close_time"]["issues"],
        currentMetrics["median_close_time"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["median_close_time"]["pull_requests"],
        currentMetrics["median_close_time"]["pull_requests"])
    },
    "delta_median_comments_before_close": {
      "issues": calculateChangeRatio(
        lastMetrics["median_comments_before_close"]["issues"],
        currentMetrics["median_comments_before_close"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["median_comments_before_close"]["pull_requests"],
        currentMetrics["median_comments_before_close"]["pull_requests"])
    },
    "delta_avg_comments_before_close": {
      "issues": calculateChangeRatio(
        lastMetrics["avg_comments_before_close"]["issues"],
        currentMetrics["avg_comments_before_close"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["avg_comments_before_close"]["pull_requests"],
        currentMetrics["avg_comments_before_close"]["pull_requests"])
    },
    "delta_num_opened": {
      "issues": calculateChangeRatio(
        lastMetrics["num_opened"]["issues"],
        currentMetrics["num_opened"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["num_opened"]["pull_requests"],
        currentMetrics["num_opened"]["pull_requests"])
    },
    "delta_avg_recent_comments": {
      "issues": calculateChangeRatio(
        lastMetrics["avg_recent_comments"]["issues"],
        currentMetrics["avg_recent_comments"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["avg_recent_comments"]["pull_requests"],
        currentMetrics["avg_recent_comments"]["pull_requests"])
    },
    "delta_median_recent_comments": {
      "issues": calculateChangeRatio(
        lastMetrics["median_recent_comments"]["issues"],
        currentMetrics["median_recent_comments"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["median_recent_comments"]["pull_requests"],
        currentMetrics["median_recent_comments"]["pull_requests"])
    },
    "delta_num_toxic_convos": {
      "issues": calculateChangeRatio(
        lastMetrics["num_toxic_convos"]["issues"],
        currentMetrics["num_toxic_convos"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["num_toxic_convos"]["pull_requests"],
        currentMetrics["num_toxic_convos"]["pull_requests"])
    },
    "delta_num_toxic_comments": {
      "issues": calculateChangeRatio(
        lastMetrics["num_toxic_comments"]["issues"],
        currentMetrics["num_toxic_comments"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["num_toxic_comments"]["pull_requests"],
        currentMetrics["num_toxic_comments"]["pull_requests"])
    },
    "delta_max_toxic": { // as of now, its max toxicity for RECENT comments
      "issues": calculateChangeRatio(
        lastMetrics["max_toxic"]["issues"],
        currentMetrics["max_toxic"]["issues"]),
      "pull_requests": calculateChangeRatio(
        lastMetrics["max_toxic"]["pull_requests"],
        currentMetrics["max_toxic"]["pull_requests"])
    },
    "avg_tenure": calculateChangeRatio(
      lastMetrics["avg_tenure"],
      currentMetrics["avg_tenure"]),
  }
  return res;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const formatted = date.toLocaleDateString("en-US"); // "4/10/2025"
  return formatted;
}


export function generateReportMessage(lastMetrics, currentMetrics) {

  const metricTrends = getMetricTrends(lastMetrics, currentMetrics);

  const reportTitle =
    `# Community Health Update (${formatDate(lastMetrics.since)} - ${formatDate(currentMetrics.since)})`;

  const communityUpdateMetricTrends = {
    "num_unique_authors-issues": metricTrends["delta_num_unique_authors"]["issues"],
    "num_unique_authors-pull_requests": metricTrends["delta_num_unique_authors"]["pull_requests"],
    "num_new_authors-issues": metricTrends["delta_num_new_authors"]["issues"],
    "num_new_authors-pull_requests": metricTrends["delta_num_new_authors"]["pull_requests"],
    "num_recur_authors-issues": metricTrends["delta_num_recur_authors"]["issues"],
    "num_recur_authors-pull_requests": metricTrends["delta_num_recur_authors"]["pull_requests"]
  }

  const communityUpdateMetrics = {
    "num_authors-issues":
      "> ### You had `" +
      currentMetrics["num_unique_authors"]["issues"] +
      "` active *issue* contributor" +
      (currentMetrics["num_unique_authors"]["issues"] != 1 ? "s" : "") +
      addTrendEmoji(communityUpdateMetricTrends["num_unique_authors-issues"]) +
      "\n" +
      "> - New = `" +
      currentMetrics["num_new_authors"]["issues"] +
      "` " +
      addTrendEmoji(communityUpdateMetricTrends["num_new_authors-issues"]) +
      "\n" +
      "> - Returning = `" +
      currentMetrics["num_recur_authors"]["issues"] +
      "` " +
      addTrendEmoji(communityUpdateMetricTrends["num_recur_authors-issues"]),
    "num_authors-pull_requests":
      "> ### You had `" +
      currentMetrics["num_unique_authors"]["pull_requests"] +
      "` active *pull request* contributor" +
      (currentMetrics["num_unique_authors"]["pull_requests"] != 1 ? "s" : "") +
      addTrendEmoji(communityUpdateMetricTrends["num_unique_authors-pull_requests"]) +
      "\n" +
      "> - New = `" +
      currentMetrics["num_new_authors"]["pull_requests"] +
      "` " +
      addTrendEmoji(communityUpdateMetricTrends["num_new_authors-pull_requests"]) +
      "\n" +
      "> - Returning = `" +
      currentMetrics["num_recur_authors"]["pull_requests"] +
      "` " +
      addTrendEmoji(communityUpdateMetricTrends["num_recur_authors-pull_requests"])
  }



  const community =
    `> ## Community
  ${Object.values(communityUpdateMetrics).join("\n")}
    `;

  const closeActivityMetricTrends = {
    "num_closed-issues:": metricTrends["delta_num_closed"]["issues"],
    "num_closed-pull_requests": metricTrends["delta_num_closed"]["pull_requests"],
    "num_closed_0_comments-issues": metricTrends["delta_num_closed_0_comments"]["issues"],
    "num_closed_0_comments-pull_requests": metricTrends["delta_num_closed_0_comments"]["pull_requests"],
    "avg_close_time-issues": metricTrends["delta_avg_close_time"]["issues"],
    "avg_close_time-pull_requests": metricTrends["delta_avg_close_time"]["pull_requests"],
    "median_close_time-issues": metricTrends["delta_median_close_time"]["issues"],
    "median_close_time-pull_requests": metricTrends["delta_median_close_time"]["pull_requests"],
    "median_comments_before_close-issues": metricTrends["delta_median_comments_before_close"]["issues"],
    "median_comments_before_close-pull_requests": metricTrends["delta_median_comments_before_close"]["pull_requests"],
    "avg_comments_before_close-issues": metricTrends["delta_avg_comments_before_close"]["issues"],
    "avg_comments_before_close-pull_requests": metricTrends["delta_avg_comments_before_close"]["pull_requests"],
  }
  const closeActivityMetrics = {
    "num_closed-issues":
      "> ### `" +
      currentMetrics["num_closed"]["issues"] +
      "` **issue**" +
      (currentMetrics["num_closed"]["issues"] != 1 ? "*s* were" : " was") +
      " closed " +
      addTrendEmoji(closeActivityMetricTrends["num_closed-issues"]),
    "close_time-issues":
      "> - Issue *close time (days)*:\n" +
      ">   - Average = `" +
      currentMetrics["avg_close_time"]["issues"] +
      "`" +
      addTrendEmoji(closeActivityMetricTrends["avg_close_time-issues"]) +
      "\n" +
      ">   - Median = `" +
      currentMetrics["median_close_time"]["issues"] +
      "`" +
      addTrendEmoji(closeActivityMetricTrends["median_close_time-issues"]),
    "comments_before_close-issues":
      "> - Issue *comments* before close:\n" +
      ">   - Average = `" +
      currentMetrics["avg_comments_before_close"]["issues"] +
      "`" +
      addTrendEmoji(closeActivityMetricTrends["avg_comments_before_close-issues"]) +
      "\n" +
      ">   - Median = `" +
      currentMetrics["median_comments_before_close"]["issues"] +
      "`" +
      addTrendEmoji(closeActivityMetricTrends["median_comments_before_close-issues"]),
    "num_closed_0_comments-issues":
      "> - Issues closed with 0 comments = `" +
      currentMetrics["num_closed_0_comments"]["issues"] +
      "` " +
      addTrendEmoji(closeActivityMetricTrends["num_closed_0_comments-issues"]),
  }

  const closeActivity = `
  > ## Close Activity
  ${Object.values(closeActivityMetrics).join("\n")}
  `


  const messageBlocks = [reportTitle, community, closeActivity];
  return messageBlocks;
}