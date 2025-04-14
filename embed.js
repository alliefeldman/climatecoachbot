import { EmbedBuilder } from "discord.js";
import { getMetricTrends } from "./get-metric-trends.js";
import { addTrailingEmojis } from "./emojis.js";
import { loadResultsFromFile } from "./helpers.js";
import { capitalizeWords } from "./helpers.js";

export const infoEmbed = (guildId, content, discType) => {
  const { lastMetrics, currentMetrics } = loadResultsFromFile(guildId);
  if (!lastMetrics || !currentMetrics) {
    console.log("No metrics found for this guild");

    return new EmbedBuilder().setTitle("Error").setDescription("No metrics found for this guild");
  }
  const metricTrends = getMetricTrends(lastMetrics, currentMetrics);
  const contentNameFormatted = capitalizeWords(content.replace(/_/g, " ")).splice;
  const discTypeFormatted = capitalizeWords(discType.replace(/_/g, " "));
  let title = null;
  let fields = [];
  let allContributors;
  if (content === "all_contributor_stats") {
    allContributors = currentMetrics["unique_authors"][discType];

    fields.push({
      name: `${discTypeFormatted} Contributor Count`,
      value: `\`${currentMetrics["num_unique_authors"][discType]}\` ${addTrailingEmojis(
        metricTrends["delta_num_unique_authors"][discType],
        "num_unique_authors"
      )}`,
      inline: true,
    });
    fields.push({
      name: `New ${discTypeFormatted} Contributor Count`,
      value: `\`${currentMetrics["num_new_authors"][discType]}\` ${addTrailingEmojis(
        metricTrends["delta_num_new_authors"][discType],
        "num_new_authors"
      )}`,
      inline: true,
    });
    fields.push({
      name: `Returning ${discTypeFormatted} Contributor Count`,
      value: `\`${currentMetrics["num_recur_authors"][discType]}\` ${addTrailingEmojis(
        metricTrends["delta_num_recur_authors"][discType],
        "num_recur_authors"
      )}`,
      inline: true,
    });
    const contributorMap = allContributors.map(
      (contributor) => `**[@${contributor.login}](${contributor.html_url})**\n`
    );
    fields.push({
      name: `All ${discType} contributors`,
      value: contributorMap.length > 0 ? contributorMap.join("\n") : "No contributors",
      inline: true,
    });
    title = `All Contributor Stats`;
  }
  if (content === "new_contributors" || content === "all_contributor_stats") {
    let newContributors = currentMetrics["new_authors"][discType];
    let newContributorsMap = newContributors.map(
      (contributor) => `**[@${contributor.login}](${contributor.html_url})**\n`
    );
    fields.push({
      name: `New ${discType} contributors`,
      value: newContributorsMap.length > 0 ? newContributorsMap.join("\n") : "No new contributors",
      inline: true,
    });
  }
  if (content === "returning_contributors" || content === "all_contributor_stats") {
    let returningContributors = currentMetrics["recur_authors"][discType];
    let returningContributorsMap = returningContributors.map(
      (contributor) => `**[@${contributor.login}](${contributor.html_url})**\n`
    );
    fields.push({
      name: `Returning ${discTypeFormatted} contributors`,
      value:
        returningContributorsMap.length > 0
          ? returningContributorsMap.join("\n")
          : "No returning contributors",
      inline: true,
    });
  }
  if (content.includes("closed")) {
    //closed_issue_stats or closed_pull_request_stats
    const closedCount = currentMetrics["num_closed"][discType];
    fields.push({
      name: `${discTypeFormatted} Closed`,
      value: `\`${closedCount}\` ${addTrailingEmojis(
        metricTrends["delta_num_closed"][discType],
        "num_closed"
      )}`,
      inline: false,
    });
    fields.push({
      name: `Close Time (days)`,
      value: `Average: \`${currentMetrics["avg_close_time"][discType].toFixed(
        3
      )}\` ${addTrailingEmojis(
        metricTrends["delta_avg_close_time"][discType],
        "avg_close_time"
      )}\nMedian: ${currentMetrics["median_close_time"][discType].toFixed(3)} ${addTrailingEmojis(
        metricTrends["delta_median_close_time"][discType],
        "median_close_time"
      )}`,
      inline: false,
    });
    fields.push({
      name: `Comments Before Close`,
      value: `Average: \`${currentMetrics["avg_comments_before_close"][discType].toFixed(
        3
      )}\` ${addTrailingEmojis(
        metricTrends["delta_avg_comments_before_close"][discType],
        "avg_comments_before_close"
      )}\nMedian: \`${currentMetrics["median_comments_before_close"][discType].toFixed(
        3
      )}\` ${addTrailingEmojis(
        metricTrends["delta_median_comments_before_close"][discType],
        "median_comments_before_close"
      )}`,
      inline: false,
    });
    title = `Closed ${discTypeFormatted} Stats`;
  }
  if (content.includes("opened")) {
    //opened_issue_stats or opened_pull_request_stats
    const openedCount = currentMetrics["num_opened"][discType];
    fields.push({
      name: `${discTypeFormatted} Opened`,
      value: `\`${openedCount}\` ${addTrailingEmojis(
        metricTrends["delta_num_opened"][discType],
        "num_opened"
      )}`,
      inline: false,
    });
    fields.push({
      name: `Comments`,
      value: `Average: \`${currentMetrics["avg_recent_comments"][discType].toFixed(3)}\`\nMedian: ${
        currentMetrics["median_recent_comments"][discType]
      }`,
      inline: false,
    });
    title = `Opened ${discTypeFormatted} Stats`;
  }
  if (content === "toxic_issue_convos" || content === "all_toxic_convos") {
    const toxicConvos = currentMetrics["toxic_convos"]["issues"];
    const numToxic = currentMetrics["num_toxic_convos"]["issues"];
    let charLimit = 30;
    let toxicConvosValidLength = toxicConvos.map(
      (convo) =>
        `[${convo.title.slice(0, charLimit)}${
          convo.title.length > charLimit && convo.title.slice(0, charLimit).length > 0 ? "..." : ""
        } #${convo.number}](${convo.html_url})`
    );
    while (toxicConvosValidLength.join("\n").length > 1024 && charLimit > 0) {
      charLimit -= 5;
      toxicConvosValidLength = toxicConvos.map(
        (convo) =>
          `[${convo.title.slice(0, charLimit)}${
            convo.title.length > charLimit && convo.title.slice(0, charLimit).length > 0
              ? "..."
              : ""
          } #${convo.number}](${convo.html_url})`
      );
    }
    while (toxicConvosValidLength.join("\n").length > 1024) {
      toxicConvosValidLength = toxicConvosValidLength.slice(0, toxicConvosValidLength.length - 1);
    }

    fields.push({
      name: `\`Issue\` Conversations: \`${numToxic}\` ${addTrailingEmojis(
        metricTrends["delta_num_toxic_convos"]["issues"],
        "num_toxic_convos"
      )}`,
      value:
        toxicConvos.length > 0 ? toxicConvosValidLength.join("\n") : "- No toxic conversations",
      inline: true,
    });
  }
  if (content === "toxic_pull_request_convos" || content === "all_toxic_convos") {
    const toxicConvos = currentMetrics["toxic_convos"]["pull_requests"];
    const numToxic = currentMetrics["num_toxic_convos"]["pull_requests"];
    let charLimit = 30;
    let toxicConvosValidLength = toxicConvos.map(
      (convo) =>
        `[${convo.title.slice(0, charLimit)}${
          convo.title.length > charLimit && convo.title.slice(0, charLimit).length > 0 ? "..." : ""
        } #${convo.number}](${convo.html_url})`
    );
    while (toxicConvosValidLength.join("\n").length > 1024 && charLimit > 0) {
      charLimit -= 5;
      toxicConvosValidLength = toxicConvos.map(
        (convo) =>
          `[${convo.title.slice(0, charLimit)}${
            convo.title.length > charLimit && convo.title.slice(0, charLimit).length > 0
              ? "..."
              : ""
          } #${convo.number}](${convo.html_url})`
      );
    }
    while (toxicConvosValidLength.join("\n").length > 1024) {
      toxicConvosValidLength = toxicConvosValidLength.slice(0, toxicConvosValidLength.length - 1);
    }
    fields.push({
      name: `\`Pull Request\` Conversations: \`${numToxic}\` ${addTrailingEmojis(
        metricTrends["delta_num_toxic_convos"]["pull_requests"],
        "num_toxic_convos"
      )}`,
      value: toxicConvos.length > 0 ? toxicConvosValidLength.join("\n") : "No toxic conversations",
      inline: true,
    });
  }
  if (content === "all_toxic_convos") {
    title = `All Toxic Conversations`;
  }

  const embedProps = new EmbedBuilder().setColor(0x0099ff).setTitle(title).setFields(fields);

  return embedProps;
};
