import {
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../interface";
import type { DiscordUser } from "../types";
import db from "../utils/database";

export default {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("User related commands")
    .addSubcommand(subcommand =>
      subcommand
        .setName("stats")
        .setDescription("View user statistics")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("The user to view stats for")
            .setRequired(false),
        ),
    )
    .addSubcommandGroup(group =>
      group
        .setName("points")
        .setDescription("Manage user points (Moderator only)")
        .addSubcommand(subcommand =>
          subcommand
            .setName("add")
            .setDescription("Add points to a user")
            .addUserOption(option =>
              option
                .setName("user")
                .setDescription("The user to add points to")
                .setRequired(true),
            )
            .addIntegerOption(option =>
              option
                .setName("amount")
                .setDescription("Amount of points to add")
                .setRequired(true)
                .setMinValue(1),
            ),
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName("remove")
            .setDescription("Remove points from a user")
            .addUserOption(option =>
              option
                .setName("user")
                .setDescription("The user to remove points from")
                .setRequired(true),
            )
            .addIntegerOption(option =>
              option
                .setName("amount")
                .setDescription("Amount of points to remove")
                .setRequired(true)
                .setMinValue(1),
            ),
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName("set")
            .setDescription("Set user points to a specific value")
            .addUserOption(option =>
              option
                .setName("user")
                .setDescription("The user to set points for")
                .setRequired(true),
            )
            .addIntegerOption(option =>
              option
                .setName("amount")
                .setDescription("Amount to set points to")
                .setRequired(true)
                .setMinValue(0),
            ),
        ),
    )
    .setDMPermission(false),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();

    if (subcommand === "stats") {
      await handleStats(interaction);
      return;
    }

    if (group === "points") {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
      ) {
        await interaction.reply({
          content:
            "You do not have permission to use points management commands!",
          ephemeral: true,
        });
        return;
      }

      switch (subcommand) {
        case "add":
          await handlePointsAdd(interaction);
          break;
        case "remove":
          await handlePointsRemove(interaction);
          break;
        case "set":
          await handlePointsSet(interaction);
          break;
      }
    }
  },
} as Command;

async function handleStats(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser("user") || interaction.user;
  const userData = await (await db()).collection<DiscordUser>("users").findOne({
    userId: targetUser.id,
  });

  if (!userData) {
    await interaction.reply({
      content: "User not found in database!",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${targetUser.username}'s Statistics`)
    .setColor("#0099ff")
    .addFields(
      { name: "Points", value: userData.userPoints.toString(), inline: true },
      {
        name: "Bets Placed",
        value: userData.BetsPlaced.toString(),
        inline: true,
      },
      {
        name: "Correct Bets",
        value: userData.BetsCorrect.toString(),
        inline: true,
      },
      {
        name: "Incorrect Bets",
        value: userData.BetsIncorrect.toString(),
        inline: true,
      },
      { name: "Profits", value: userData.profits.toString(), inline: true },
      { name: "Losses", value: userData.loss.toString(), inline: true },
      {
        name: "Current Win Streak",
        value: userData.WinStreakCurrent.toString(),
        inline: true,
      },
      {
        name: "Max Win Streak",
        value: userData.WinStreakMax.toString(),
        inline: true,
      },
      {
        name: "Current Lose Streak",
        value: userData.LooseStreakCurrent.toString(),
        inline: true,
      },
      {
        name: "Max Lose Streak",
        value: userData.LooseStreakMax.toString(),
        inline: true,
      },
      {
        name: "1x2 Investment",
        value: userData.Investment1x2.toString(),
        inline: true,
      },
      {
        name: "Asian Handicap Investment",
        value: userData.InvestmentAsianHandicap.toString(),
        inline: true,
      },
      {
        name: "1x2 ROI",
        value: userData.ROI1x2.toString(),
        inline: true,
      },
      {
        name: "Asian Handicap ROI",
        value: userData.ROIAsianHandicap.toString(),
        inline: true,
      },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handlePointsAdd(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser("user", true);
  const amount = interaction.options.getInteger("amount", true);

  await interaction.reply("Fetching user data and adding points...");

  const result = await (await db())
    .collection<DiscordUser>("users")
    .findOneAndUpdate(
      {
        userId: targetUser.id,
      },
      { $inc: { userPoints: amount } },
      { returnDocument: "after" },
    );

  if (!result) {
    await interaction.editReply({
      content: "Failed to update user points!",
    });
    return;
  }

  const myEmbed = new EmbedBuilder()
    .setTitle(`Points Added for ${targetUser.username}`)
    .setDescription(
      `Added ${amount} points to <@${targetUser.id}>.\n\nNew balance: ${result.userPoints}`,
    )
    .setColor(Colors.Green)
    .setTimestamp();

  await interaction.editReply({
    content: "",
    embeds: [myEmbed],
  });
}

async function handlePointsRemove(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser("user", true);
  const amount = interaction.options.getInteger("amount", true);
  await interaction.reply("Fetching user data and removing points...");

  const result = await (await db())
    .collection<DiscordUser>("users")
    .findOneAndUpdate(
      {
        userId: targetUser.id,
      },
      { $inc: { userPoints: -amount } },
      { returnDocument: "after" },
    );

  if (!result) {
    await interaction.editReply({
      content: "Failed to update user points!",
    });
    return;
  }

  const myEmbed = new EmbedBuilder()
    .setTitle(`Points Removed for ${targetUser.username}`)
    .setDescription(
      `Removed ${amount} points from <@${targetUser.id}>.\n\nNew balance: ${result.userPoints}`,
    )
    .setColor(Colors.Green)
    .setTimestamp();

  await interaction.editReply({
    content: "",
    embeds: [myEmbed],
  });
}

async function handlePointsSet(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser("user", true);
  const amount = interaction.options.getInteger("amount", true);

  await interaction.reply("Fetching user data and updating points...");

  const result = await (await db())
    .collection<DiscordUser>("users")
    .findOneAndUpdate(
      {
        userId: targetUser.id,
      },
      { $set: { userPoints: amount } },
      { returnDocument: "after" },
    );

  if (!result) {
    await interaction.editReply({
      content: "Failed to update user points!",
    });
    return;
  }

  const myEmbed = new EmbedBuilder()
    .setTitle(`Points updated for ${targetUser.username}`)
    .setDescription(`Set ${amount} points to <@${targetUser.id}>.`)
    .setColor(Colors.Green)
    .setTimestamp();

  await interaction.editReply({
    content: "",
    embeds: [myEmbed],
  });
}
