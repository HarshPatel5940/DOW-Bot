import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type SlashCommandChannelOption,
} from 'discord.js';
import type { Command } from '../interface';

export default {
  data: new SlashCommandBuilder()
    .setName('configurar-conta')
    .setDescription('Configure sua conta para jogar os jogos')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option: SlashCommandChannelOption) => {
      return option
        .setName('canal')
        .setDescription('Selecione um canal para configurar o painel da conta.')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
    }),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    await interaction.deferReply({ ephemeral: false });
    const channelId = (interaction.options.getChannel('channel')?.id ||
      interaction.channelId) as string;
    const channel = interaction.guild.channels.cache.get(channelId);
    if (channel?.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Este comando só pode ser utilizado em um canal de texto.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Configuração da conta')
      .setDescription('Vamos começar registrando seu nome de usuário')
      .setColor('Green')
      .setTimestamp();

    const Buttons = [
      new ButtonBuilder()
        .setCustomId('add-nickname')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('adicionar apelido'),
    ];

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      Buttons,
    );
    await channel.send({ embeds: [embed], components: [actionRow] });

    await interaction.editReply({
      content: 'A configuração do painel de conta está completa',
    });
  },
} as Command;
