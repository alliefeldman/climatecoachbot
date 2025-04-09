import 'dotenv/config';
import axios from "axios";

export async function DiscordRequest(endpoint, options) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);
  // Use fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
    },
    ...options
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

export async function InstallGlobalCommands(appId, commands) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

// Simple method that returns a random emoji from list
export function getRandomEmoji() {
  const emojiList = ['😭', '😄', '😌', '🤓', '😎', '😤', '🤖', '😶‍🌫️', '🌏', '📸', '💿', '👋', '🌊', '✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


// Function to fetch the contributors for a given repository
export async function fetchContributors(owner, repoName, token) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repoName}/contributors`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching contributors:", error);
    return [];
  }
}

// Function to get active contributors in the past week
export async function getActiveContributors(owner, repoName, token) {
  console.log("active contributors start");
  const contributors = await fetchContributors(owner, repoName, token);

  // Now fetch the commit data for each contributor for the past week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7); // Date for one week ago

  let activeContributors = 0;

  for (const contributor of contributors) {
    // Fetch commits made by this contributor in the past week
    const commits = await fetchCommits(owner, repoName, contributor.login, oneWeekAgo, token);

    // If there are commits, count this contributor as active
    if (commits.length > 0) {
      activeContributors++;
    }
  }

  return activeContributors;
}