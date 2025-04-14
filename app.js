import "dotenv/config";
import {
  PermissionsBitField,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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
export const guildLastMetrics = new Map();
export const guildCurrentMetrics = new Map();

const SELECT_REPO_MESSAGE = {
  content: "Please select a repository to connect to.",
  components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("open_modal").setLabel("Select Repository").setStyle(ButtonStyle.Primary)
    ),
  ],
};
async function setupGuild(guild) {
  console.log(`🔧 Setting up guild: ${guild.name}`);

  let channel = guild.channels.cache.find((ch) => ch.name === CHANNEL_NAME && ch.type === 0);

  if (!channel) {
    try {
      channel = await guild.channels.create({
        name: CHANNEL_NAME,
        type: 0,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.SendMessages],
          },
          {
            id: client.user.id,
            allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel],
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

    const WELCOME_MESSAGE = `Hi! To use the bot with your GitHub repository, please authenticate via the link below:
            \n\n[Connect to GitHub](${authUrl.toString()})`;

    let welcomeMessage = await channel.send(WELCOME_MESSAGE);
    console.log("actual messageID", welcomeMessage.id);

    console.log(`📩 Sending welcome message to ${guild.name}...`);
    welcomeMessageIds.set(guild.id, welcomeMessage?.id);
    saveStateToFile();
  } else {
    console.log(`Welcome message already sent in ${guild.name}. so callback....`);
    const welcomeMessageId = welcomeMessageIds.get(guildId);
    // console.log("messageId", welcomeMessageId);
    const welcomeMessage = await channel.messages.fetch(welcomeMessageId);
    if (welcomeMessage) {
      // console.log("Welcome message found:", welcomeMessage.id);
      // console.log("Welcome message content:", welcomeMessage.content);
      await welcomeMessage.edit("Authentication successful! 🎉");
    } else {
      console.error("Failed to fetch the message.");
    }
    let selectRepoMessage;
    if (!selectRepoMessageIds.has(guildId)) {
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
  await user.send("It's 12:30 AM! Running your task now.");
  for (const [guildId, repoData] of guildRepoData) {
    if (!repoData || !repoData.owner || !repoData.repoName) {
      console.log(`No repository data for ${message.guild.name}. Skipping...`);
      continue;
    }
    /// UNCOMMENT TO CALCULATE METRICS
    const lastMetrics = await calculateMetrics(repoData.owner, repoData.repoName, "week", 1);
    const currentMetrics = await calculateMetrics(repoData.owner, repoData.repoName, "week", 0);
    loadResultsFromFile();
    saveResultsToFile(message.guild.id, lastMetrics, currentMetrics);
  }
}

// Function to run at 9:00 AM
async function sendAllRepoData() {
  console.log("ayo????");
  for (const [guildId, repoData] of guildRepoData) {
    console.log("ayo");
    if (!repoData || !repoData.owner || !repoData.repoName) {
      console.log(`No repository data for ${message.guild.name}. Skipping...`);
      continue;
    }
    const channel = client.guilds.cache
      .get(guildId)
      ?.channels.cache.find((ch) => ch.name === CHANNEL_NAME && ch.isTextBased());

    if (!channel) {
      console.log(`Channel ${CHANNEL_NAME} not found in guild ${guildId}. Skipping...`);
      continue;
    }

    const reportMessages = generateReportMessage(guildId);
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    for (const reportMessage of reportMessages) {
      await message.channel.send({
        ...reportMessage,
        flags: 1 << 2, // optional: only if you really need it here
      });
      const interval = 500;
      await sleep(interval);
    }

    // const activeContributors = await getActiveContributors(repoData.owner, repoData.repoName, repoData.accessToken);
    // channel.send(`📝 Active contributors in the past week: ${activeContributors}`);
  }
}

// Scheduling the task at 12:30 AM server time
cron.schedule("30 6 * * *", (user) => collectAllRepoData(user), {
  scheduled: true,
});

// Scheduling the task at 9:00 AM server time

// 0 9 * * *
cron.schedule("0 9 * * *", async () => {
  console.log("⏰ Sending daily message...");
  await sendAllRepoData();
});

// Every 65 minutes
// cron.schedule("*/65 * * * *", async () => {
//   console.log("⏰ Sending daily message...");

//   client.guilds.cache.forEach(async (guild) => {
//     try {
//       const channel = guild.channels.cache.find(
//         (ch) => ch.name === CHANNEL_NAME && ch.isTextBased()
//       );
//       console.log("does it get here");
//       if (!channel) return;
//       await channel.send("🌅 Good morning! Here's your daily update.");

//       const repoData = guildRepoData.get(guild.id); // Get repo data for the guild
//       if (!repoData || !repoData.owner || !repoData.repoName) {
//         console.log(`No repository data for ${guild.name}. Skipping...`);
//         return;
//       }
//       // const activeContributors = await getActiveContributors(repoData.owner, repoData.repoName, repoData.accessToken);
//       // channel.send(`📝 Active contributors in the past week: ${activeContributors}`);
//       // console.log(`✅ Sent to ${guild.name} (${channel.name})`);

//     } catch (err) {
//       console.error(`❌ Error in ${guild.name}:`, err);
//     }
//   });
// });

// Handle OAuth callback
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  console.log("state -> ", state);
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
    console.log("Guild ID:", guildId);
    guildRepoData.set(guildId, { accessToken });
    console.log("Access token is set correctly i hop:", accessToken);
    saveStateToFile();

    // Try to infer guildId from the welcomeMessageIds (you could improve this later)
    const messageId = welcomeMessageIds.get(guildId);
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.find((ch) => ch.name === CHANNEL_NAME && ch.isTextBased());
    // console.log("messageId", messageId);
    // Send the list of repositories back to the user for selection    // const repoSelectionMessage = `✅ GitHub authentication successful! 🎉 Please select a repository to connect to: \n\n${repoList.join("\n")}`;
    const welcomeMessage = await channel.messages.fetch(messageId);
    if (welcomeMessage) {
      console.log("Welcome message found:", welcomeMessage.id);
      console.log("Welcome message content:", welcomeMessage.content);
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
    // You can store the access token for the user here, then proceed with additional logic
  } catch (error) {
    console.error("Error during token exchange:", error);
    return;
    // res.send("Error authenticating with GitHub.");
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
client.on("messageCreate", async (message) => {
  // Avoid bot replying to itself
  if (message.author.bot) return;

  // Check if the message was sent in the correct channel
  if (message.channel.name === "climatecoach") {
    // Example of checking the content of the message
    if (message.content.includes("report")) {
      // If the message contains "help", reply with a help message
      const repoData = guildRepoData.get(message.guild.id); // Get repo data for the guild
      if (!repoData || !repoData.owner || !repoData.repoName) {
        console.log(`No repository data for ${message.guild.name}. Skipping...`);
        return message.reply("No repository data found. Please link a GitHub repository first.");
      }

      /// UNCOMMENT TO CALCULATE METRICS
      const lastMetrics = await calculateMetrics(repoData.owner, repoData.repoName, "week", 1);
      const currentMetrics = await calculateMetrics(repoData.owner, repoData.repoName, "week", 0);
      loadResultsFromFile();
      saveResultsToFile(message.guild.id, lastMetrics, currentMetrics);

      // console.log("metrics obtained and saved!");

      const reportMessages = generateReportMessage(message.guild.id);

      for (const reportMessage of reportMessages) {
        await message.channel.send({
          ...reportMessage,
          flags: 1 << 2, // optional: only if you really need it here
        });
        const interval = 500;
        await sleep(interval);
      }
    } else {
      // Default response for other messages
      console.log("content", message);
      await message.reply("I didn't quite catch that. Can you please provide more details?");
    }
    if (message.content.startsWith("!githubconnect")) {
      // Send the user to authenticate via GitHub OAuth
      message.reply("Please authenticate via the GitHub link sent earlier!");
    }

    // After successful GitHub authentication, prompt user for repository
    if (guildRepoData.has(message.guild.id) && !guildRepoData.get(message.guild.id).repoName) {
      message.reply("Great! Please provide the GitHub repository you'd like to connect to (e.g., 'owner/repo-name').");
    }

    // User provides repository name
    if (message.content.includes("/")) {
      const [owner, repoName] = message.content.split("/");

      if (guildRepoData.has(message.guild.id)) {
        guildRepoData.get(message.guild.id).repoName = repoName;
        guildRepoData.get(message.guild.id).owner = owner;

        // Store the token (usually securely in a database)
        let connectedMessage = await message.update(
          `You have successfully connected to the repository: ${owner}/${repoName}`
        );
        connectedMessage.pin();
        // console.log(`User connected to repository: ${owner}/${repoName}`);

        // Example: Fetch repository data using the GitHub API
        // const { accessToken } = guildRepoData.get(message.guild.id);
        // const repoData = await fetchRepoData(owner, repoName, accessToken);
        // message.reply(`Repository Data: ${JSON.stringify(repoData)}`);
      }
    }
  }
});

function extractRepoDetails(repoUrl) {
  // Remove "https://github.com/" part and split the remaining URL by "/"
  const parts = repoUrl.replace("https://github.com/", "").split("/");

  // Ensure the URL is correctly formatted (i.e., has 2 parts)
  if (parts.length !== 2) {
    throw new Error("Invalid repository URL. It should be in the format 'https://github.com/owner/repo-name'.");
  }

  const owner = parts[0];
  const repoName = parts[1];

  return { owner, repoName };
}

client.on("interactionCreate", async (interaction) => {
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
client.login(process.env.DISCORD_TOKEN);
