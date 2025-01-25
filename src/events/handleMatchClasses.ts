import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  Events,
  type Interaction,
} from 'discord.js';
import type { DiscordUser } from '../types';
import type { MatchType, PlayerClassesType, PlayerType } from '../types/match';
import db from '../utils/database';

export default {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction: Interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.guild) return;
    if (!interaction.message) return;
    if (!interaction.customId.startsWith('game-')) return;
    if (
      interaction.customId.startsWith('game-win-') ||
      interaction.customId.startsWith('game-start-') ||
      interaction.customId.startsWith('game-abort-')
    ) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const interactionValues = interaction.values[0];
    if (!interactionValues) return;
    const splitedInteractionValues = interactionValues.split('-');
    const classSelected = splitedInteractionValues[1] as PlayerClassesType;
    const GameID = splitedInteractionValues[2];
    if (!classSelected || !GameID) return;

    await interaction.editReply({
      content: `Você escolheu a classe ${classSelected}!\ngameID: ${GameID}`,
    });

    const playerData = await (await db())
      .collection<DiscordUser>('discord-users')
      .findOne({ userId: interaction.user.id });

    if (!playerData) {
      await interaction.editReply({
        content: 'Perfil não encontrado! Por favor, registre sua conta.',
      });
      return;
    }

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

    if (matchData.isStarted) {
      await interaction.editReply({
        content: 'O jogo já começou.',
      });
      await interaction.message.edit({ components: [] });
      return;
    }

    if (matchData.matchPlayers.length >= 14) {
      await interaction.editReply({
        content: 'O jogo já está cheio.',
      });
      await interaction.message.edit({ components: [] });
      // TODO: We need to start the game here so show the start button and leave button and abort button (for owner)
      return;
    }

    const classCount = new Map<PlayerClassesType, number>();
    let oldClassofPlayer = '';

    for (const player of matchData.matchPlayers) {
      if (player.PlayerID === interaction.user.id) {
        oldClassofPlayer = player.PlayerClass;
        matchData.matchPlayers = matchData.matchPlayers.filter(
          p => p.PlayerID !== interaction.user.id,
        );
      }
      const count = classCount.get(player.PlayerClass) || 0;
      classCount.set(player.PlayerClass, count + 1);
    }

    if ((classCount.get(classSelected) || 0) >= 2) {
      await interaction.editReply({
        content: 'Classe já escolhida. Por favor, escolha outra classe.',
      });
      return;
    }

    if (classSelected === '7th') {
      const wildCardCount = (classCount.get('7th') || 0) + 1;
      if (wildCardCount > 2) {
        await interaction.editReply({
          content: 'Classe já escolhida. Por favor, escolha outra classe.',
        });
        return;
      }

      const wildCardActionRow =
        new ActionRowBuilder<ButtonBuilder>().addComponents([
          new ButtonBuilder()
            .setCustomId(`game-gypsy-${GameID}`)
            .setLabel('gypsy')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`game-stalker-${GameID}`)
            .setLabel('stalker')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`game-sniper-${GameID}`)
            .setLabel('sniper')
            .setStyle(ButtonStyle.Secondary),
        ]);

      interaction.followUp({
        content: 'Escolha uma das classes Wild Card abaixo',
        ephemeral: true,
        components: [wildCardActionRow],
      });
    }

    const player = {
      PlayerClass: classSelected,
      PlayerID: interaction.user.id,
      PlayerName: playerData.InGameUsername,
    } as PlayerType;

    matchData.matchPlayers.push(player);

    const updatedMatchData = await (await db())
      .collection<MatchType>('games')
      .updateOne(
        {
          matchId: GameID,
        },
        {
          $set: {
            matchPlayers: matchData.matchPlayers,
            updatedAt: new Date(),
          },
        },
      );

    if (updatedMatchData.modifiedCount === 0) {
      await interaction.editReply({
        content: 'Erro ao atualizar o jogo.',
      });
      return;
    }

    await interaction.editReply({
      content: `Você foi adicionado à **classe ${classSelected}**.\nVamos esperar até que todos entrem no jogo - \`${GameID}\``,
    });

    const oldEmbed = interaction.message.embeds[0];
    if (!oldEmbed) {
      await interaction.editReply({
        content: 'Erro ao atualizar o jogo.',
      });
      return;
    }

    let newEmbedFields = oldEmbed.fields;
    newEmbedFields = newEmbedFields.map(field => {
      if (field.name.toLowerCase() === oldClassofPlayer.replace('_', ' ')) {
        const tClass = field.name
          .toLowerCase()
          .replace(' ', '_') as PlayerClassesType;

        if (classCount.get(tClass) === 1) {
          field.value = 'Ninguém se juntou ainda';
        } else {
          field.value = field.value.replace(
            `- ${interaction.user.username}\n`,
            '',
          );
        }
      }

      if (field.name.toLowerCase() === classSelected.replace('_', ' ')) {
        if (field.value.startsWith('Ninguém')) {
          field.value = '';
        }

        return {
          name: field.name,
          value: `${field.value}- ${interaction.user.username}\n`,
          inline: true,
        };
      }
      return field;
    });

    let newEmbed = new EmbedBuilder()
      .setTitle(oldEmbed.title)
      .setDescription(oldEmbed.description)
      .setColor(oldEmbed.color)
      .setFooter({
        text: oldEmbed.footer?.text || `ID do jogo - ${GameID}`,
      })
      .addFields(newEmbedFields)
      .setTimestamp();

    if (matchData.matchPlayers.length + 1 >= 1) {
      newEmbed = newEmbed.setColor(Colors.Green);
      const startButton = new ButtonBuilder()
        .setCustomId(`game-start-${GameID}`)
        .setLabel('Iniciar Jogo')
        .setStyle(ButtonStyle.Success);

      const abortButton = new ButtonBuilder()
        .setCustomId(`game-abort-${GameID}`)
        .setLabel('Cancelar Jogo')
        .setStyle(ButtonStyle.Danger);

      await interaction.message.edit({
        content: 'O jogo está pronto para começar!',
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents([
            startButton,
            abortButton.setDisabled(true),
          ]),
        ],
        embeds: [newEmbed],
      });
      return;
    }

    await interaction.message.edit({
      embeds: [newEmbed],
    });
    return;
  },
};
