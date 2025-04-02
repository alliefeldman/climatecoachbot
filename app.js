import "dotenv/config";
import { Client, GatewayIntentBits, PermissionsBitField } from "discord.js";
import axios from "axios";
import express from "express"; // Import Express
import crypto from 'crypto';
import { URL } from 'url';

const app = express(); // Initialize Express app

// Start the server
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
});

const CHANNEL_NAME = "climatecoach";
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const REDIRECT_URI = "http://localhost/callback"; // Adjust this URL based on your OAuth setup
const usersRepoData = new Map();

// Generate a random state value
const state = crypto.randomBytes(16).toString('hex');  // Generates a 32-character hex string

// Construct the OAuth URL
const authUrl = new URL('https://github.com/login/oauth/authorize');
authUrl.searchParams.append('client_id', GITHUB_CLIENT_ID);
authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
authUrl.searchParams.append('scope', 'repo');  // Adjust the scope as necessary
authUrl.searchParams.append('state', state);


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

    // Fetch messages from the channel
    const messages = await channel.messages.fetch({ limit: 1 }); // Fetch the most recent message

    if (messages.size !== 10000) {
      // If there are no messages in the channel, send the welcome message
      channel.send(WELCOME_MESSAGE);
    }
  });


});


// Handle the OAuth callback and repository input
client.on("messageCreate", async (message) => {
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
});

// Handle OAuth callback
app.get("/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.send("Error: No code provided.");
  }

  // Exchange code for access token
  try {
    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      null,
      {
        params: {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: process.env.REDIRECT_URI,
        },
        headers: {
          Accept: "application/json",
        },
      }
    );

    const accessToken = response.data.access_token;
    res.send("GitHub authentication successful!");

    // Store user's access token for future use
    usersRepoData.set(req.query.state, { accessToken });

  } catch (error) {
    res.send("Error authenticating with GitHub.");
    console.error(error);
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

client.login(process.env.DISCORD_TOKEN);