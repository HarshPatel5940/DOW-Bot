import {
  ChannelType,
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { ulid } from "ulid";
import { ZodError } from "zod";
import type { Command } from "../interface";
import { LeagueSchema, type LeagueType } from "../types/match";
import { MyCache } from "../utils/cache";
import db from "../utils/database";

export default {
  data: new SlashCommandBuilder()
    .setName("league")
    .setDescription("League related commands")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("get info about existing league")
        .addStringOption((option) =>
          option
            .setName("id-or-name")
            .setDescription("ID of the league")
            .setAutocomplete(true)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a new league")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Name of the league")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Description of the league")
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to send league updates")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("start-date")
            .setDescription("Start date of the league. Format: MM-DD-YYYY")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("end-date")
            .setDescription("End date of the league. Format: MM-DD-YYYY")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Update an existing league")
        .addStringOption((option) =>
          option
            .setName("id-or-name")
            .setDescription("ID of the league")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addStringOption((option) =>
          option.setName("new-name").setDescription("Name of the league"),
        )
        .addStringOption((option) =>
          option
            .setName("new-description")
            .setDescription("Description of the league"),
        )
        .addStringOption((option) =>
          option
            .setName("new-start-date")
            .setDescription("Start date of the league. Format: MM-DD-YYYY"),
        )
        .addStringOption((option) =>
          option
            .setName("new-end-date")
            .setDescription("End date of the league. Format: MM-DD-YYYY"),
        )
        .addBooleanOption((option) =>
          option
            .setName("league-completed")
            .setDescription("Mark the league as completed"),
        )
        .addChannelOption((option) =>
          option
            .setName("new-channel")
            .setDescription("League channel where the match will be posted")
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("end")
        .setDescription("End an existing league")
        .addStringOption((option) =>
          option
            .setName("id-or-name")
            .setDescription("ID of the league")
            .setAutocomplete(true)
            .setRequired(true),
        ),
    ),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toUpperCase();

    let result = MyCache.get("leagues") as LeagueType[];

    if (!result) {
      result = (await (await db())
        .collection<LeagueType>("leagues")
        .find({})
        .toArray()) as LeagueType[];
      MyCache.set("leagues", result);
    }

    const filtered = result.filter(
      (result) =>
        result.LeagueID.includes(focusedValue) ||
        result.LeagueName.includes(focusedValue),
    );

    await interaction.respond(
      filtered.map((choice) => ({
        name: `${choice.LeagueName} - ${choice.LeagueID}`,
        value: `${choice.LeagueID}`,
      })),
    );
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "info") {
      await interaction.reply("Getting info about the league");
      await getLeagueInfo(interaction);
    } else if (subcommand === "add") {
      await interaction.reply("Adding a new league");
      await addLeague(interaction);
    } else if (subcommand === "update") {
      await interaction.reply("Updating an existing league");
      await updateLeague(interaction);
    } else if (subcommand === "end") {
      await interaction.reply("Ending an existing league");
      await endLeague(interaction);
    } else {
      await interaction.reply("Invalid subcommand provided! Expired?");
    }
  },
} as Command;

async function getLeagueInfo(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString("id-or-name");

  if (!id) {
    await interaction.editReply("Please provide the ID of the league");
    return;
  }

  const result = await (await db())
    .collection<LeagueType>("leagues")
    .findOne({ LeagueID: id });

  if (!result) {
    await interaction.editReply("League not found!");
    return;
  }

  const myEmbed = new EmbedBuilder()
    .setTitle("League Details")
    .setDescription(
      `League has been fetched successfully!\nEnded: ${result.IsLeagueCompleted ? "Yes" : "No"}`,
    )
    .addFields(
      { name: "ID", value: `\`${result.LeagueID}\``, inline: true },
      { name: "Name", value: result.LeagueName, inline: true },
      {
        name: "Description",
        value: result.LeagueDescription,
        inline: true,
      },
      {
        name: "Channel",
        value: `<#${result.LeagueChannel}>`,
        inline: true,
      },
      {
        name: "Start Date",
        value: result.LeagueStartDate.toDateString(),
        inline: true,
      },
      {
        name: "End Date",
        value: result.LeagueEndDate.toDateString(),
        inline: true,
      },
    )
    .setTimestamp()
    .setColor(result.IsLeagueCompleted ? Colors.DarkOrange : Colors.Blurple);

  return await interaction.editReply({ content: "", embeds: [myEmbed] });
}

async function addLeague(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString("name");
  const description = interaction.options.getString("description");
  const channel = interaction.options.getChannel("channel");
  const startDate = interaction.options.getString("start-date");
  const endDate = interaction.options.getString("end-date");

  if (!name || !description || !channel || !startDate || !endDate) {
    await interaction.editReply("Please provide all the required fields");
    return;
  }

  const result = await (await db())
    .collection<LeagueType>("leagues")
    .findOne({ LeagueChannel: channel.id });

  if (result) {
    await interaction.editReply(
      `This channel is already in use by another league!\n\nName: \`${result.LeagueName}\`\nID: \`${result.LeagueID}\``,
    );
    return;
  }

  try {
    const newLeague: LeagueType = LeagueSchema.parse({
      LeagueID: ulid(),
      LeagueName: name,
      LeagueDescription: description,
      LeagueChannel: channel.id,
      LeagueStartDate: new Date(startDate),
      LeagueEndDate: new Date(endDate),
      LeagueMatches: [],
      IsLeagueCompleted: false,
      updatedAt: new Date(),
    });

    const result = await (await db())
      .collection<LeagueType>("leagues")
      .insertOne({
        ...newLeague,
      });

    if (!result.insertedId) {
      return await interaction.editReply("Error While Inserting!");
    }

    const myEmbed = new EmbedBuilder()
      .setTitle("League Added")
      .setDescription(
        "League has been added successfully with the following details!",
      )
      .addFields(
        { name: "ID", value: `\`${newLeague.LeagueID}\``, inline: true },
        { name: "Name", value: newLeague.LeagueName, inline: true },
        {
          name: "Description",
          value: newLeague.LeagueDescription,
          inline: true,
        },
        {
          name: "Channel",
          value: `<#${newLeague.LeagueChannel}>`,
          inline: true,
        },
        {
          name: "Start Date",
          value: newLeague.LeagueStartDate.toDateString(),
          inline: true,
        },
        {
          name: "End Date",
          value: newLeague.LeagueEndDate.toDateString(),
          inline: true,
        },
      )
      .setTimestamp()
      .setColor(Colors.Green);

    return await interaction.editReply({ content: "", embeds: [myEmbed] });
  } catch (err) {
    if (err instanceof ZodError) {
      await interaction.editReply(
        "Invalid input provided! Maybe DATE is not MM-DD-YYYY ? Please check console!",
      );

      console.error(err);
      return;
    }

    await interaction.editReply(
      "An unknown error occurred while adding the league",
    );
  }
}

async function updateLeague(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString("id-or-name");
  const newName = interaction.options.getString("new-name");
  const newDescription = interaction.options.getString("new-description");
  const newStartDate = interaction.options.getString("new-start-date");
  const newEndDate = interaction.options.getString("new-end-date");
  const leagueCompleted = interaction.options.getBoolean("league-completed");
  const newChannel = interaction.options.getChannel("new-channel");

  if (!id) {
    await interaction.editReply("Please provide the ID of the league");
    return;
  }

  if (
    !newName &&
    !newDescription &&
    !newStartDate &&
    !newEndDate &&
    !newChannel &&
    leagueCompleted === null
  ) {
    await interaction.editReply("Please provide at least one field to update");
    return;
  }

  const result = await (await db())
    .collection<LeagueType>("leagues")
    .findOne({ LeagueID: id });

  if (!result) {
    await interaction.editReply("League not found!");
    return;
  }

  const newResult: LeagueType = result;

  if (newName) {
    newResult.LeagueName = newName;
  }

  if (newDescription) {
    newResult.LeagueDescription = newDescription;
  }

  if (newStartDate) {
    newResult.LeagueStartDate = new Date(newStartDate);
  }

  if (newEndDate) {
    newResult.LeagueEndDate = new Date(newEndDate);
  }

  if (leagueCompleted !== null) {
    newResult.IsLeagueCompleted = leagueCompleted;
  }

  if (newChannel) {
    const result = await (await db())
      .collection<LeagueType>("leagues")
      .findOne({ LeagueChannel: newChannel.id });

    if (result) {
      await interaction.editReply(
        `This channel is already in use by another league!\n\nName: \`${result.LeagueName}\`\nID: \`${result.LeagueID}\``,
      );
      return;
    }

    newResult.LeagueChannel = newChannel.id;
  }

  newResult.updatedAt = new Date();

  const updatedResult = await (await db())
    .collection<LeagueType>("leagues")
    .updateOne(
      {
        LeagueID: id,
      },
      {
        $set: newResult,
      },
      {
        upsert: false,
      },
    );

  if (updatedResult.modifiedCount === 0) {
    await interaction.editReply("No changes made!");
    return;
  }

  const myEmbed = new EmbedBuilder()
    .setTitle("Updated League Details")
    .setDescription(
      `League has been updated successfully!\nEnded: ${newResult.IsLeagueCompleted ? "Yes" : "No"}`,
    )
    .addFields(
      { name: "ID", value: `\`${newResult.LeagueID}\``, inline: true },
      { name: "Name", value: newResult.LeagueName, inline: true },
      {
        name: "Description",
        value: newResult.LeagueDescription,
        inline: true,
      },
      {
        name: "Channel",
        value: `<#${newResult.LeagueChannel}>`,
        inline: true,
      },
      {
        name: "Start Date",
        value: newResult.LeagueStartDate.toDateString(),
        inline: true,
      },
      {
        name: "End Date",
        value: newResult.LeagueEndDate.toDateString(),
        inline: true,
      },
    )
    .setTimestamp()
    .setColor(Colors.Blurple);

  return await interaction.editReply({ content: "", embeds: [myEmbed] });
}

async function endLeague(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString("id-or-name");

  if (!id) {
    await interaction.editReply("Please provide the ID of the league");
    return;
  }

  const result = await (await db())
    .collection<LeagueType>("leagues")
    .updateOne(
      { LeagueID: id },
      { $set: { IsLeagueCompleted: true, updatedAt: new Date() } },
    );

  if (result.modifiedCount === 0) {
    await interaction.editReply("No changes made!");
    return;
  }

  return await interaction.editReply("League has been marked as completed!");
}
