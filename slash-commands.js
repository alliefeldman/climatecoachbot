import "dotenv/config";
// const fetch = require("node-fetch"); // Import fetch for making HTTP requests

// Replace with your bot's application ID and token
const APP_ID = process.env.APP_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// URL for global slash commands
const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

// Example slash command payload
const commandPayloads = [
  {
    name: "calculate-metrics",
    type: 1, // Type 1 is for CHAT_INPUT (slash command)
    description: "Calculate the metrics for the connected GitHub repository",
  },
  {
    name: "report",
    type: 1, // Type 1 is for CHAT_INPUT (slash command)
    description:
      "Generate a report for the connected GitHub repository using the most recent metrics",
  },
  {
    name: "help",
    type: 1, // Type 1 is for CHAT_INPUT (slash command)
    description: "Get help with using the bot and its commands",
  },
  {
    name: "configure",
    type: 1, // Type 1 is for CHAT_INPUT (slash command)
    description: "Configure a few bot settings for your server",
    options: [
      {
        name: "authenticate",
        description: "Authenticate the bot with your GitHub account",
        type: 1, // SUB_COMMAND (no extra options)
      },
      {
        name: "repository",
        description: "Set the GitHub repository to connect to",
        type: 1, // SUB_COMMAND (with options)
        options: [
          {
            name: "repo-url",
            description: "GitHub repository URL",
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: "interval",
        description: "Set the interval at which to aggregate/send metrics",
        type: 1, // SUB_COMMAND (with options)
        options: [
          {
            name: "interval-time",
            description: "Interval in minutes",
            type: 3, // STRING (e.g., "daily", "weekly")
            required: false,
          },
        ],
      },
    ],
  },
  {
    name: "disconnect",
    type: 1, // Type 1 is for CHAT_INPUT (slash command)
    description: "Disconnect the bot from the server",
  },
];

// Make a POST request to Discord API to register the command
// Function to register all slash commands
export const registerSlashCommands = async () => {
  for (let commandPayload of commandPayloads) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commandPayload),
    });

    if (response.ok) {
      console.log(`Successfully registered the slash command: ${commandPayload.name}`);
    } else {
      console.error(
        `Error registering command ${commandPayload.name}: ${response.status} - ${response.statusText}`
      );
    }
  }
  console.log("All slash commands registered successfully!");
};
