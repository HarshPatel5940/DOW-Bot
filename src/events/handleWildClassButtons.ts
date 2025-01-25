import { Events, type Interaction } from "discord.js";
import type { MatchType, PlayerType, wildCardClassType } from "../types/match";
import db from "../utils/database";

export default {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.guild) return;

    const customId = interaction.customId;
    if (!customId.startsWith("game-")) return;

    const [, wildCardClass, GameID] = customId.split("-");
    if (!wildCardClass || !GameID) return;
    if (!["gypsy", "stalker", "sniper"].includes(wildCardClass)) return;

    await interaction.deferReply({ ephemeral: true });

    const matchData = await (await db())
      .collection<MatchType>("games")
      .findOne({ matchId: GameID });

    if (!matchData) {
      await interaction.editReply({
        content: "Jogo não encontrado.",
      });
      return;
    }

    if (matchData.isAborted) {
      await interaction.editReply({
        content: "Jogo abortado.",
      });
      return;
    }

    if (matchData.isCompleted) {
      await interaction.editReply({
        content: "Jogo finalizado.",
      });
      return;
    }

    const updatedPlayerData = matchData.matchPlayers.map(
      (player: PlayerType) => {
        if (player.PlayerID === interaction.user.id) {
          return {
            ...player,
            wildCardClass: wildCardClass as wildCardClassType,
          };
        }
        return player;
      },
    );

    const updatedRPlayerData = matchData.redTeam.map((player: PlayerType) => {
      if (player.PlayerID === interaction.user.id) {
        return {
          ...player,
          wildCardClass: wildCardClass as wildCardClassType,
        };
      }
      return player;
    });

    const updatedBPlayerData = matchData.blueTeam.map((player: PlayerType) => {
      if (player.PlayerID === interaction.user.id) {
        return {
          ...player,
          wildCardClass: wildCardClass as wildCardClassType,
        };
      }
      return player;
    });

    const updatedMatchData = await (await db())
      .collection<MatchType>("games")
      .updateOne(
        { matchId: GameID },
        {
          $set: {
            matchPlayers: updatedPlayerData,
            redTeam: updatedRPlayerData,
            blueTeam: updatedBPlayerData,
          },
        },
      );

    if (updatedMatchData.modifiedCount === 0) {
      await interaction.editReply({
        content: "Erro ao atualizar o jogo.",
      });
      return;
    }

    await interaction.editReply({
      content: `Você escolheu a classe Wild Card: ${wildCardClass}`,
    });
  },
};
