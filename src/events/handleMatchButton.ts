import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  Events,
  type Interaction,
} from "discord.js";

import { type MatchType, MatchUserSchema } from "../types/match";
import { type DiscordUser, DiscordUserSchema } from "../types/users";
import db from "../utils/database";

export default {
  name: Events.InteractionCreate,

  execute: async (interaction: Interaction) => {
    if (!interaction.guild) return;
    if (!interaction.isButton()) return;
    console.log(interaction.customId);

    const matchId = interaction.customId.split("_")[2] as string;
    const betType = interaction.customId.split("_")[3] as
      | "home"
      | "away"
      | "draw";

    if (!matchId || !betType) return;

    await handleMatchBet(interaction, matchId, betType);
  },
};

async function handleMatchBet(
  interaction: ButtonInteraction,
  matchId: string,
  betType: "home" | "away" | "draw",
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
    await interaction.editReply("This match is no longer accepting bets!");
    return;
  }

  const existingBet = match.UserBets.find(
    bet => bet.UserID === interaction.user.id,
  );

  if (existingBet) {
    await interaction.editReply("You have already placed a bet on this match!");
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

      userPoints: 100,
    });

    await (await db()).collection<DiscordUser>("users").insertOne(user);
  }

  if (user.userPoints < 100) {
    await interaction.editReply(
      "You don't have enough points to place this bet!",
    );
    return;
  }

  const newBet = MatchUserSchema.parse({
    UserID: interaction.user.id,
    StakeAmount: 100,
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
        userPoints: -100,
        BetsPlaced: 1,
      },
    },
  );

  const embed = new EmbedBuilder()
    .setTitle("Bet Placed Successfully!")
    .setDescription(
      `You bet 100 points on ${betType === "home" ? match.homeTeam : match.awayTeam}`,
    )
    .setColor(Colors.Green);

  await interaction.editReply({ embeds: [embed] });
}

export function createMatchButtons(
  matchId: string,
  includeDrawButton: boolean,
) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`match_bet_${matchId}_home`)
      .setLabel("Bet Home")
      .setStyle(ButtonStyle.Primary),
  );

  if (includeDrawButton) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`match_bet_${matchId}_draw`)
        .setLabel("Bet Draw")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`match_bet_${matchId}_away`)
      .setLabel("Bet Away")
      .setStyle(ButtonStyle.Danger),
  );

  return row;
}
