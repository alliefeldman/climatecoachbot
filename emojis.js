function addSentimentEmoji(trend, metricCategory) {
  const growthIsPositive = [
    "num_unique_authors",
    "num_new_authors",
    "num_recur_authors",
    "num_closed",
    "num_opened",
    "avg_comments_before_close",
    "median_comments_before_close",
    "avg_recent_comments",
    "median_recent_comments",
  ];
  const growthIsNegative = [
    "avg_close_time",
    "median_close_time",
    "num_closed_0_comments",
    "num_toxic_convos",
    "num_toxic_comments",
    "max_toxic",
  ];

  if (trend > 0 && growthIsPositive.includes(metricCategory)) {
    return " :thumbs_up:";
  }
  if (trend < 0 && growthIsPositive.includes(metricCategory)) {
    return " :thumbs_down:";
  }
  if (trend < 0 && growthIsNegative.includes(metricCategory)) {
    return " :thumbs_up:";
  }
  if (trend > 0 && growthIsNegative.includes(metricCategory)) {
    return " :thumbs_down:";
  }
  return "";
}

function addTrendEmoji(trend) {
  if (trend > 0) {
    return " :arrow_up:";
  } else if (trend < 0) {
    return " :arrow_down:";
  } else {
    return " :balance_scale:";
  }
}

export function addTrailingEmojis(trend, metricCategory) {
  return addTrendEmoji(trend) + addSentimentEmoji(trend, metricCategory);
}
