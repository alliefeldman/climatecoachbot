// client.js
import { Client, GatewayIntentBits } from "discord.js";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // To access the content of the messages
    GatewayIntentBits.GuildMembers,
  ],
});
