import "dotenv/config";
import { Client, GatewayIntentBits, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import axios from "axios";
import express from "express"; // Import Express
import crypto from 'crypto';
import { URL } from 'url';
import cron from "node-cron";
import { getActiveContributors } from "./active-contributors.js"
import fs from 'fs';
import { fetchGitHubData } from "./github-helpers.js"
import { calculateMetrics } from "./calculate-metrics.js"
import { Octokit } from "@octokit/rest";

export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

function saveStateToFile() {
  fs.writeFileSync('state.json', JSON.stringify({
    onboardingState: Object.fromEntries(onboardingState),
    usersRepoData: Object.fromEntries(usersRepoData),
  }));
}

function loadStateFromFile() {
  if (fs.existsSync('state.json')) {
    const content = fs.readFileSync(STATE_FILE, "utf-8").trim();

    if (!content) {
      console.log("📂 State file is empty. Initializing with empty maps.");
      return;
    }

    const data = JSON.parse(content);
    onboardingState = new Map(Object.entries(data.onboardingState));
    usersRepoData = new Map(Object.entries(data.usersRepoData));
  }
}


const app = express(); // Initialize Express app

// Start the server
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});




const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,    // To access the content of the messages
  GatewayIntentBits.GuildMembers],
});

const STATE_FILE = "state.json";

const CHANNEL_NAME = "climatecoach";
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const REDIRECT_URI = "http://3.21.231.66:3000/callback";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
let usersRepoData = new Map();
let onboardingState = new Map(); // guildId -> { authenticated: boolean, repoSelected: boolean }
let messageIds = new Map(); // guildID ->

// Generate a random state value
const state = crypto.randomBytes(16).toString('hex');  // Generates a 32-character hex string



const authUrl = new URL("https://github.com/login/oauth/authorize");
authUrl.searchParams.append('client_id', GITHUB_CLIENT_ID);
authUrl.searchParams.append("client_secret", GITHUB_CLIENT_SECRET);
authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
authUrl.searchParams.append('scope', 'repo');
authUrl.searchParams.append('state', state); // Set the state here

const WELCOME_MESSAGE = `Hi! To use the bot with your GitHub repository, please authenticate via the link below:
            \n\n[Connect to GitHub](${authUrl.toString()})`;

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Iterate through all guilds (servers) the bot is in
  client.guilds.cache.forEach(async (guild) => {
    let channel = guild.channels.cache.find(ch => ch.name === CHANNEL_NAME && ch.type === 0);

    if (!channel) {
      console.log(`Creating #${CHANNEL_NAME} in ${guild.name}...`);

      try {
        channel = await guild.channels.create({
          name: CHANNEL_NAME,
          type: 0, // Text channel
          permissionOverwrites: [
            {
              id: guild.id, // @everyone role
              deny: [PermissionsBitField.Flags.SendMessages],
            },
            {
              id: client.user.id, // Bot itself
              allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel],
            },
          ],
        });

        console.log(`#${CHANNEL_NAME} created successfully!`);

      } catch (error) {
        console.error(`Failed to create #${CHANNEL_NAME}:`, error);
      }
    } else {
      console.log(`#${CHANNEL_NAME} already exists in ${guild.name}.`);
    }

    const guildId = guild.id;
    const onboarding = onboardingState.get(guildId) || {
      authenticated: false,
      repoSelected: false,
    };

    let sentMessage;

    if (!onboarding.authenticated) {
      sentMessage = await channel.send(WELCOME_MESSAGE);
    } else if (onboarding.authenticated && !onboarding.repoSelected) {
      // You already have accessToken for this guild, so use that to fetch repos
      await channel.send({
        content: "Please select a repository to connect to.",
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('open_modal')
              .setLabel('Select Repository')
              .setStyle(ButtonStyle.Primary)
          ),
        ],
      });

    }

    if (sentMessage) {
      messageIds.set(state, sentMessage.id);
    }

  });
});

// Every 5 minutes
cron.schedule("*/65 * * * *", async () => {
  console.log("⏰ Sending daily message...");

  client.guilds.cache.forEach(async (guild) => {
    try {
      const channel = guild.channels.cache.find(
        (ch) => ch.name === CHANNEL_NAME && ch.isTextBased()
      );
      console.log("does it get here");
      if (!channel) return;
      await channel.send("🌅 Good morning! Here's your daily update.");

      const repoData = usersRepoData.get(guild.id); // Get repo data for the guild
      if (!repoData || !repoData.owner || !repoData.repoName) {
        console.log(`No repository data for ${guild.name}. Skipping...`);
        return;
      }
      const activeContributors = await getActiveContributors(repoData.owner, repoData.repoName, repoData.accessToken);
      channel.send(`📝 Active contributors in the past week: ${activeContributors}`);
      console.log(`✅ Sent to ${guild.name} (${channel.name})`);

    } catch (err) {
      console.error(`❌ Error in ${guild.name}:`, err);
    }
  });
});

// Handle OAuth callback
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

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
    res.send("GitHub authentication successful!");

    const authState = req.query.state;
    usersRepoData.set(authState, { accessToken });

    // Try to infer guildId from the messageIds (you could improve this later)
    const messageId = messageIds.get(authState);
    const channel = client.channels.cache.find(ch => ch.name === CHANNEL_NAME && ch.isTextBased());


    // Send the list of repositories back to the user for selection    // const repoSelectionMessage = `✅ GitHub authentication successful! 🎉 Please select a repository to connect to: \n\n${repoList.join("\n")}`;
    const welcomeMessage = await channel.messages.fetch(messageId);
    await welcomeMessage.edit("Authentication successful! 🎉")

    if (channel) {
      const guildId = channel.guildId;
      onboardingState.set(guildId, { authenticated: true, repoSelected: false });
      saveStateToFile();
    }

    await channel.send({
      content: "Please select a repository to connect to.",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('open_modal')
            .setLabel('Select Repository')
            .setStyle(ButtonStyle.Primary)
        ),
      ],
    });
    // You can store the access token for the user here, then proceed with additional logic

  } catch (error) {
    console.error("Error during token exchange:", error);
    res.send("Error authenticating with GitHub.");
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
      const repoData = usersRepoData.get(message.guild.id); // Get repo data for the guild
      if (!repoData || !repoData.owner || !repoData.repoName) {
        console.log(`No repository data for ${message.guild.name}. Skipping...`);
        return message.reply("No repository data found. Please link a GitHub repository first.");
      }
      const githubData = await fetchGitHubData(repoData.owner, repoData.repoName);

      console.log("githubData issues length = ", typeof githubData.issues);
      const metrics = await calculateMetrics(
        githubData.repo,
        "issue",
        Array(repoData.issues),
        repoData.issueComments,
        octokit
      );
      // const metrics = await calculateMetrics(
      //    githubData.repo,
      //   issues: githubData.issues,
      //   prs: githubData.prs,
      //   issueComments: githubData.issueComments,
      //   prComments: githubData.prComments,
      // );

      await message.channel.send("metrics: ", metrics.toString());
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
    if (usersRepoData.has(message.author.id) && !usersRepoData.get(message.author.id).repoName) {
      message.reply("Great! Please provide the GitHub repository you'd like to connect to (e.g., 'owner/repo-name').");
    }

    // User provides repository name
    if (message.content.includes("/")) {
      const [owner, repoName] = message.content.split("/");

      if (usersRepoData.has(message.author.id)) {
        usersRepoData.get(message.author.id).repoName = repoName;
        usersRepoData.get(message.author.id).owner = owner;

        // Store the token (usually securely in a database)
        message.reply(`You have successfully connected to the repository: ${owner}/${repoName}`);
        console.log(`User connected to repository: ${owner}/${repoName}`);

        // Example: Fetch repository data using the GitHub API
        const { accessToken } = usersRepoData.get(message.author.id);
        const repoData = await fetchRepoData(owner, repoName, accessToken);
        message.reply(`Repository Data: ${JSON.stringify(repoData)}`);
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
  if (interaction.customId === 'open_modal') {
    const modal = new ModalBuilder()
      .setCustomId('repo_modal')
      .setTitle('GitHub Repository')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('repo_input')
            .setLabel('Enter your GitHub Repository URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., https://github.com/organization/repository-name')
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    console.log("here");
    if (interaction.customId === 'repo_modal') {
      console.log("not here");
      const repoUrl = interaction.fields.getTextInputValue('repo_input');

      const { owner, repoName } = extractRepoDetails(repoUrl);

      if (!owner || !repoName) {
        return interaction.reply({ content: "Invalid repository format. Please enter it as `owner/repo-name`.", ephemeral: true });
      }

      // Store the repository for the guild
      const guildId = interaction.guild.id;
      if (!usersRepoData.has(guildId)) {
        usersRepoData.set(guildId, {});
      }

      usersRepoData.get(guildId).owner = owner;
      usersRepoData.get(guildId).repoName = repoName;
      await interaction.reply({ content: `Repository successfully set to: ${owner}/${repoName}`, ephemeral: true });

      onboardingState.set(guildId, { authenticated: true, repoSelected: true });
      saveStateToFile();



      // Fetch data from GitHub API
      try {
        const { accessToken } = usersRepoData.get(guildId);
        const repoData = await fetchRepoData(owner, repoName, accessToken);
        console.log("Repository data:", repoData);
      } catch (error) {
        console.error("Error fetching repository data:", error);
      }
    }

  }

});

loadStateFromFile();
client.login(process.env.DISCORD_TOKEN);