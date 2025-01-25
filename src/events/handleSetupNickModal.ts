import { Events, type Interaction } from 'discord.js';
import type { DiscordUser } from '../types';
import { MyEmojis } from '../types/emojis';
import db from '../utils/database';

export default {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.guild) return;
    if (!interaction.customId.startsWith('add-nickname-')) return;
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.fields.getTextInputValue('add-nick-t');
    try {
      const collection = (await db()).collection<DiscordUser>('discord-users');
      const existingUser = await collection.findOne({
        userId: interaction.user.id,
      });

      let result: unknown;

      if (existingUser) {
        result = await collection.findOneAndUpdate(
          { userId: interaction.user.id },
          { $set: { InGameUsername: name } },
          { returnDocument: 'after' },
        );
      } else {
        result = await collection.insertOne({
          userId: interaction.user.id,
          username: interaction.user.username,
          InGameUsername: name,
          InGameScore: 0,
          InGameRank: 'Ferro1',
          isActive: false,
          GamesPlayed: 0,
          GamesWin: 0,
          GamesLose: 0,
          GamesDraw: 0,
          updatedAt: new Date(),
        });
      }

      if (!result) {
        await interaction.editReply({
          content:
            'Ocorreu um erro ao registrar seu apelido. Por favor, tente novamente.',
        });
        return;
      }

      await interaction.editReply({
        content: `${MyEmojis.Tick} Seu perfil foi ${existingUser ? 'atualizado' : 'registrado'} com sucesso! \nApelido: ${name}`,
      });
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        content:
          'Ocorreu um erro ao registrar seu apelido. Por favor, tente novamente.',
      });
    }
    return;
  },
};
