// register-commands.js — Run once after deploy or whenever command shape changes.
// Registers the /seek slash command to the configured guild.

import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const command = new SlashCommandBuilder()
  .setName('seek')
  .setDescription('Seek the sovereign key for an accord. Provide the 8-char prefix from your manifest.')
  .addStringOption(opt =>
    opt.setName('prefix')
       .setDescription('First 8 hex chars of your accord SHA-256 hash')
       .setRequired(true)
       .setMinLength(8)
       .setMaxLength(8)
  )
  .toJSON();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

try {
  await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_APP_ID, process.env.GUILD_ID),
    { body: [command] },
  );
  console.log('OK /seek registered to guild', process.env.GUILD_ID);
} catch (err) {
  console.error('FAIL:', err);
  process.exit(1);
}
