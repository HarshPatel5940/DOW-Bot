import { Colors, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../interface';
import { type DiscordUser, type UserRankTypes, UserRanks } from '../types';
import { MyEmojis } from '../types/emojis';
import db from '../utils/database';

export default {
  data: new SlashCommandBuilder()
    .setName('pontos')
    .setDescription('Adicionar ou remover pontos de um usuário')
    .setDMPermission(false)
    .addStringOption(option =>
      option
        .setName('ação')
        .setDescription('que ação executar?')
        .setRequired(true)
        .addChoices(
          { name: 'Adicionar', value: 'points_add' },
          { name: 'Remover', value: 'points_remove' },
        ),
    )
    .addUserOption(option =>
      option.setName('alvo').setDescription('O usuário alvo').setRequired(true),
    )
    .addNumberOption(option =>
      option
        .setName('pontos')
        .setDescription('O número de pontos a adicionar ou remover')
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction) {
    if (!interaction.guild) return;
    const action = interaction.options.getString('ação');
    const user = interaction.options.getUser('alvo');
    const points = interaction.options.getNumber('pontos');

    if (!action) {
      await interaction.reply({
        content: 'Por favor, selecione uma ação.',
        ephemeral: true,
      });
      return;
    }

    if (!user) {
      await interaction.reply({
        content: 'Por favor, selecione um usuário.',
        ephemeral: true,
      });
      return;
    }

    if (!points) {
      await interaction.reply({
        content: 'Por favor, selecione um número de pontos.',
        ephemeral: true,
      });
      return;
    }

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

    const newPoints =
      action === 'points_add'
        ? userRecord.InGameScore + points
        : Math.max(userRecord.InGameScore - points, 0);

    let newRank: UserRankTypes = 'Ferro1';

    for (const [rank, score] of Object.entries(UserRanks)) {
      if (newPoints >= score) {
        newRank = rank as UserRankTypes;
      } else {
        break;
      }
    }

    const result = await (await db())
      .collection<DiscordUser>('discord-users')
      .updateOne(
        { userId: user.id },
        {
          $set: {
            InGameScore: newPoints,
            InGameRank: newRank,
          },
        },
      );

    if (!result.modifiedCount) {
      await interaction.editReply({
        content: `Ocorreu um erro ao atualizar os pontos de ${user.username}.`,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Pontos atualizados! ${MyEmojis.Sparkels}`)
      .setDescription(
        `Nome de usuário: ${userRecord.InGameUsername} - <@${userRecord.userId}>\nPontos: ${newPoints}\nAção: ${action === 'points_add' ? 'Adicionado' : 'Removido'} ${points} pontos.`,
      )
      .setColor(Colors.Green)
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      content: `Pontos de <@${userRecord.userId}> atualizados com sucesso! Agora ele tem ${newPoints} pontos.`,
    });
    return;
  },
} as Command;
