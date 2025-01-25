import { Events, type Interaction } from 'discord.js';
import { type DiscordUser, type UserRankTypes, UserRanks } from '../types';
import { MyEmojis } from '../types/emojis';
import type { MatchType, PlayerType } from '../types/match';
import db from '../utils/database';

export default {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction: Interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.guild) return;
    if (!interaction.message) return;
    if (!interaction.customId.startsWith('game-win-')) return;
    await interaction.deferReply({ ephemeral: false });

    const interactionValues = interaction.values[0];
    if (!interactionValues) return;
    const splitedInteractionValues = interactionValues.split('-');
    const winnerTeam = splitedInteractionValues[2];
    const GameID = splitedInteractionValues[3];
    if (!winnerTeam || !GameID) return;

    await interaction.editReply({
      content: `Você escolheu o time ${winnerTeam} como vencedor!\ngameID: ${GameID}`,
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
          $set: {
            matchWinner: winnerTeam,
            isDraw: winnerTeam === 'draw',
            isCompleted: true,
          },
        },
        { returnDocument: 'after' },
      );

    if (!updatedMatchData || !updatedMatchData.isCompleted) {
      await interaction.editReply({
        content:
          'Erro ao atualizar o jogo. Entre em contato com o desenvolvedor',
      });
      return;
    }

    let bulkOps = [];

    if (updatedMatchData.isDraw) {
      bulkOps = [
        ...updatedMatchData.matchPlayers.map((player: PlayerType) => ({
          updateOne: {
            filter: { userId: player.PlayerID },
            update: {
              $inc: { InGameScore: 5, GamesPlayed: 1, GamesDraw: 1 },
              $set: { updatedAt: new Date() },
            },
          },
        })),
      ];
    } else {
      const winnerTeamPlayers =
        winnerTeam === 'red'
          ? updatedMatchData.redTeam
          : updatedMatchData.blueTeam;

      const loserTeamPlayers =
        winnerTeam === 'red'
          ? updatedMatchData.blueTeam
          : updatedMatchData.redTeam;

      bulkOps = [
        ...winnerTeamPlayers.map((player: PlayerType) => ({
          updateOne: {
            filter: { userId: player.PlayerID },
            update: {
              $inc: { InGameScore: 20, GamesPlayed: 1, GamesWin: 1 },
              $set: { updatedAt: new Date() },
            },
          },
        })),
        ...loserTeamPlayers.map((player: PlayerType) => ({
          updateOne: {
            filter: { userId: player.PlayerID },
            update: {
              $inc: { InGameScore: -10, GamesPlayed: 1, GamesLose: 1 },
              $set: { updatedAt: new Date() },
            },
          },
        })),
      ];
    }

    const result1 = await (await db())
      .collection<DiscordUser>('discord-users')
      .bulkWrite(bulkOps);

    if (!result1) {
      await interaction.editReply({
        content: 'Erro ao atualizar os pontos dos jogadores.',
      });
      return;
    }

    await interaction.message.edit({
      content: `**O jogo foi concluído!**

        > ${updatedMatchData.isDraw ? 'A partida está empatada' : `A partida foi vencida pela equipe ${winnerTeam}`}  ${MyEmojis.Sparkels}`,
      components: [],
    });

    const allPlayers = updatedMatchData.matchPlayers;
    const userIds = allPlayers.map((player: PlayerType) => player.PlayerID);

    const userDocs = await (await db())
      .collection<DiscordUser>('discord-users')
      .find({ userId: { $in: userIds } })
      .toArray();

    const rankUpdateOps = userDocs.map(userDoc => {
      let userRank: UserRankTypes = 'Ferro1';
      const userScore = userDoc.InGameScore || 0;

      for (const [rank, score] of Object.entries(UserRanks)) {
        if (userScore >= score) {
          userRank = rank as UserRankTypes;
        } else {
          break;
        }
      }

      return {
        updateOne: {
          filter: { userId: userDoc.userId },
          update: {
            $set: { InGameRank: userRank },
          },
        },
      };
    });

    if (rankUpdateOps.length > 0) {
      await (await db())
        .collection<DiscordUser>('discord-users')
        .bulkWrite(rankUpdateOps);
    }

    await interaction.editReply({
      content: `**Os pontos e ranks dos jogadores foram atualizados!**! ${MyEmojis.Sparkels}`,
    });

    return;
  },
};
