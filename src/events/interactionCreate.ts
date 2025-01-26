import { type Collection, Events, type Interaction } from 'discord.js';
import type { Command } from '../interface';

export default {
  name: Events.InteractionCreate,
  once: false,

  async execute(
    interaction: Interaction,
    commands: Collection<string, Command>,
  ) {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        console.log('Command not found here', commands);
        await interaction.reply({
          content: 'Command not found',
          ephemeral: true,
        });
        return;
      }

      try {
        command.execute(interaction);
      } catch (err) {
        console.error(err);
        await interaction.reply({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      }
    } else if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        console.log('Command not found here', commands);
        return;
      }
      try {
        if (!command.autocomplete) {
          console.error('noob');
          return;
        }
        command.autocomplete(interaction);
      } catch (err) {
        console.error(err);
        return;
      }
    }
  },
};
