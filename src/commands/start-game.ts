import {
  ActionRowBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { ulid } from 'ulid';
import type { Command } from '../interface';
import { MyEmojis } from '../types/emojis';
import { type MatchType, playerClasses, playerClasses2 } from '../types/match';
import db from '../utils/database';

export default {
  data: new SlashCommandBuilder()
    .setName('início-jogo')
    .setDescription('Comece um novo jogo onde todos possam participar')
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    if (!interaction.channel) return;
    if (interaction.channel.type !== ChannelType.GuildText) return;

    await interaction.deferReply({ ephemeral: false });

    const channel = interaction.guild.channels.cache.get(interaction.channelId);
    if (channel?.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Este comando só pode ser utilizado em um canal de texto.',
        ephemeral: true,
      });
      return;
    }

    const matchID = ulid();
    // to future me :D --> This is intentionally left non - awaited
    interaction.editReply({
      content: `O jogo começa em breve! ID do jogo: ${matchID}`,
    });
    const embed = new EmbedBuilder()
      .setTitle(`Novo jogo! ${MyEmojis.Controller}`)
      .setDescription(`${MyEmojis.Sparkels} Escolha uma classe para começar.`)
      .setColor(Colors.Blurple)
      .setFooter({ text: `ID do jogo - ${matchID}` })
      .addFields([
        {
          name: playerClasses2.scholar,
          value: 'Ninguém se juntou ainda',
          inline: true,
        },
        {
          name: playerClasses2.champion,
          value: 'Ninguém se juntou ainda',
          inline: true,
        },
        {
          name: playerClasses2.paladin,
          value: 'Ninguém se juntou ainda',
          inline: true,
        },
        {
          name: playerClasses2.high_priest,
          value: 'Ninguém se juntou ainda',
          inline: true,
        },
        {
          name: playerClasses2.high_wizard,
          value: 'Ninguém se juntou ainda',
          inline: true,
        },
        {
          name: playerClasses2.minstrel,
          value: 'Ninguém se juntou ainda',
          inline: true,
        },
        {
          name: playerClasses2.wildCardClass,
          value: 'Ninguém se juntou ainda',
          inline: true,
        },
        {
          name: 'O jogo começou?',
          value: 'Não',
          inline: false,
        },
      ])
      .setTimestamp();

    const dropdown = new StringSelectMenuBuilder()
      .setCustomId(`game-${matchID}`)
      .setPlaceholder('Escolha uma classe')
      .addOptions([
        {
          label: playerClasses.scholar,
          value: `g-scholar-${matchID}`,
        },
        {
          label: playerClasses.champion,
          value: `g-champion-${matchID}`,
        },
        {
          label: playerClasses.paladin,
          value: `g-paladin-${matchID}`,
        },
        {
          label: playerClasses.high_priest,
          value: `g-high_priest-${matchID}`,
        },
        {
          label: playerClasses.high_wizard,
          value: `g-high_wizard-${matchID}`,
        },
        {
          label: playerClasses.minstrel,
          value: `g-minstrel-${matchID}`,
        },
        {
          label: playerClasses.wildCardClass,
          value: `g-7th-${matchID}`,
        },
      ]);

    const actionRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(dropdown);

    const message = await interaction.channel.send({
      embeds: [embed],
    });

    const match = {
      matchId: matchID,
      matchMsgChannel: interaction.channelId,
      matchMsgId: message.id,

      matchPlayers: [],
      redTeam: [],
      blueTeam: [],

      isStarted: false,
      isAborted: false,
      isDraw: false,
      isCompleted: false,

      updatedAt: new Date(),
    } as MatchType;

    const data = await (await db())
      .collection<MatchType>('games')
      .insertOne(match);

    if (!data.insertedId) {
      await interaction.editReply({
        content: 'Erro ao iniciar o jogo. Tente novamente.',
      });
      await message.delete();
      return;
    }

    await interaction.editReply({
      content: 'Jogo iniciado com sucesso!',
    });

    await message.edit({
      content: `## Jogo iniciado com sucesso! \nEscolha uma classe para começar.\n> ID do jogo - \`${matchID}\``,
      embeds: [embed],
      components: [actionRow],
    });
  },
} as Command;
