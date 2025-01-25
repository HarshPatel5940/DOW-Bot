import {
  ChannelType,
  type Client,
  Colors,
  EmbedBuilder,
  Guild,
  GuildEmoji,
  NewsChannel,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import type { Command } from '../interface';
import type { DiscordUser } from '../types';
import { MyEmojis, RankEmojis, RankEmojisID } from '../types/emojis';
import db from '../utils/database';

export default {
  data: new SlashCommandBuilder()
    .setName('tabela-de-classificação')
    .setDescription('Mostra a tabela de classificação do servidor')
    .setDMPermission(false)
    .addChannelOption(ch =>
      ch
        .setName('canal')
        .setDescription('Canal para mostrar a tabela de classificação')
        .setRequired(false),
    )
    .addBooleanOption(option =>
      option
        .setName('ativar')
        .setDescription('Ativar a tabela de classificação')
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!interaction.guildId) return;
    const ativar = interaction.options.getBoolean('ativar');

    const guildId = interaction.guildId;
    await interaction.deferReply({ ephemeral: false });
    const config = await getConfig(interaction.guildId);

    if (config.IsLeaderboardActive) {
      if (ativar === false) {
        config.IsLeaderboardActive = false;
        config.LeaderboardChannelID = null;
        config.rankMessageID = {
          Radiante: '',
          Imortal3: '',
          Imortal2: '',
          Imortal1: '',
          Ascendente3: '',
          Ascendente2: '',
          Ascendente1: '',
          Diamante3: '',
          Diamante2: '',
          Diamante1: '',
          Platina3: '',
          Platina2: '',
          Platina1: '',
          Ouro3: '',
          Ouro2: '',
          Ouro1: '',
          Prata3: '',
          Prata2: '',
          Prata1: '',
          Bronze3: '',
          Bronze2: '',
          Bronze1: '',
          Ferro3: '',
          Ferro2: '',
          Ferro1: '',
        };
        await updateConfig(guildId, config);
      }
      if (!localLeaderBoardTracker) {
        await updateRankMessages(guildId, interaction.client);
        setInterval(async () => {
          await updateRankMessages(guildId, interaction.client);
          console.log('Updated leaderboard - ', new Date());
        }, 30000);
        localLeaderBoardTracker = true;

        await interaction.editReply({
          content: 'A tabela de classificação foi reativada.',
        });
      } else {
        await interaction.editReply({
          content: 'A tabela de classificação já está ativa.',
        });
      }
      return;
    }

    const channel =
      interaction.options.getChannel('canal') || interaction.channel;

    if (!channel) {
      await interaction.editReply({
        content: 'Canal inválido.',
      });
      return;
    }

    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement
    ) {
      await interaction.reply({
        content: 'Canal inválido.',
        ephemeral: true,
      });
      return;
    }

    const rankArrays = await getUserByRanks();

    for (const rank of Object.keys(rankArrays)) {
      if (channel instanceof TextChannel || channel instanceof NewsChannel) {
        const message = await channel.send({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setTitle(`${RankEmojis.get(rank)} ${rank}`)
              .setDescription(`${rankArrays[rank]}`)
              .setColor(Colors.DarkGrey)
              .setTimestamp()
              .setThumbnail(
                `https://cdn.discordapp.com/emojis/${RankEmojisID.get(rank)}.png?width=32&height=32`,
              ),
          ],
        });

        config.rankMessageID[rank] = message.id;
      }
    }
    config.IsLeaderboardActive = true;
    config.LeaderboardChannelID = channel.id;

    await updateConfig(guildId, config);

    await interaction.editReply({
      content: 'Tabela de classificação enviada com sucesso.',
    });

    setInterval(async () => {
      await updateRankMessages(guildId, interaction.client);
      console.log('Updated leaderboard - ', new Date());
    }, 30000);

    return;
  },
} as Command;

interface ConfigType {
  IsLeaderboardActive: boolean;
  LeaderboardChannelID: string | null;
  rankMessageID: { [key: string]: string };
}

let localLeaderBoardTracker = false;

async function getConfig(guildId: string): Promise<ConfigType> {
  const configCollection = (await db()).collection('config');

  const config = await configCollection.findOne({ guildId: guildId });
  return (
    (config as unknown as ConfigType) || {
      IsLeaderboardActive: false,
      LeaderboardChannelID: null,
      rankMessageID: {
        Radiante: '',
        Imortal3: '',
        Imortal2: '',
        Imortal1: '',
        Ascendente3: '',
        Ascendente2: '',
        Ascendente1: '',
        Diamante3: '',
        Diamante2: '',
        Diamante1: '',
        Platina3: '',
        Platina2: '',
        Platina1: '',
        Ouro3: '',
        Ouro2: '',
        Ouro1: '',
        Prata3: '',
        Prata2: '',
        Prata1: '',
        Bronze3: '',
        Bronze2: '',
        Bronze1: '',
        Ferro3: '',
        Ferro2: '',
        Ferro1: '',
      },
    }
  );
}

async function updateConfig(guildId: string, newConfig: Partial<ConfigType>) {
  const configCollection = (await db()).collection('config');
  await configCollection.updateOne(
    { guildId: guildId },
    { $set: newConfig },
    { upsert: true },
  );
  localLeaderBoardTracker = true;
}

async function updateRankMessages(guildId: string, client: Client) {
  const config = await getConfig(guildId);

  if (!config.IsLeaderboardActive || !config.LeaderboardChannelID) {
    config.IsLeaderboardActive = false;
    await updateConfig(guildId, { IsLeaderboardActive: false });
    return;
  }

  const channel = await client.channels.fetch(config.LeaderboardChannelID);
  if (
    !channel ||
    !(channel instanceof TextChannel || channel instanceof NewsChannel)
  ) {
    config.IsLeaderboardActive = false;
    await updateConfig(guildId, { IsLeaderboardActive: false });
    return;
  }
  const rankArrays = await getUserByRanks();

  for (const rank of Object.keys(rankArrays).reverse()) {
    if (!config.rankMessageID[rank]) {
      continue;
    }

    const message = await channel.messages.fetch(config.rankMessageID[rank]);

    await message.edit({
      content: '',
      embeds: [
        new EmbedBuilder()
          .setTitle(`${RankEmojis.get(rank)} ${rank}`)
          .setDescription(`${rankArrays[rank]}`)
          .setColor(Colors.DarkGrey)
          .setTimestamp()
          .setThumbnail(
            `https://cdn.discordapp.com/emojis/${RankEmojisID.get(rank)}.png?width=32&height=32`,
          ),
      ],
    });
  }
}

async function getUserByRanks() {
  const users = await (await db())
    .collection<DiscordUser>('discord-users')
    .find()
    .toArray();

  const rankArrays: { [key: string]: string } = {
    Radiante: '',
    Imortal3: '',
    Imortal2: '',
    Imortal1: '',
    Ascendente3: '',
    Ascendente2: '',
    Ascendente1: '',
    Diamante3: '',
    Diamante2: '',
    Diamante1: '',
    Platina3: '',
    Platina2: '',
    Platina1: '',
    Ouro3: '',
    Ouro2: '',
    Ouro1: '',
    Prata3: '',
    Prata2: '',
    Prata1: '',
    Bronze3: '',
    Bronze2: '',
    Bronze1: '',
    Ferro3: '',
    Ferro2: '',
    Ferro1: '',
  };

  for (const user of users) {
    const userRank = user.InGameRank;

    rankArrays[userRank] += `${user.InGameUsername} ,`;
  }

  for (const userRanks in rankArrays) {
    if (!rankArrays[userRanks]) {
      rankArrays[userRanks] = rankArrays[userRanks] = 'Nenhum ,';
    }

    rankArrays[userRanks] = rankArrays[userRanks].slice(0, -1);
  }

  return rankArrays;
}
