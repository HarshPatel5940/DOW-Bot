import { Colors, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../interface';
import type { DiscordUser, UserRankTypes } from '../types';
import db from '../utils/database';

export default {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Buscar perfil de usuários')
    .setDMPermission(false)
    .addUserOption(option =>
      option
        .setName('usuário')
        .setDescription('O usuário alvo')
        .setRequired(false),
    ) as SlashCommandBuilder,

  async execute(interaction) {
    const user = interaction.options.getUser('usuário') || interaction.user;

    await interaction.deferReply({ ephemeral: false });

    const userRecord = await (await db())
      .collection<DiscordUser>('discord-users')
      .findOne({ userId: user.id });

    if (!userRecord) {
      await interaction.editReply({
        content: `O usuário ${user.username} não foi encontrado no banco de dados.`,
      });
      return;
    }

    await interaction.editReply({
      content: `Verificando rank de <@${userRecord.userId}>...`,
    });

    const userScore = userRecord.InGameScore;
    const userRank: UserRankTypes = userRecord.InGameRank;

    const embed = new EmbedBuilder()
      .setTitle(`Rank de ${userRecord.InGameUsername}`)
      .setDescription(
        `Nome de usuário: ${userRecord.InGameUsername} - <@${userRecord.userId}>\n` +
          `Pontos: ${userScore}\n` +
          `Rank: ${userRank}`,
      )
      .setColor(Colors.Blurple)
      .setTimestamp()
      .setFooter({ text: 'Rank de usuário' })
      .addFields([
        {
          name: 'Jogos Jogados',
          value: `${userRecord.GamesDraw}`,
          inline: true,
        },
        {
          name: 'Vitórias',
          value: `${userRecord.GamesWin}`,
          inline: true,
        },
        {
          name: 'Derrotas',
          value: `${userRecord.GamesLose}`,
          inline: true,
        },
      ]);

    await interaction.editReply({
      embeds: [embed],
      content: `Rank de <@${userRecord.userId}>`,
    });
    return;
  },
} as Command;
