import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Colors,
  EmbedBuilder,
  Events,
  type Interaction,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { type MatchType, MatchUserSchema } from "../types/match";
import { type DiscordUser, DiscordUserSchema } from "../types/users";
import db from "../utils/database";

export default {
  name: Events.InteractionCreate,

  execute: async (interaction: Interaction) => {
    if (!interaction.guild) return;
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    const matchId = interaction.customId.split("_")[2] as string;
    const betType = interaction.customId.split("_")[3] as
      | "home"
      | "away"
      | "draw";

    if (!matchId || !betType) return;

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("match_stake_")
    ) {
      const stakeAmount = Number.parseInt(
        interaction.fields.getTextInputValue("stake_amount"),
      );

      if (Number.isNaN(stakeAmount) || stakeAmount < 1) {
        await interaction.reply({
          content: "Please enter a valid stake amount!",
          ephemeral: true,
        });
        return;
      }

      await handleMatchBet(
        interaction,
        matchId,
        betType as "home" | "away" | "draw",
        stakeAmount,
      );
      return;
    }
    if (!interaction.isButton()) return;
    console.log(interaction.customId);

    const modal = createBetModal(matchId, betType);
    await interaction.showModal(modal);
    return;
  },
};

async function handleMatchBet(
  interaction: ModalSubmitInteraction,
  matchId: string,
  betType: "home" | "away" | "draw",
  stakeAmount: number,
) {
  await interaction.deferReply({ ephemeral: true });

  const match = await (await db())
    .collection<MatchType>("matches")
    .findOne({ matchId });

  if (!match) {
    await interaction.editReply("Match not found!");
    return;
  }

  if (
    match.isStarted ||
    match.isCompleted ||
    match.isAborted ||
    match.BetsLocked
  ) {
    await interaction.editReply(
      `This match is no longer accepting bets! \nStarted? ${match.isStarted}\nCompleted? ${match.isCompleted}\nAborted? ${match.isAborted}\nBets Locked? ${match.BetsLocked}\n`,
    );
    return;
  }

  const currentTime = new Date();
  const matchTime = new Date(match.matchDate);

  if (currentTime >= matchTime) {
    await interaction.editReply(
      "This match has already started and is no longer accepting bets!",
    );
    await disableBettingButtons(interaction, matchId);
    return;
  }

  const existingBet = match.UserBets.find(
    bet => bet.UserID === interaction.user.id,
  );

  if (existingBet && existingBet.StakeOn !== betType) {
    await interaction.editReply(
      "You have already placed a bet on this match for a different team! You can only place additional bets for the same team.",
    );
    return;
  }

  let user = (await (
    await db()
  )
    .collection<DiscordUser>("users")
    .findOne({ userId: interaction.user.id })) as DiscordUser;

  if (!user) {
    user = DiscordUserSchema.parse({
      userId: interaction.user.id,
      username: interaction.user.username,

      userPoints: 250,
    });

    await (await db()).collection<DiscordUser>("users").insertOne(user);
  }

  if (user.userPoints < stakeAmount) {
    await interaction.editReply(
      "You don't have enough points to place this bet!",
    );
    return;
  }

  const newBet = MatchUserSchema.parse({
    UserID: interaction.user.id,
    StakeAmount: stakeAmount,
    StakeOn: betType,
  });

  await (await db()).collection<MatchType>("matches").updateOne(
    { matchId },
    {
      $push: { UserBets: newBet },
      $inc: { totalBets: 1 },
    },
  );

  await (await db()).collection<DiscordUser>("users").updateOne(
    { userId: interaction.user.id },
    {
      $inc: {
        userPoints: -stakeAmount,
        BetsPlaced: 1,
      },
    },
  );

  const embed = new EmbedBuilder()
    .setTitle("Bet Placed Successfully!")
    .setDescription(
      `You bet ${stakeAmount} points on ${betType === "home" ? match.homeTeam : betType === "away" ? match.awayTeam : "Draw"}`,
    )
    .setColor(Colors.Green);

  await interaction.editReply({ embeds: [embed] });
}

function createBetModal(matchId: string, betType: string) {
  const stakeInput = new TextInputBuilder()
    .setCustomId("stake_amount")
    .setLabel("Enter your stake amount")
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(4)
    .setRequired(true);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    stakeInput,
  );

  return new ModalBuilder()
    .setCustomId(`match_stake_${matchId}_${betType}`)
    .setTitle("Place Your Bet")
    .addComponents(actionRow);
}

export async function disableBettingButtons(
  interaction: Interaction,
  matchId: string,
) {
  const match = await (await db())
    .collection<MatchType>("matches")
    .findOneAndUpdate({ matchId }, { $set: { isStarted: true } });

  if (!match) {
    throw new Error("Match not found!");
  }

  const currentTime = new Date();
  const matchTime = new Date(match.matchDate);

  if (currentTime < matchTime) {
    throw new Error("Match has not started yet!");
  }

  const channel = await interaction.client.channels.fetch(
    match.matchMsgChannel,
  );

  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("Invalid league channel!");
  }

  try {
    const message = await channel.messages.fetch(match.matchMsgId);
    if (!message.embeds[0]) {
      throw new Error("Match embed not found!");
    }

    const embed = message.embeds[0].toJSON();

    if (!embed.fields) {
      throw new Error("Match embed fields not found!");
    }

    const disabledButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`match_bet_${matchId}_home`)
        .setLabel("Bet Home")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`match_bet_${matchId}_draw`)
        .setLabel("Bet Draw")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`match_bet_${matchId}_away`)
        .setLabel("Bet Away")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
    );

    await message.edit({
      embeds: [embed],
      components: [disabledButtons],
    });

    console.log("Betting buttons disabled successfully!");
  } catch (error) {
    console.error("Failed to disable betting buttons:", error);
    throw new Error("Failed to disable betting buttons!");
  }
}
