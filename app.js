import "dotenv/config";
import {
  PermissionsBitField,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Routes,
  REST,
} from "discord.js";
import { client } from "./client.js"; // Import the client instance
import axios from "axios";
import express from "express"; // Import Express
import crypto from "crypto";
import { URL } from "url";
import fs from "fs";
import { calculateMetrics } from "./calculate-metrics.js";
import { Octokit } from "@octokit/rest";
import { generateReportMessage } from "./generate-report-message.js";
import cron from "node-cron";
import { registerSlashCommands } from "./slash-commands.js";
import { on } from "events";

export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let guildRepoData = new Map();
let onboardingState = new Map(); // guildId -> { authenticated: boolean, repoSelected: boolean }
let welcomeMessageIds = new Map(); // guildID ->
let selectRepoMessageIds = new Map(); // guildID -> messageId
let stateGuildMap = new Map(); // Or persist this if needed

const results = new Map();
const resultFile = "result.json";

function saveStateToFile() {
  fs.writeFileSync(
    "state.json",
    JSON.stringify({
      onboardingState: Object.fromEntries(onboardingState),
      stateGuildMap: Object.fromEntries(stateGuildMap),
      guildRepoData: Object.fromEntries(guildRepoData),
      welcomeMessageIds: Object.fromEntries(welcomeMessageIds),
      selectRepoMessageIds: Object.fromEntries(selectRepoMessageIds),
    })
  );
}

function saveResultsToFile(guildId, lastMetrics, currentMetrics) {
  results.set(guildId, {
    lastMetrics: lastMetrics,
    currentMetrics: currentMetrics,
  });

  fs.writeFileSync("result.json", JSON.stringify(Object.fromEntries(results)));
}
function loadResultsFromFile() {
  if (fs.existsSync(resultFile)) {
    const content = fs.readFileSync(resultFile, "utf-8").trim();
    if (!content) {
      console.log("📂 Result file is empty. Initializing with empty maps.");
      return;
    }
    const data = JSON.parse(content);
    results.clear();
    for (const [key, value] of Object.entries(data)) {
      results.set(key, value);
    }
  }
}

function loadStateFromFile() {
  if (fs.existsSync("state.json")) {
    const content = fs.readFileSync(STATE_FILE, "utf-8").trim();

    if (!content) {
      console.log("📂 State file is empty. Initializing with empty maps.");
      return;
    }

    const data = JSON.parse(content);
    onboardingState = new Map(Object.entries(data?.onboardingState || {}));
    stateGuildMap = new Map(Object.entries(data?.stateGuildMap || {}));
    guildRepoData = new Map(Object.entries(data?.guildRepoData || {}));
    welcomeMessageIds = new Map(Object.entries(data?.welcomeMessageIds || {}));
    selectRepoMessageIds = new Map(Object.entries(data?.selectRepoMessageIds || {}));
  }
}

const app = express(); // Initialize Express app

// Start the server
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

const STATE_FILE = "state.json";

const CHANNEL_NAME = "climatecoach";
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const REDIRECT_URI = "http://3.21.231.66:3000/callback";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

const SELECT_REPO_MESSAGE = {
  content: "Please select a repository to connect to.",
  components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_modal")
        .setLabel("Select Repository")
        .setStyle(ButtonStyle.Primary)
    ),
  ],
};
async function setupGuild(guild) {
  loadStateFromFile();
  console.log(`🔧 Setting up guild: ${guild.name}`);

  let channel = guild.channels.cache.find((ch) => ch.name === CHANNEL_NAME && ch.type === 0);

  if (!channel) {
    const owner = await guild.fetchOwner();
    const ownerId = owner.user.id;
    console.log("ownerId! ", ownerId);
    try {
      channel = await guild.channels.create({
        name: CHANNEL_NAME,
        type: 0,
        permissionOverwrites: [
          {
            id: guild.roles.everyone, // Deny access to everyone
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: ownerId,
            allow: [PermissionsBitField.Flags.ViewChannel],
            deny: [PermissionsBitField.Flags.SendMessages],
          },
        ],
      });

      console.log(`#${CHANNEL_NAME} created successfully in ${guild.name}`);
    } catch (error) {
      console.error(`❌ Failed to create #${CHANNEL_NAME} in ${guild.name}:`, error);
      return;
    }
  }

  // Initialize onboarding state
  const guildId = guild.id;

  // Generate a random state value
  // Clean up any existing state(s) for this guild
  for (const [existingState, id] of stateGuildMap.entries()) {
    if (id === guildId) {
      stateGuildMap.delete(existingState);
    }
  }

  if (!welcomeMessageIds.has(guildId)) {
    onboardingState.set(guildId, { authenticated: false, repoSelected: false });
    const state = crypto.randomBytes(16).toString("hex"); // Generates a 32-character hex string
    console.log("State value:", state);
    stateGuildMap.set(state, guildId);
    saveStateToFile();

    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.append("client_id", GITHUB_CLIENT_ID);
    authUrl.searchParams.append("client_secret", GITHUB_CLIENT_SECRET);
    authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.append("scope", "repo");
    authUrl.searchParams.append("state", state); // Set the state here

    const WELCOME_MESSAGE = {
      content: `Hi! To use the bot with your GitHub repository, please authenticate via the link below:
            \n[Connect to GitHub](${authUrl.toString()})`,
      // flags: 1 << 2,
    };

    let welcomeMessage = await channel.send(WELCOME_MESSAGE);
    console.log("actual messageID", welcomeMessage.id);

    console.log(`📩 Sending welcome message to ${guild.name}...`);
    welcomeMessageIds.set(guild.id, welcomeMessage?.id);
    saveStateToFile();
  } else {
    const welcomeMessageId = welcomeMessageIds.get(guildId);
    const welcomeMessage = await channel.messages.fetch(welcomeMessageId);
    if (welcomeMessage && onboardingState.get(guildId)?.authenticated === true) {
      await welcomeMessage.edit("Authentication successful! 🎉");
    } else {
      console.error("Failed to fetch the message.");
    }
    let selectRepoMessage;
    if (
      !selectRepoMessageIds.has(guildId) &&
      onboardingState.get(guildId)?.authenticated === true
    ) {
      selectRepoMessage = await channel.send(SELECT_REPO_MESSAGE);
      selectRepoMessageIds.set(guildId, selectRepoMessage.id);
      saveStateToFile();
    }
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  // Iterate through all guilds (servers) the bot is in
  for (const [_, guild] of client.guilds.cache) {
    try {
      await setupGuild(guild);
    } catch (err) {
      console.error(`Error setting up guild ${guild.name}:`, err);
    }
  }
});

// Function to run at 12:30 AM
async function collectAllRepoData() {
  loadStateFromFile();
  for (const guild of client.guilds.cache.values()) {
    const guildId = guild.id;
    const repoData = guildRepoData.get(guildId);
    if (!repoData || !repoData.owner || !repoData.repoName) {
      console.log(`No repository data for ${message.guild.name}. Skipping...`);
      return;
    }
    const lastMetrics = await calculateMetrics(repoData.owner, repoData.repoName, "week", 1);
    const currentMetrics = await calculateMetrics(repoData.owner, repoData.repoName, "week", 0);
    loadResultsFromFile();
    saveResultsToFile(guildId, lastMetrics, currentMetrics);
  }
}

// Function to run at 9:00 AM
async function sendAllRepoData() {
  loadStateFromFile();
  client.guilds.cache.forEach(async (guild) => {
    console.log("guild", guild.name);
    const guildId = guild.id;
    const repoData = guildRepoData.get(guildId);
    if (!repoData || !repoData.owner || !repoData.repoName) {
      console.log(`No repository data for ${guild.name}. Skipping...`);
      return;
    }
    const channel = guild.channels.cache.find((ch) => ch.name === CHANNEL_NAME && ch.isTextBased());
    if (!channel) {
      console.log(`Channel ${CHANNEL_NAME} not found in guild ${guild.name}. Skipping...`);
      return;
    }
    const reportMessages = generateReportMessage(guildId);
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    for (const reportMessage of reportMessages) {
      await channel.send({
        ...reportMessage,
        flags: 1 << 2, // optional: only if you really need it here
      });
      const interval = 500;
      await sleep(interval);
    }
  });
}

// Scheduling the task at 12:30 AM server time
cron.schedule(
  "30 0 * * *",
  async () => {
    console.log("⏰ collecting all report data...");
    await collectAllRepoData();
  },
  {
    timezone: "America/New_York",
  }
);

// Scheduling the task at 9:00 AM server time
cron.schedule(
  "0 9 * * *",
  async () => {
    console.log("⏰ Sending daily message...");
    await sendAllRepoData();
  },
  {
    timezone: "America/New_York",
  }
);

// Handle OAuth callback
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  const guildId = stateGuildMap.get(state);
  stateGuildMap.delete(state);
  saveStateToFile();

  if (!code) {
    return res.send("Error: No code provided.");
  }
  // Log the received code and state for debugging
  console.log("Callback received:");
  console.log("Code:", code);
  console.log("State:", state);

  if (!code) {
    return res.send("Error: No code provided.");
  }

  // Your code to exchange the code for an access token
  try {
    // Use the 'code' to fetch the access token (GitHub API)
    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        scope: "repo",
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const accessToken = response.data.access_token;

    if (!guildId) {
      return;
    }
    res.send("GitHub authentication successful!");
    guildRepoData.set(guildId, { accessToken });
    saveStateToFile();

    // Try to infer guildId from the welcomeMessageIds (you could improve this later)
    const messageId = welcomeMessageIds.get(guildId);
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.find(
      (ch) => ch.name === CHANNEL_NAME && ch.isTextBased()
    );
    // Send the list of repositories back to the user for selection
    const welcomeMessage = await channel.messages.fetch(messageId);
    if (welcomeMessage) {
      await welcomeMessage.edit("Authentication successful! 🎉");
    } else {
      console.error("Failed to fetch the message.");
    }

    if (channel) {
      const guildId = channel.guildId;
      onboardingState.set(guildId, {
        authenticated: true,
        repoSelected: false,
      });
      saveStateToFile();
    }
    if (!selectRepoMessageIds.has(guildId)) {
      console.log("No select repo message found, sending a new one...");
      const selectRepoMessage = await channel.send(SELECT_REPO_MESSAGE);
      selectRepoMessageIds.set(guildId, selectRepoMessage.id);
      saveStateToFile();
    }
  } catch (error) {
    console.error("Error during token exchange:", error);
    return;
  }
});

// Fetch repository data from GitHub
async function fetchRepoData(owner, repoName, token) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching repository data:", error);
    return { error: "Failed to fetch repository data." };
  }
}

function extractRepoDetails(repoUrl) {
  // Remove "https://github.com/" part and split the remaining URL by "/"
  const parts = repoUrl.replace("https://github.com/", "").split("/");

  // Ensure the URL is correctly formatted (i.e., has 2 parts)
  if (parts.length !== 2) {
    throw new Error(
      "Invalid repository URL. It should be in the format 'https://github.com/owner/repo-name'."
    );
  }
  const owner = parts[0];
  const repoName = parts[1];

  return { owner, repoName };
}

client.on("interactionCreate", async (interaction) => {
  if (interaction.commandName) {
    if (interaction.commandName === "report") {
      // await interaction.reply("Hello, World!");
      const repoData = guildRepoData.get(interaction.guild.id); // Get repo data for the guild
      if (!repoData || !repoData.owner || !repoData.repoName) {
        console.log(`No repository data for ${interaction.guild.name}. Skipping...`);
        return interaction.reply(
          "No repository data found. Please authenticate/link a GitHub repository first."
        );
      }
      await interaction.reply("Generating report...");
      const reportMessages = generateReportMessage(interaction.guild.id);

      for (const reportMessage of reportMessages) {
        await interaction.channel.send({
          ...reportMessage,
          flags: 1 << 2, // optional: only if you really need it here
        });
        const interval = 500;
        await sleep(interval);
      }
    } else if ((interaction.commandName = "calculate-metrics")) {
      const guildId = interaction.guild.id;
      const repoData = guildRepoData.get(guildId);
      if (!repoData || !repoData.owner || !repoData.repoName) {
        console.log(`No repository data for ${interaction.guild.name}. Skipping...`);
        interaction.reply(
          "Please authenticate + connect to a repository before running `/calculate-metrics`!"
        );
        return;
      }
      let calculatingMetrics = await interaction.reply(
        "*Calculating metrics... (May take a few minutes)*"
      );
      console.log("Calculating last metrics...");
      const lastMetrics = await calculateMetrics(repoData.owner, repoData.repoName, "week", 1);
      console.log("Calculating current metrics...");
      const currentMetrics = await calculateMetrics(repoData.owner, repoData.repoName, "week", 0);
      loadResultsFromFile();
      saveResultsToFile(guildId, lastMetrics, currentMetrics);
      console.log("Metrics calculated and saved!");
      await calculatingMetrics.edit("Metrics calculated! 🎉 Run `/report` to view them.");
    } else if (interaction.commandName === "help") {
      const helpMessage = `**Commands:**
      \`/report\` - Generate a report for the connected GitHub repository.
      \`/calculate-metrics\` - Calculate the metrics for the connected GitHub repository.
      \`/configure\` - Configure the bot settings for your server, including authenticating, connecting to a repository, and the time interval used when fetching metrics.
      \`/disconnect\` - Disconnect the bot from the server.
      \`/help\` - Get help with using the bot and its commands.`;
      await interaction.reply(helpMessage);
    } else if (interaction.commandName === "disconnect") {
      const guildId = interaction.guild.id;
      // Clear all stored data for the guild
      guildRepoData.delete(guildId);
      onboardingState.delete(guildId);
      welcomeMessageIds.delete(guildId);
      selectRepoMessageIds.delete(guildId);
      stateGuildMap.delete(guildId);
      saveStateToFile();
      // Unpin and delete all pinned messages in the channel
      const channel = interaction.channel;
      if (channel && channel.isTextBased()) {
        const pinnedMessages = await channel.messages.fetchPinned();
        console.log("pinnedMessages", pinnedMessages);
        for (const [_, pinnedMessage] of pinnedMessages) {
          await pinnedMessage.unpin();
          await pinnedMessage.delete();
        }
      }

      await interaction.reply(
        "The bot has been disconnected from this server. All data has been cleared."
      );
      await interaction.channel.send("Please run `/configure` to reconnect.");
    } else if (interaction.commandName === "configure") {
      if (interaction.options.getString() === "repository") {
        const repoUrl = interaction.options.getString("url");
        try {
          const { owner, repoName } = extractRepoDetails(repoUrl);
          if (!owner || !repoName) {
            return interaction.reply({
              content: "Invalid repository format. Please enter it as `owner/repo-name`.",
              ephemeral: true,
            });
          }
          const guildId = interaction.guild.id;
          if (!guildRepoData.has(guildId)) {
            guildRepoData.set(guildId, {});
          }

          guildRepoData.get(guildId).owner = owner;
          guildRepoData.get(guildId).repoName = repoName;

          onboardingState.set(guildId, { authenticated: true, repoSelected: true });
          saveStateToFile();

          await interaction.reply(`Repository successfully set to: \`${owner}/${repoName}\` 🔗`);

          // Fetch data from GitHub API
          const { accessToken } = guildRepoData.get(guildId);
          const repoData = await fetchRepoData(owner, repoName, accessToken);
          console.log("Repository data fetched:", repoData);
        } catch (error) {
          console.error("Error processing repository URL:", error);
          return interaction.reply({
            content: "An error occurred while processing the repository URL.",
            ephemeral: true,
          });
        }
      } else if (interaction.options.getString() === "interval") {
        const interval = interaction.options.getString("interval");

        if (interval) {
          // Update the interval for the guild
          // onboardingState.set(interaction.guild.id, { interval });
          // saveStateToFile();
          await interaction.reply(`Interval successfully set to: \`${interval}\``);
        } else {
          await interaction.reply("Please provide a valid interval -- `week` or `day`");
        }
      } else if (interaction.options.getString() === "authenticate") {
        setupGuild(interaction.guild);
      }
    }
  }

  if (interaction.customId === "open_modal") {
    const modal = new ModalBuilder()
      .setCustomId("repo_modal")
      .setTitle("GitHub Repository")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("repo_input")
            .setLabel("Enter your GitHub Repository URL")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g., https://github.com/organization/repository-name")
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "repo_modal") {
      console.log("not here");
      const repoUrl = interaction.fields.getTextInputValue("repo_input");

      const { owner, repoName } = extractRepoDetails(repoUrl);

      if (!owner || !repoName) {
        return interaction.reply({
          content: "Invalid repository format. Please enter it as `owner/repo-name`.",
          ephemeral: true,
        });
      }

      // Store the repository for the guild
      const guildId = interaction.guild.id;
      if (!guildRepoData.has(guildId)) {
        guildRepoData.set(guildId, {});
      }

      guildRepoData.get(guildId).owner = owner;
      guildRepoData.get(guildId).repoName = repoName;

      await interaction.update({
        content: `Repository successfully set to: \`${owner}/${repoName}\`  🔗`,
        components: [],
      });
      const updatedMessage = await interaction.channel.messages.fetch(interaction.message.id);
      await updatedMessage.pin();
      // await interaction.channel.send({
      //   content: `Repository successfully set to: ${owner}/${repoName} 🔗`,
      //   ephemeral: true,
      // });

      onboardingState.set(guildId, { authenticated: true, repoSelected: true });
      saveStateToFile();

      // Fetch data from GitHub API
      try {
        const { accessToken } = guildRepoData.get(guildId);
        console.log("accessToken???", accessToken);
        const repoData = await fetchRepoData(owner, repoName, accessToken);
        console.log("Repository data:", repoData !== null);
      } catch (error) {
        console.error("Error fetching repository data:", error);
      }
    }
  }
});

client.on("guildCreate", async (guild) => {
  console.log(`📥 Joined new guild: ${guild.name}`);
  await setupGuild(guild);
});

client.on("channelDelete", async (channel) => {
  if (channel.name === CHANNEL_NAME && channel.guild) {
    console.log(`#${CHANNEL_NAME} was deleted in ${channel.guild.name}, re-running setup...`);
    try {
      guildRepoData.delete(channel.guild.id);
      onboardingState.delete(channel.guild.id);
      welcomeMessageIds.delete(channel.guild.id);
      selectRepoMessageIds.delete(channel.guild.id);
      stateGuildMap.delete(channel.guild.id);
      saveStateToFile();
      await setupGuild(channel.guild);
    } catch (err) {
      console.error(`Error re-setting up guild after channel deletion:`, err);
    }
  }
});

loadStateFromFile();
client.login(DISCORD_TOKEN);

// Call the function to register the slash command
registerSlashCommands();
