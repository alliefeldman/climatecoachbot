import "dotenv/config";

function calculateChangeRatio(last, current) {
  if (last === 0) {
    if (current === 0) {
      return 0;
    }
    return 1; // Equivalent to 100% change
  }
  return (current - last) / last;
}

export function getMetricTrends(lastMetrics, currentMetrics) {
  if (!lastMetrics || !currentMetrics) {
    console.error("No metrics found");
    return null;
  }
  if (!lastMetrics["num_unique_authors"] || !currentMetrics["num_unique_authors"]) {
    console.error("No metrics found");
    return null;
  }
  console.log(
    "what i wanted to see",
    lastMetrics["num_new_authors"]["issues"],
    currentMetrics["num_new_authors"]["issues"]
  );
  const res = {
    // Community
    delta_num_unique_authors: {
      issues: calculateChangeRatio(
        lastMetrics["num_unique_authors"]["issues"],
        currentMetrics["num_unique_authors"]["issues"]
      ),
      pull_requests: calculateChangeRatio(
        lastMetrics["num_unique_authors"]["pull_requests"],
        currentMetrics["num_unique_authors"]["pull_requests"]
      ),
    },
    delta_num_new_authors: {
      issues: calculateChangeRatio(
        lastMetrics["num_new_authors"]["issues"],
        currentMetrics["num_new_authors"]["issues"]
      ),
      pull_requests: calculateChangeRatio(
        lastMetrics["num_new_authors"]["pull_requests"],
        currentMetrics["num_new_authors"]["pull_requests"]
      ),
    },
    delta_num_recur_authors: {
      issues: calculateChangeRatio(
        lastMetrics["num_recur_authors"]["issues"],
        currentMetrics["num_recur_authors"]["issues"]
      ),
      pull_requests: calculateChangeRatio(
        lastMetrics["num_recur_authors"]["pull_requests"],
        currentMetrics["num_recur_authors"]["pull_requests"]
      ),
    },

    // Close Activity
    delta_num_closed: {
      issues: calculateChangeRatio(lastMetrics["num_closed"]["issues"], currentMetrics["num_closed"]["issues"]),
      pull_requests: calculateChangeRatio(
        lastMetrics["num_closed"]["pull_requests"],
        currentMetrics["num_closed"]["pull_requests"]
      ),
    },
    delta_num_closed_0_comments: {
      issues: calculateChangeRatio(
        lastMetrics["num_closed_0_comments"]["issues"],
        currentMetrics["num_closed_0_comments"]["issues"]
      ),
      pull_requests: calculateChangeRatio(
        lastMetrics["num_closed_0_comments"]["pull_requests"],
        currentMetrics["num_closed_0_comments"]["pull_requests"]
      ),
    },
    delta_avg_close_time: {
      issues: calculateChangeRatio(lastMetrics["avg_close_time"]["issues"], currentMetrics["avg_close_time"]["issues"]),
      pull_requests: calculateChangeRatio(
        lastMetrics["avg_close_time"]["pull_requests"],
        currentMetrics["avg_close_time"]["pull_requests"]
      ),
    },
    delta_median_close_time: {
      issues: calculateChangeRatio(
        lastMetrics["median_close_time"]["issues"],
        currentMetrics["median_close_time"]["issues"]
      ),
      pull_requests: calculateChangeRatio(
        lastMetrics["median_close_time"]["pull_requests"],
        currentMetrics["median_close_time"]["pull_requests"]
      ),
    },
    delta_median_comments_before_close: {
      issues: calculateChangeRatio(
        lastMetrics["median_comments_before_close"]["issues"],
        currentMetrics["median_comments_before_close"]["issues"]
      ),
      pull_requests: calculateChangeRatio(
        lastMetrics["median_comments_before_close"]["pull_requests"],
        currentMetrics["median_comments_before_close"]["pull_requests"]
      ),
    },
    delta_avg_comments_before_close: {
      issues: calculateChangeRatio(
        lastMetrics["avg_comments_before_close"]["issues"],
        currentMetrics["avg_comments_before_close"]["issues"]
      ),
      pull_requests: calculateChangeRatio(
        lastMetrics["avg_comments_before_close"]["pull_requests"],
        currentMetrics["avg_comments_before_close"]["pull_requests"]
      ),
    },
    delta_num_opened: {
      issues: calculateChangeRatio(lastMetrics["num_opened"]["issues"], currentMetrics["num_opened"]["issues"]),
      pull_requests: calculateChangeRatio(
        lastMetrics["num_opened"]["pull_requests"],
        currentMetrics["num_opened"]["pull_requests"]
      ),
    },
    delta_avg_recent_comments: {
      issues: calculateChangeRatio(
        lastMetrics["avg_recent_comments"]["issues"],
        currentMetrics["avg_recent_comments"]["issues"]
      ),
      pull_requests: calculateChangeRatio(
        lastMetrics["avg_recent_comments"]["pull_requests"],
        currentMetrics["avg_recent_comments"]["pull_requests"]
      ),
    },
    delta_median_recent_comments: {
      issues: calculateChangeRatio(
        lastMetrics["median_recent_comments"]["issues"],
        currentMetrics["median_recent_comments"]["issues"]
      ),
      pull_requests: calculateChangeRatio(
        lastMetrics["median_recent_comments"]["pull_requests"],
        currentMetrics["median_recent_comments"]["pull_requests"]
      ),
    },
    delta_num_toxic_convos: {
      issues: calculateChangeRatio(
        lastMetrics["num_toxic_convos"]["issues"],
        currentMetrics["num_toxic_convos"]["issues"]
      ),
      pull_requests: calculateChangeRatio(
        lastMetrics["num_toxic_convos"]["pull_requests"],
        currentMetrics["num_toxic_convos"]["pull_requests"]
      ),
    },
    delta_num_toxic_comments: {
      issues: calculateChangeRatio(
        lastMetrics["num_toxic_comments"]["issues"],
        currentMetrics["num_toxic_comments"]["issues"]
      ),
      pull_requests: calculateChangeRatio(
        lastMetrics["num_toxic_comments"]["pull_requests"],
        currentMetrics["num_toxic_comments"]["pull_requests"]
      ),
    },
    delta_max_toxic: {
      // as of now, its max toxicity for RECENT comments
      issues: calculateChangeRatio(lastMetrics["max_toxic"]["issues"], currentMetrics["max_toxic"]["issues"]),
      pull_requests: calculateChangeRatio(
        lastMetrics["max_toxic"]["pull_requests"],
        currentMetrics["max_toxic"]["pull_requests"]
      ),
    },
    avg_tenure: calculateChangeRatio(lastMetrics["avg_tenure"], currentMetrics["avg_tenure"]),
  };
  return res;
}
