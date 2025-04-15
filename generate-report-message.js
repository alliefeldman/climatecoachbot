import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { client } from "./client.js";
import { getMetricTrends } from "./get-metric-trends.js";
import { addTrailingEmojis } from "./emojis.js";
import { infoEmbed } from "./embed.js";
import { loadResultsFromFile, capitalizeWords, formatDate, plural } from "./helpers.js";
import { upsertRow } from "./google-sheets.js";
import fs from "fs";

let guildRepoData = new Map();
let reportMessageIds = new Map(); // guildId =? reportMessageId

export function loadGuildRepoDataFromFile() {
  if (fs.existsSync("state.json")) {
    const content = fs.readFileSync("state.json", "utf-8").trim();

    if (!content) {
      console.log("📂 State file is empty. Initializing with empty maps.");
      return;
    }
    const data = JSON.parse(content);

    guildRepoData = new Map(Object.entries(data?.guildRepoData || {}));
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const seeEmbedButton = (content, discType) => {
  const contentNameFormatted = capitalizeWords(content.replace(/_/g, " "));
  return new ButtonBuilder()
    .setCustomId(`reveal_embed:${content}:${discType}`)
    .setLabel(`See ${contentNameFormatted}`)
    .setStyle(ButtonStyle.Secondary);
};

const hideEmbedButton = (content, discType) => {
  const contentNameFormatted = capitalizeWords(content.replace(/_/g, " "));
  return new ButtonBuilder()
    .setCustomId(`hide_embed:${content}:${discType}`)
    .setLabel(`Hide ${contentNameFormatted}`)
    .setStyle(ButtonStyle.Primary);
};

function isRelevantTrend(trend) {
  // console.log("trend", trend);
  if (!trend) {
    return false;
  }
  return Math.abs(Math.abs(trend) - 1) >= 0.2;
}

let communitySection = new Map();
let closeActivitySection = new Map();
let openActivitySection = new Map();
let conversationQualitySection = new Map();

export async function generateReportMessage(guildId, channel) {
  const { lastMetrics, currentMetrics } = loadResultsFromFile(guildId);
  const metricTrends = getMetricTrends(lastMetrics, currentMetrics);

  const reportTitle = `# Community Health Update (${formatDate(
    currentMetrics.since
  )} - ${formatDate(currentMetrics.end)})`;

  const communityTrends = {
    "num_unique_authors-issues": metricTrends["delta_num_unique_authors"]["issues"],
    "num_unique_authors-pull_requests": metricTrends["delta_num_unique_authors"]["pull_requests"],
    "num_new_authors-issues": metricTrends["delta_num_new_authors"]["issues"],
    "num_new_authors-pull_requests": metricTrends["delta_num_new_authors"]["pull_requests"],
    "num_recur_authors-issues": metricTrends["delta_num_recur_authors"]["issues"],
    "num_recur_authors-pull_requests": metricTrends["delta_num_recur_authors"]["pull_requests"],
    avg_tenure: metricTrends["avg_tenure"],
  };

  const closeActivityMetricTrends = {
    "num_closed-issues:": metricTrends["delta_num_closed"]["issues"],
    "num_closed-pull_requests": metricTrends["delta_num_closed"]["pull_requests"],
    "num_closed_0_comments-issues": metricTrends["delta_num_closed_0_comments"]["issues"],
    "num_closed_0_comments-pull_requests":
      metricTrends["delta_num_closed_0_comments"]["pull_requests"],
    "avg_close_time-issues": metricTrends["delta_avg_close_time"]["issues"],
    "avg_close_time-pull_requests": metricTrends["delta_avg_close_time"]["pull_requests"],
    "median_close_time-issues": metricTrends["delta_median_close_time"]["issues"],
    "median_close_time-pull_requests": metricTrends["delta_median_close_time"]["pull_requests"],
    "median_comments_before_close-issues":
      metricTrends["delta_median_comments_before_close"]["issues"],
    "median_comments_before_close-pull_requests":
      metricTrends["delta_median_comments_before_close"]["pull_requests"],
    "avg_comments_before_close-issues": metricTrends["delta_avg_comments_before_close"]["issues"],
    "avg_comments_before_close-pull_requests":
      metricTrends["delta_avg_comments_before_close"]["pull_requests"],
  };

  const modal = new ModalBuilder().setCustomId("info_modal").setTitle("Details");

  const infoInput = new TextInputBuilder()
    .setCustomId("fake_display")
    .setLabel("Information")
    .setStyle(TextInputStyle.Paragraph)
    .setValue("Here’s some read-only info for you.")
    .setRequired(false); // optional field

  const firstActionRow = new ActionRowBuilder().addComponents(infoInput);
  modal.addComponents(firstActionRow);

  communitySection.set(guildId, () => {
    const issueCount = currentMetrics["num_unique_authors"]["issues"];
    const issueTrend = communityTrends["num_unique_authors-issues"];
    const issueNewCount = currentMetrics["num_new_authors"]["issues"];
    const issueNewTrend = communityTrends["num_new_authors-issues"];
    const issueRecurCount = currentMetrics["num_recur_authors"]["issues"];
    const issueRecurTrend = communityTrends["num_recur_authors-issues"];
    const pullRequestCount = currentMetrics["num_unique_authors"]["pull_requests"];
    const pullRequestTrend = communityTrends["num_unique_authors-pull_requests"];
    const pullRequestNewCount = currentMetrics["num_new_authors"]["pull_requests"];
    const pullRequestNewTrend = communityTrends["num_new_authors-pull_requests"];
    const pullRequestRecurCount = currentMetrics["num_recur_authors"]["pull_requests"];
    const pullRequestRecurTrend = communityTrends["num_recur_authors-pull_requests"];

    const communityTitle = { content: "## Community" };

    const activeIssueContributors = {
      content:
        `### Total \`ISSUE\` contributors: \`${issueCount}\`` +
        addTrailingEmojis(issueTrend, "num_unique_authors") +
        (isRelevantTrend(issueNewTrend)
          ? `\n- \`New: ${issueNewCount}\` ` + addTrailingEmojis(issueNewTrend, "num_new_authors")
          : "") +
        (isRelevantTrend(issueRecurTrend)
          ? `\n- \`Returning: ${issueRecurCount}\` ` +
            addTrailingEmojis(issueRecurTrend, "num_recur_authors")
          : ""),
      components: [
        (() => {
          const possibleButtons = new ActionRowBuilder();
          if (issueCount > 0) {
            possibleButtons.addComponents(seeEmbedButton("all_contributor_stats", "issues"));
          }
          if (issueNewCount > 0) {
            possibleButtons.addComponents(seeEmbedButton("new_contributors", "issues"));
          }
          if (issueRecurCount > 0) {
            possibleButtons.addComponents(seeEmbedButton("returning_contributors", "issues"));
          }
          return possibleButtons;
        })(),
      ],
    };
    if (activeIssueContributors.components[0].components.length === 0) {
      activeIssueContributors.components = null;
    }

    const activePullRequestContributors = {
      content:
        `### Total \`PULL REQUEST\` contributors: \`${pullRequestCount}\`` +
        addTrailingEmojis(pullRequestTrend, "num_unique_authors") +
        (isRelevantTrend(pullRequestNewTrend)
          ? `\n- \`New: ${pullRequestNewCount}\` ` +
            addTrailingEmojis(pullRequestNewTrend, "num_new_authors")
          : "") +
        (isRelevantTrend(pullRequestRecurTrend)
          ? `\n- \`Returning: ${pullRequestRecurCount}\` ` +
            addTrailingEmojis(pullRequestRecurTrend, "num_recur_authors")
          : ""),
      components: [
        (() => {
          const possibleButtons = new ActionRowBuilder();
          if (pullRequestCount > 0) {
            possibleButtons.addComponents(seeEmbedButton("all_contributor_stats", "pull_requests"));
          }
          if (pullRequestNewCount > 0) {
            possibleButtons.addComponents(seeEmbedButton("new_contributors", "pull_requests"));
          }
          if (pullRequestRecurCount > 0) {
            possibleButtons.addComponents(
              seeEmbedButton("returning_contributors", "pull_requests")
            );
          }
          return possibleButtons;
        })(),
      ],
    };
    if (activePullRequestContributors.components[0].components.length === 0) {
      activePullRequestContributors.components = null;
    }

    const section = [communityTitle, activeIssueContributors, activePullRequestContributors];

    return section;
  });

  closeActivitySection.set(guildId, () => {
    const issueCount = currentMetrics["num_closed"]["issues"];
    const issueTrend = closeActivityMetricTrends["num_closed-issues"];
    const issue0Comm = currentMetrics["num_closed_0_comments"]["issues"];
    const issue0CommTrend = closeActivityMetricTrends["num_closed_0_comments-issues"];
    const pullRequestCount = currentMetrics["num_closed"]["pull_requests"];
    const pullRequestTrend = closeActivityMetricTrends["num_closed-pull_requests"];
    const pullRequest0Comm = currentMetrics["num_closed_0_comments"]["pull_requests"];
    const pullRequest0CommTrend = closeActivityMetricTrends["num_closed_0_comments-pull_requests"];
    const avgCloseTimeIssue = currentMetrics["avg_close_time"]["issues"].toFixed(3);
    const avgCloseTimeIssueTrend = closeActivityMetricTrends["avg_close_time-issues"];
    const medCloseTimeIssue = currentMetrics["median_close_time"]["issues"].toFixed(3);
    const medCloseTimeIssueTrend = closeActivityMetricTrends["median_close_time-issues"];
    const avgCloseTimePR = currentMetrics["avg_close_time"]["pull_requests"].toFixed(3);
    const avgCloseTimePRTrend = closeActivityMetricTrends["avg_close_time-pull_requests"];
    const medCloseTimePullRequest = currentMetrics["median_close_time"]["pull_requests"].toFixed(3);
    const medClosePRTrend = closeActivityMetricTrends["median_close_time-pull_requests"];
    const avgCommIssue = currentMetrics["avg_comments_before_close"]["issues"].toFixed(3);
    const avgCommIssueTrend = closeActivityMetricTrends["avg_comments_before_close-issues"];
    const medCommIssue = currentMetrics["median_comments_before_close"]["issues"].toFixed(3);
    const medCommIssueTrend = closeActivityMetricTrends["median_comments_before_close-issues"];
    const avgCommPR = currentMetrics["avg_comments_before_close"]["pull_requests"].toFixed(3);
    const avgCommPRTrend = closeActivityMetricTrends["avg_comments_before_close-pull_requests"];
    const medCommPR = currentMetrics["median_comments_before_close"]["pull_requests"].toFixed(3);
    const medCommPRTrend = closeActivityMetricTrends["median_comments_before_close-pull_requests"];
    const closeActivityTitle = { content: "## Close Activity" };
    const numClosedIssues = {
      content: `### \`ISSUES\` closed: \`${issueCount}\` ${addTrailingEmojis(
        issueTrend,
        "num_closed"
      )}`,
      component: [() => {}],
    };

    const issueCloseTime = {
      content: `- *Close time (days)*:\n  - \`Average: ${avgCloseTimeIssue}\` ${addTrailingEmojis(
        avgCloseTimeIssueTrend,
        "avg_close_time"
      )}\n  - \`Median: ${medCloseTimeIssue}\` ${addTrailingEmojis(
        medCloseTimeIssueTrend,
        "median_close_time"
      )}`,
    };

    const issueNumComments = {
      content: `- *Number of comments* before close:\n  - \`Average: ${avgCommIssue}\` ${addTrailingEmojis(
        avgCommIssueTrend,
        "avg_comments_before_close"
      )}\n  - \`Median: ${medCommIssue}\` ${addTrailingEmojis(
        medCommIssueTrend,
        "median_comments_before_close"
      )}`,
    };

    const issue0Comments = {
      content: `- Issues closed with 0 comments = \`${issue0Comm}\` ${addTrailingEmojis(
        issue0CommTrend,
        "num_closed_0_comments"
      )}`,
    };

    const issueButtons = {
      content: "",
      components: [
        (() => {
          const possibleButtons = new ActionRowBuilder();
          possibleButtons.addComponents(seeEmbedButton("closed_issue_stats", "issues"));
          return possibleButtons;
        })(),
      ],
    };

    const numClosedPullRequests = {
      content: `### \`PULL REQUESTS\` closed: \`${pullRequestCount}\` ${addTrailingEmojis(
        pullRequestTrend,
        "num_closed"
      )}`,
    };

    const pullRequestCloseTime = {
      content: `- *Close time (days)*:\n  - \`Average: ${avgCloseTimePR}\` ${addTrailingEmojis(
        avgCloseTimePRTrend,
        "avg_close_time"
      )}\n  - \`Median: ${medCloseTimePullRequest}\` ${addTrailingEmojis(
        medClosePRTrend,
        "median_close_time"
      )}`,
    };

    const pullRequestNumComments = {
      content: `- *Number of comments* before close:\n  - \`Average: ${avgCommPR}\` ${addTrailingEmojis(
        avgCommPRTrend,
        "avg_comments_before_close"
      )}\n  - \`Median: ${medCommPR}\` ${addTrailingEmojis(
        medCommPRTrend,
        "median_comments_before_close"
      )}`,
    };

    const pullRequest0Comments = {
      content: `- Pull requests closed with 0 comments = \`${pullRequest0Comm}\` ${addTrailingEmojis(
        pullRequest0CommTrend,
        "num_closed_0_comments"
      )}`,
    };
    const pullRequestButtons = {
      content: "",
      components: [
        (() => {
          const possibleButtons = new ActionRowBuilder();
          possibleButtons.addComponents(
            seeEmbedButton("closed_pull_request_stats", "pull_requests")
          );
          return possibleButtons;
        })(),
      ],
    };

    const section = [closeActivityTitle, numClosedIssues];
    if (isRelevantTrend(avgCloseTimeIssueTrend) || isRelevantTrend(medCloseTimeIssueTrend)) {
      section.push(issueCloseTime);
    }
    if (isRelevantTrend(avgCommIssueTrend) || isRelevantTrend(medCommIssueTrend)) {
      section.push(issueNumComments);
    }
    if (isRelevantTrend(issue0CommTrend)) {
      section.push(issue0Comments);
    }
    if (issueButtons.components[0].components.length === 0) {
      issueButtons.components = null;
    } else {
      section.push(issueButtons);
    }
    section.push(numClosedPullRequests);
    if (isRelevantTrend(avgCloseTimePRTrend) || isRelevantTrend(medCommPRTrend)) {
      section.push(pullRequestCloseTime);
    }
    if (isRelevantTrend(avgCommPRTrend) || isRelevantTrend(medCommPRTrend)) {
      section.push(pullRequestNumComments);
    }
    if (isRelevantTrend(pullRequest0CommTrend)) {
      section.push(pullRequest0Comments);
    }
    if (pullRequestButtons.components[0].components.length === 0) {
      pullRequestButtons.components = null;
    } else {
      section.push(pullRequestButtons);
    }

    return section;
  });

  const openActivityMetricTrends = {
    "num_opened-issues": metricTrends["delta_num_opened"]["issues"],
    "num_opened-pull_requests": metricTrends["delta_num_opened"]["pull_requests"],
    "avg_recent_comments-issues": metricTrends["delta_avg_recent_comments"]["issues"],
    "avg_recent_comments-pull_requests": metricTrends["delta_avg_recent_comments"]["pull_requests"],
    "median_recent_comments-issues": metricTrends["delta_median_recent_comments"]["issues"],
    "median_recent_comments-pull_requests":
      metricTrends["delta_median_recent_comments"]["pull_requests"],
  };

  openActivitySection.set(guildId, () => {
    const issueCount = currentMetrics["num_opened"]["issues"];
    const issueTrend = openActivityMetricTrends["num_opened-issues"];
    const pullRequestCount = currentMetrics["num_opened"]["pull_requests"];
    const pullRequestTrend = openActivityMetricTrends["num_opened-pull_requests"];
    const avgCommIssue = currentMetrics["avg_recent_comments"]["issues"].toFixed(3);
    const avgCommIssueTrend = openActivityMetricTrends["avg_recent_comments-issues"];
    const medCommIssue = currentMetrics["median_recent_comments"]["issues"].toFixed(3);
    const medCommIssueTrend = openActivityMetricTrends["median_recent_comments-issues"];
    const avgCommPR = currentMetrics["avg_recent_comments"]["pull_requests"].toFixed(3);
    const avgCommPRTrend = openActivityMetricTrends["avg_recent_comments-pull_requests"];
    const medCommPR = currentMetrics["median_recent_comments"]["pull_requests"].toFixed(3);
    const medCommPRTrend = openActivityMetricTrends["median_recent_comments-pull_requests"];

    const openActivityTitle = { content: "## Open Activity" };

    const numOpenedIssues = {
      content: `### \`ISSUES\` opened: \`${issueCount}\` ${addTrailingEmojis(
        issueTrend,
        "num_opened"
      )}`,
    };
    const issueNumComments = {
      content: `- *Number of Comments*:\n  - \`Average: ${avgCommIssue}\` ${addTrailingEmojis(
        avgCommIssueTrend,
        "avg_recent_comments"
      )}\n  - \`Median: ${medCommIssue}\` ${addTrailingEmojis(
        medCommIssueTrend,
        "median_recent_comments"
      )}`,
    };
    const issueButtons = {
      content: "",
      components: [
        (() => {
          const possibleButtons = new ActionRowBuilder();
          possibleButtons.addComponents(seeEmbedButton("opened_issue_stats", "issues"));
          return possibleButtons;
        })(),
      ],
    };
    const numOpenedPullRequests = {
      content: `### \`PULL REQUESTS\` opened: \`${pullRequestCount}\` ${addTrailingEmojis(
        pullRequestTrend,
        "num_opened"
      )}`,
    };
    const pullRequestNumComments = {
      content: `- *Number of Comments*:\n  - \`Average: ${avgCommPR}\` ${addTrailingEmojis(
        avgCommPRTrend,
        "avg_recent_comments"
      )}\n  - \`Median: ${medCommPR}\` ${addTrailingEmojis(
        medCommPRTrend,
        "median_recent_comments"
      )}`,
    };
    const pullRequestButtons = {
      content: "",
      components: [
        (() => {
          const possibleButtons = new ActionRowBuilder();
          possibleButtons.addComponents(
            seeEmbedButton("opened_pull_request_stats", "pull_requests")
          );
          return possibleButtons;
        })(),
      ],
    };
    const section = [openActivityTitle, numOpenedIssues];
    if (isRelevantTrend(avgCommIssueTrend) || isRelevantTrend(medCommIssueTrend)) {
      section.push(issueNumComments);
    }
    if (issueButtons.components[0].components.length === 0) {
      issueButtons.components = null;
    } else {
      section.push(issueButtons);
    }
    section.push(numOpenedPullRequests);
    if (isRelevantTrend(avgCommPRTrend) || isRelevantTrend(medCommPRTrend)) {
      section.push(pullRequestNumComments);
    }
    if (pullRequestButtons.components[0].components.length === 0) {
      pullRequestButtons.components = null;
    } else {
      section.push(pullRequestButtons);
    }
    return section;
  });

  conversationQualitySection.set(guildId, () => {
    const issueCount = currentMetrics["num_toxic_convos"]["issues"];
    const issueTrend = metricTrends["delta_num_toxic_convos"]["issues"];
    const pullRequestCount = currentMetrics["num_toxic_convos"]["pull_requests"];
    const pullRequestTrend = metricTrends["delta_num_toxic_convos"]["pull_requests"];

    const conversationQualityTitle = { content: "## Conversation Quality" };
    const toxicConvosTitle = {
      content:
        "### Toxic Conversations\n" +
        "*Toxic conversations contain at least one comment that Google's [Perspective Comment Analyzer API](https://perspectiveapi.com/) scored as toxic, based on your selected threshold.*",
    };

    const toxicConvosIssues = {
      content:
        "- **`" +
        issueCount +
        "` ISSUE" +
        (issueCount != 1 ? "S" : "") +
        " had" +
        (issueCount != 1 ? " " : " a ") +
        "`toxic` conversation" +
        (issueCount != 1 ? "s" : "") +
        "** " +
        addTrailingEmojis(issueTrend, "num_toxic_convos"),
    };

    const toxicConvosPullRequests = {
      content:
        "- **`" +
        pullRequestCount +
        "` PULL REQUEST" +
        (pullRequestCount != 1 ? "S" : "") +
        " had" +
        (pullRequestCount != 1 ? " " : " a ") +
        "`toxic` conversation" +
        (pullRequestCount != 1 ? "s" : "") +
        "** " +
        addTrailingEmojis(pullRequestTrend, "num_toxic_convos"),
    };
    const toxicConvosButtons = {
      content: "",
      components: [
        (() => {
          const possibleButtons = new ActionRowBuilder();
          if (issueCount > 0 || pullRequestCount > 0) {
            possibleButtons.addComponents(seeEmbedButton("all_toxic_convos", ""));
          }
          if (issueCount > 0) {
            possibleButtons.addComponents(seeEmbedButton("toxic_issue_convos", "issues"));
          }
          if (pullRequestCount > 0) {
            possibleButtons.addComponents(
              seeEmbedButton("toxic_pull_request_convos", "pull_requests")
            );
          }

          return possibleButtons;
        })(),
      ],
    };

    const comingSoonTitle = { content: "### More *Perspective* Metrics Coming Soon!" };

    const section = [conversationQualityTitle, toxicConvosTitle];
    if (isRelevantTrend(issueTrend)) {
      section.push(toxicConvosIssues);
    }
    if (isRelevantTrend(pullRequestTrend)) {
      console.log("is relevant trend", pullRequestTrend);
      section.push(toxicConvosPullRequests);
    }
    if (toxicConvosButtons.components[0].components.length === 0) {
      toxicConvosButtons.components = null;
      section.push({ content: "- `No toxic conversations 🎊`" });
    } else {
      section.push(toxicConvosButtons);
    }

    section.push(comingSoonTitle);

    return section;
  });

  // console.log("calculation = ", Date.now() - new Date(lastMetrics["end"]));
  const titleSection = [
    { content: "================================" },
    {
      content: reportTitle,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Open Report")
            .setCustomId("open_report")
            .setStyle(ButtonStyle.Primary)
        ),
      ],
    },
    { content: "================================" },
  ];
  for (const message of titleSection) {
    await channel.send({ ...message, flags: 1 << 2 });
  }
}

client.on("interactionCreate", async (interaction) => {
  if (!(interaction.isButton() || interaction.isModalSubmit())) return;
  // console.log("interaction components", interaction.message.components);

  const [action, content, discType] = interaction.customId.split(":");
  const guildId = interaction.guild.id;

  if (action === "reveal_embed") {
    console.log("interaction???");
    await interaction.deferReply({ ephemeral: true });
    const updatedButtonComponents = interaction.message.components[0].components.map((button) => ({
      content: button.customId.split(":")[1],
      discType: button.customId.split(":")[2],
    }));
    const updatedButtonRow = new ActionRowBuilder().addComponents(
      updatedButtonComponents.map((button) =>
        button.content === content
          ? hideEmbedButton(button.content, button.discType)
          : seeEmbedButton(button.content, button.discType)
      )
    );
    console.log("Embed content:", infoEmbed(guildId, content, discType));
    await interaction.editReply({
      embeds: [infoEmbed(guildId, content, discType)],
      // ephemeral: true, // Optional: make it visible only to the user
      components: [updatedButtonRow],
    });
  }
  if (action === "hide_embed") {
    const updatedButtonComponents = interaction.message.components[0].components.map((button) => ({
      content: button.customId.split(":")[1],
      discType: button.customId.split(":")[2],
    }));
    const updatedButtonRow = new ActionRowBuilder().addComponents(
      updatedButtonComponents.map((button) => seeEmbedButton(button.content, button.discType))
    );

    await interaction.update({
      embeds: [],
      ephemeral: true, // Optional: make it visible only to the user
      components: [updatedButtonRow],
    });
  }

  if (interaction.customId === "open_report") {
    const interactionText = interaction.message.content.replace(/# /g, "");

    const interactionUrl = interaction.message.url;
    console.log("interactionText", interactionText);
    console.log("interactionUrl", interactionUrl);
    const channel = interaction.channel;
    const guildId = interaction.guild.id;
    const sections = [
      ...communitySection.get(guildId)(),
      { content: "--------------------------------" },
      ...closeActivitySection.get(guildId)(),
      { content: "--------------------------------" },
      ...openActivitySection.get(guildId)(),
      { content: "--------------------------------" },
      ...conversationQualitySection.get(guildId)(),
      { content: "================================" },
    ];
    await interaction.update({
      components: [],
    });
    for (const message of sections) {
      await channel.send({ ...message, flags: 1 << 2 });
      await sleep(600);
    }

    // Start a 3-minute timer (180000 ms)
    setTimeout(async () => {
      try {
        // Find an existing thread by name (adjust to your use case)
        const threads = await channel.threads.fetchActive();
        const thread = threads.threads
          .filter((t) => t.name.startsWith("User Diary"))
          .reduce((highest, current) => {
            const currentNumber = parseInt(current.name.split(" ").pop(), 10);
            const highestNumber = highest ? parseInt(highest.name.split(" ").pop(), 10) : NaN;

            if (isNaN(currentNumber)) return highest || current;
            if (isNaN(highestNumber) || currentNumber > highestNumber) return current;

            return highest;
          }, null);

        if (!thread) {
          console.warn("🧵 Thread 'User Diary' not found.");
          return;
        }
        const reportMessage = await thread.send({
          content: `## Hi, <@${interaction.user.id}>! You recently viewed the report [${interactionText}](${interactionUrl}).\nIn the last few minutes...`,
        });

        loadGuildRepoDataFromFile();
        const thisGuildRepoData = guildRepoData.get(guildId);
        console.log("thisGuildRepoData", thisGuildRepoData);
        const guildRepoUrl = `https://github.com/${thisGuildRepoData.owner}/${thisGuildRepoData.repoName}`;
        // add a row to the google spreadsheet with the guildID, discord user id, and the report message ID
        await upsertRow(guildId, reportMessage.id, {
          "Server Name": interaction.guild.name,
          "Discord User": interaction.user.username,
          "Repo URL": guildRepoUrl,
        });
        reportMessageIds.set(guildId, reportMessage.id);
        await thread.send({
          content:
            "### Did you click on any buttons in the report?\n For example, `See All Contributor Stats`",
          components: [
            new ActionRowBuilder().addComponents([
              new ButtonBuilder()
                .setLabel("Yes")
                .setCustomId("yes_buttons")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setLabel("No")
                .setCustomId("no_buttons")
                .setStyle(ButtonStyle.Secondary),
            ]),
          ],
        });
        await thread.send({
          content:
            "### Did you click on any links in the report?\n*(Links look like [this](https://www.google.com))*",
          components: [
            new ActionRowBuilder().addComponents([
              new ButtonBuilder()
                .setLabel("Yes")
                .setCustomId("yes_links")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setLabel("No")
                .setCustomId("no_links")
                .setStyle(ButtonStyle.Secondary),
            ]),
          ],
        });
        await thread.send({
          content:
            "### Did you perform any other actions as a result of viewing the report?\n*(For instance, navigating to your repo, merging a PR, writing a comment, etc.)*",
          components: [
            new ActionRowBuilder().addComponents([
              new ButtonBuilder()
                .setLabel("Yes")
                .setCustomId("yes_actions")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setLabel("No")
                .setCustomId("no_actions")
                .setStyle(ButtonStyle.Secondary),
            ]),
          ],
        });
      } catch (error) {
        console.error("❌ Error sending message to thread:", error);
      }
    }, 180000); // 180000 = 3 minutes
  } else if (interaction.customId === "yes_buttons") {
    const reportMessageId = reportMessageIds.get(interaction.guild.id);
    console.log("reportMessageId..", reportMessageId);
    await upsertRow(guildId, reportMessageId, {
      "Did you click on any buttons in the report?": "Yes",
    });
    await interaction.update({
      content: interaction.message.content + "\n```Yes```\nWhich buttons did you click?\n```\n ```",
      components: [
        new ActionRowBuilder().addComponents([
          new ButtonBuilder()
            .setLabel("Enter Response")
            .setCustomId("enter_response_buttons")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setLabel("I did not click any buttons")
            .setCustomId("no_buttons")
            .setStyle(ButtonStyle.Secondary),
        ]),
      ],
    });
  } else if (interaction.customId === "no_buttons") {
    const reportMessageId = reportMessageIds.get(interaction.guild.id);
    await upsertRow(guildId, reportMessageId, {
      "Did you click on any buttons in the report?": "No",
      "Which buttons did you click?": "N/A",
    });
    const initialQuestion = interaction.message.content.split("\n")[0];
    await interaction.update({
      content: initialQuestion,
      components: [
        new ActionRowBuilder().addComponents([
          new ButtonBuilder()
            .setLabel("Yes")
            .setCustomId("yes_buttons")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("No")
            .setCustomId("no_buttons")
            .setStyle(ButtonStyle.Primary),
        ]),
      ],
    });
  } else if (interaction.customId === "yes_links") {
    const reportMessageId = reportMessageIds.get(interaction.guild.id);
    await upsertRow(guildId, reportMessageId, {
      "Did you click on any links in the report?": "Yes",
    });
    await interaction.update({
      content: interaction.message.content + "\n```Yes```\nWhich links did you click?\n```\n ```",
      components: [
        new ActionRowBuilder().addComponents([
          new ButtonBuilder()
            .setLabel("Enter Response")
            .setCustomId("enter_response_links")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setLabel("I did not click on any links")
            .setCustomId("no_links")
            .setStyle(ButtonStyle.Secondary),
        ]),
      ],
    });
  } else if (interaction.customId === "no_links") {
    const reportMessageId = reportMessageIds.get(interaction.guild.id);
    await upsertRow(guildId, reportMessageId, {
      "Did you click on any links in the report?": "No",
      "Which links did you click?": "N/A",
    });
    const initialQuestion = interaction.message.content.split("\n").slice(0, 2).join("\n");
    await interaction.update({
      content: initialQuestion,
      components: [
        new ActionRowBuilder().addComponents([
          new ButtonBuilder()
            .setLabel("Yes")
            .setCustomId("yes_links")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setLabel("No").setCustomId("no_links").setStyle(ButtonStyle.Primary),
        ]),
      ],
    });
  } else if (interaction.customId === "yes_actions") {
    const reportMessageId = reportMessageIds.get(interaction.guild.id);
    await upsertRow(guildId, reportMessageId, {
      "Did you perform any other actions as a result of viewing the report?": "Yes",
    });
    await interaction.update({
      content:
        interaction.message.content + "\n```Yes```\nWhat other actions did you take?\n```\n ```",
      components: [
        new ActionRowBuilder().addComponents([
          new ButtonBuilder()
            .setLabel("Enter Response")
            .setCustomId("enter_response_actions")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setLabel("I did not perform any additional actions")
            .setCustomId("no_actions")
            .setStyle(ButtonStyle.Secondary),
        ]),
      ],
    });
  } else if (interaction.customId === "no_actions") {
    const reportMessageId = reportMessageIds.get(interaction.guild.id);
    await upsertRow(guildId, reportMessageId, {
      "Did you perform any other actions as a result of viewing the report?": "No",
      "What other actions did you take?": "N/A",
    });
    const initialQuestion = interaction.message.content.split("\n").slice(0, 2).join("\n");
    await interaction.update({
      content: initialQuestion,
      components: [
        new ActionRowBuilder().addComponents([
          new ButtonBuilder()
            .setLabel("Yes")
            .setCustomId("yes_actions")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("No")
            .setCustomId("no_actions")
            .setStyle(ButtonStyle.Primary),
        ]),
      ],
    });
  } else if (interaction.customId.includes("enter_response")) {
    const followUpQuestion = interaction.message.content.split("\n")[3];

    let question = "buttons";
    if (interaction.customId.includes("links")) {
      question = "links";
    } else if (interaction.customId.includes("actions")) {
      question = "actions";
    } else {
    }
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`user_input_modal:${question}`)
        // .setTitle("Please Provide Your Input")
        .setTitle("Diary Input")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("input_field")
              .setLabel(followUpQuestion)
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder(
                question != "actions"
                  ? `Don't worry about matching the ${
                      question === "buttons" ? "button name(s)" : "link text"
                    } exactly`
                  : `Enter any/all actions you took.`
              )
              .setRequired(true)
          )
        )
    );
  } else if (interaction.customId.includes("user_input_modal")) {
    const userInput = interaction.fields.getTextInputValue("input_field");
    console.log("User input:", userInput);
    const question = interaction.customId.split(":")[1];
    console.log("question ->", question);
    const reportMessageId = reportMessageIds.get(interaction.guild.id);

    if (interaction.customId.includes("buttons")) {
      await upsertRow(guildId, reportMessageIds.get(interaction.guild.id), {
        "Which buttons did you click?": userInput,
      });
    } else if (interaction.customId.includes("links")) {
      await upsertRow(guildId, reportMessageId, {
        "Which links did you click?": userInput,
      });
    } else if (interaction.customId.includes("actions")) {
      await upsertRow(guildId, reportMessageId, {
        "What other actions did you take?": userInput,
      });
    }
    const contentBeforeInput = interaction.message.content.split("\n").slice(0, 3).join("\n");
    await interaction.update({
      content: `${contentBeforeInput}\n\`\`\`${userInput}\`\`\``,
      components: [
        new ActionRowBuilder().addComponents([
          new ButtonBuilder()
            .setLabel("Edit Response")
            .setCustomId(`enter_response_${question}`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel(
              ["buttons", "links"].includes(question)
                ? `I did not click any ${question}`
                : `I did not perform any additional ${question}`
            )
            .setCustomId(`no_${question}`)
            .setStyle(ButtonStyle.Secondary),
        ]),
      ],
    });
  }
});
