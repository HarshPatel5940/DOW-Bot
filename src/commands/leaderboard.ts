import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../interface";
import type { DiscordUser } from "../types";
import db from "../utils/database";

export default {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the points leaderboard")
    .addStringOption(option =>
      option
        .setName("type")
        .setDescription("Leaderboard time period")
        .setRequired(false)
        .addChoices(
          { name: "Weekly", value: "weekly" },
          { name: "Monthly", value: "monthly" },
          { name: "All Time", value: "alltime" },
        ),
    )
    .addIntegerOption(option =>
      option
        .setName("page")
        .setDescription("Page number")
        .setRequired(false)
        .setMinValue(1),
    )
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    const type = interaction.options.getString("type") ?? "weekly";
    const page = interaction.options.getInteger("page") ?? 1;
    const itemsPerPage = 20;

    await showLeaderboard(interaction, type, page, itemsPerPage);
  },
} as Command;

async function showLeaderboard(
  interaction: ChatInputCommandInteraction,
  type: string,
  page: number,
  itemsPerPage: number,
) {
  await interaction.deferReply();

  const startDate = getStartDate(type);
  const skip = (page - 1) * itemsPerPage;

  const usersCollection = (await db()).collection<DiscordUser>("users");

  const totalUsers = await usersCollection
    .find({
      ...(type !== "alltime" && { updatedAt: { $gte: startDate } }),
    })
    .count();

  const totalPages = Math.ceil(totalUsers / itemsPerPage);

  if (page > totalPages && totalPages > 0) {
    await interaction.editReply({
      content: `Invalid page number. Total pages available: ${totalPages}`,
    });
    return;
  }

  const users = await usersCollection
    .find({
      ...(type !== "alltime" && { updatedAt: { $gte: startDate } }),
    })
    .sort({ userPoints: -1 })
    .skip(skip)
    .limit(itemsPerPage)
    .toArray();

  if (users.length === 0) {
    await interaction.editReply({
      content: "No users found for this leaderboard period.",
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(
      `${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard - Page ${page}/${totalPages}`,
    )
    .setColor("#0099ff")
    .setDescription(
      users
        .map(
          (user, index) =>
            `${skip + index + 1}. <@${user.userId}> - ${
              user.username
            } - ${user.userPoints.toLocaleString()} points`,
        )
        .join("\n"),
    )
    .setFooter({
      text: `Page ${page} of ${totalPages} • ${totalUsers} total users`,
    })
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
  });
}

function getStartDate(type: string): Date {
  const now = new Date();
  switch (type) {
    case "weekly":
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay(),
      );
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return new Date(0);
  }
}
