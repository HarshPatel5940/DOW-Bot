import { Colors, EmbedBuilder, Events, type Interaction } from 'discord.js';
import type { MatchType, PlayerType } from '../types/match';
import db from '../utils/database';

export default {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.guild) return;
    if (!interaction.message) return;
    if (!interaction.customId.startsWith('game-abort-')) return;
    await interaction.deferReply({ ephemeral: false });

    const splitedInteractionValues = interaction.customId.split('-');
    const GameID = splitedInteractionValues[2];
    if (!GameID) return;

    await interaction.editReply({
      content: `Abortando o jogo: ${GameID}`,
    });

    const matchData = await (await db())
      .collection<MatchType>('games')
      .findOne({ matchId: GameID });
    if (!matchData) {
      await interaction.editReply({
        content: 'Jogo não encontrado.',
      });
      await interaction.message.delete();
      return;
    }

    const isUserPartOfMatch = matchData.matchPlayers.some(
      (player: PlayerType) => player.PlayerID === interaction.user.id,
    );

    if (!isUserPartOfMatch) {
      await interaction.editReply({
        content: `<@${interaction.user.id}> Você não faz parte deste jogo.`,
      });
      return;
    }

    const updatedMatchData = await (await db())
      .collection<MatchType>('games')
      .findOneAndUpdate(
        { matchId: GameID },
        {
          isAborted: true,
        },
        { returnDocument: 'after' },
      );

    if (!updatedMatchData) {
      await interaction.editReply({
        content:
          'Erro ao atualizar o jogo. Entre em contato com o desenvolvedor',
      });
      return;
    }

    if (!updatedMatchData.isDraw) {
      await interaction.editReply({
        content: 'algo deu errado! O jogo já está....',
      });
    }

    let prevEmbed = interaction.message.embeds;

    if (!prevEmbed) {
      prevEmbed = [];
    }

    const newEmbed = new EmbedBuilder()
      .setTitle(prevEmbed[0]?.title || '')
      .setDescription(
        `Jogo abortado por by <@${interaction.user.id}>!\n> GameID: \`${GameID}\``,
      )
      .setColor(Colors.Red);

    await interaction.message.edit({
      content: `Jogo abortado por <@${interaction.user.id}>`,
      embeds: [newEmbed],
      components: [],
    });

    return;
  },
};
