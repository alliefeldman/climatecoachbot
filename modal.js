import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

// In your interactionCreate handler
if (interaction.isButton() && interaction.customId === 'link_repo') {
  const modal = new ModalBuilder()
    .setCustomId('repo_modal')
    .setTitle('Link GitHub Repository');

  const repoInput = new TextInputBuilder()
    .setCustomId('repo_input')
    .setLabel("Enter repository (owner/repo)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const firstActionRow = new ActionRowBuilder().addComponents(repoInput);
  modal.addComponents(firstActionRow);

  await interaction.showModal(modal);
}

if (interaction.isModalSubmit() && interaction.customId === 'repo_modal') {
  const repo = interaction.fields.getTextInputValue('repo_input');

  // Validate and respond
  await interaction.reply(`🔗 You entered: ${repo}`);
}
