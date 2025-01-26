import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { ulid } from "ulid";
import type { Command } from "../interface";
import type { DiscordUser } from "../types";
import { type LeagueType, MatchSchema, type MatchType } from "../types/match";
import { MyCache } from "../utils/cache";
import db from "../utils/database";

export default {
  data: new SlashCommandBuilder()
    .setName("match")
    .setDescription("Match related commands")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName("info")
        .setDescription("Get match info")
        .addStringOption(option =>
          option
            .setName("id-or-name")
            .setDescription("Match ID to get info")
            .setAutocomplete(true)
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription("Create a new match")
        .addStringOption(option =>
          option
            .setName("league")
            .setDescription("League ID where to create match")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName("home-team")
            .setDescription("Home team name")
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName("away-team")
            .setDescription("Away team name")
            .setRequired(true),
        )
        .addNumberOption(option =>
          option
            .setName("home-odds")
            .setDescription("Odds for home team")
            .setRequired(true),
        )
        .addNumberOption(option =>
          option
            .setName("away-odds")
            .setDescription("Odds for away team")
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName("match-date")
            .setDescription("Date and time of the match. Format: MM-DD-YYYY")
            .setRequired(true),
        )
        .addNumberOption(option =>
          option.setName("draw-odds").setDescription("Odds for draw"),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("update")
        .setDescription("Update match details")
        .addStringOption(option =>
          option
            .setName("id-or-name")
            .setDescription("Match ID to update")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addNumberOption(option =>
          option.setName("home-odds").setDescription("New home team odds"),
        )
        .addNumberOption(option =>
          option.setName("away-odds").setDescription("New away team odds"),
        )
        .addBooleanOption(option =>
          option
            .setName("betting-lock-status")
            .setDescription("Enable/Disable betting for this match"),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("end")
        .setDescription("End a match and settle scores")
        .addStringOption(option =>
          option
            .setName("id-or-name")
            .setDescription("Match ID to end")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addNumberOption(option =>
          option
            .setName("home-score")
            .setDescription("Home team score")
            .setRequired(true),
        )
        .addNumberOption(option =>
          option
            .setName("away-score")
            .setDescription("Away team score")
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("cancel")
        .setDescription("Cancel/Void a match")
        .addStringOption(option =>
          option
            .setName("id-or-name")
            .setDescription("Match ID to cancel")
            .setAutocomplete(true)
            .setRequired(true),
        ),
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const subCommand = interaction.options.getSubcommand();

    if (focusedOption.name === "league") {
      const focusedValue = focusedOption.value.toUpperCase();
      let leagues = MyCache.get("leagues") as LeagueType[];

      if (!leagues) {
        leagues = await (await db())
          .collection<LeagueType>("leagues")
          .find({ IsLeagueCompleted: false })
          .toArray();
        MyCache.set("leagues", leagues);
      }

      const filtered = leagues.filter(
        league =>
          league.LeagueID.includes(focusedValue) ||
          league.LeagueName.includes(focusedValue),
      );

      await interaction.respond(
        filtered.map(choice => ({
          name: `${choice.LeagueName}`,
          value: choice.LeagueID,
        })),
      );
    } else if (focusedOption.name === "id-or-name") {
      const focusedValue = focusedOption.value.toUpperCase();
      let matches = MyCache.get("matches") as MatchType[];

      if (!matches) {
        matches = await (await db())
          .collection<MatchType>("matches")
          .find({})
          .toArray();
        MyCache.set("matches", matches);
      }

      if (subCommand === "info") {
        const filtered = matches.filter(match =>
          match.matchId.includes(focusedValue),
        );

        await interaction.respond(
          filtered.map(choice => ({
            name: `${choice.homeTeam} vs ${choice.awayTeam}`,
            value: choice.matchId,
          })),
        );
      } else if (
        subCommand === "update" ||
        subCommand === "end" ||
        subCommand === "cancel"
      ) {
        const filtered = matches.filter(
          match =>
            match.matchId.includes(focusedValue) &&
            !match.isCompleted &&
            !match.isAborted,
        );

        await interaction.respond(
          filtered.map(choice => ({
            name: `${choice.homeTeam} vs ${choice.awayTeam}`,
            value: choice.matchId,
          })),
        );
      }
    }
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "info":
        await infoMatch(interaction);
        break;
      case "create":
        await createMatch(interaction);
        break;
      case "update":
        await updateMatch(interaction);
        MyCache.del("matches");
        break;
      case "end":
        await endMatch(interaction);
        MyCache.del("matches");
        break;
      case "cancel":
        await cancelMatch(interaction);
        MyCache.del("matches");
        break;
      default:
        await interaction.reply("Invalid subcommand!");
    }
  },
} as Command;

async function infoMatch(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const matchId = interaction.options.getString("id-or-name", true);

  const match = await (await db())
    .collection<MatchType>("matches")
    .findOne({ matchId });

  if (!match) {
    await interaction.editReply("Match not found!");
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${match.homeTeam} vs ${match.awayTeam}`)
    .setDescription(
      match.homeTeamHandicap || match.awayTeamHandicap
        ? `Handicap: \nHome - ${match.homeTeam} - (${
            match.homeTeamHandicap || "N/A"
          })\nAway - ${match.awayTeam} - (${match.awayTeamHandicap || "N/A"})`
        : "No handicap applied",
    )
    .addFields(
      {
        name: `homeTeam - ${match.homeTeam}`,
        value: `Odds: ${match.homeTeamOdds}`,
        inline: true,
      },
      match.drawOdds
        ? { name: "Draw", value: `Odds: ${match.drawOdds}`, inline: true }
        : { name: "\u200B", value: "\u200B", inline: true },
      {
        name: `awayTeam - ${match.awayTeam}`,
        value: `Odds: ${match.awayTeamOdds}`,
        inline: true,
      },
      {
        name: "Total Bets",
        value: `${match.totalBets}`,
        inline: true,
      },
      {
        name: "Home Score",
        value: `${match.homeTeamScore || "N/A"}`,
        inline: true,
      },
      {
        name: "Away Score",
        value: `${match.awayTeamScore || "N/A"}`,
        inline: true,
      },
      {
        name: "Is Completed",
        value: `${match.isCompleted ? "Yes" : "No"}`,
        inline: true,
      },
      {
        name: "Is Aborted",
        value: `${match.isAborted ? "Yes" : "No"}`,
        inline: true,
      },
      {
        name: "Is Draw",
        value: `${match.isDraw ? "Yes" : "No"}`,
        inline: true,
      },
      {
        name: "Match Date",
        value: `${match.matchDate}`,
        inline: true,
      },
      {
        name: "Home Team Handicap",
        value: `${match.homeTeamHandicap || "N/A"}`,
        inline: true,
      },
      {
        name: "Away Team Handicap",
        value: `${match.awayTeamHandicap || "N/A"}`,
        inline: true,
      },
    )
    .setColor(Colors.Blue)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function createMatch(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const leagueId = interaction.options.getString("league", true);
  const homeTeam = interaction.options.getString("home-team", true);
  const awayTeam = interaction.options.getString("away-team", true);
  const homeOdds = interaction.options.getNumber("home-odds", true);
  const awayOdds = interaction.options.getNumber("away-odds", true);
  const drawOdds = interaction.options.getNumber("draw-odds") || 0;
  const handicap = interaction.options.getString("handicap");
  const matchDate = interaction.options.getString("match-date");

  if (
    !leagueId ||
    !homeTeam ||
    !awayTeam ||
    !homeOdds ||
    !awayOdds ||
    !matchDate
  ) {
    await interaction.editReply("Please provide all parameters!");
    return;
  }

  const league = await (await db())
    .collection<LeagueType>("leagues")
    .findOne({ LeagueID: leagueId, IsLeagueCompleted: false });

  if (!league) {
    await interaction.editReply("League not found or is completed!");
    return;
  }

  const activeMatches = await (await db())
    .collection<MatchType>("matches")
    .countDocuments({
      matchId: { $in: league.LeagueMatches.map(m => m.matchId) },
      isCompleted: false,
      isAborted: false,
    });

  if (activeMatches >= 10) {
    await interaction.editReply(
      "Maximum active matches limit (10) reached for this league!",
    );
    return;
  }

  try {
    const newMatch = MatchSchema.parse({
      matchId: ulid(),
      matchMsgChannel: league.LeagueChannel,
      matchMsgId: "",
      homeTeam,
      awayTeam,
      homeTeamOdds: homeOdds,
      awayTeamOdds: awayOdds,
      drawOdds: drawOdds,
      homeTeamHandicap: handicap?.startsWith("+") ? handicap : undefined,
      awayTeamHandicap: handicap?.startsWith("-") ? handicap : undefined,
      UserBets: [],
      totalBets: 0,
      isStarted: false,
      isCompleted: false,
      isAborted: false,
      isDraw: false,
      matchDate: new Date(matchDate),
    });

    const matchEmbed = new EmbedBuilder()
      .setTitle(`${homeTeam} vs ${awayTeam}`)
      .setDescription(
        handicap
          ? `Handicap: \nHome - ${homeTeam} - (${handicap})\nAway - ${awayTeam} - (${handicap})`
          : "No handicap applied",
      )
      .addFields(
        {
          name: `homeTeam - ${homeTeam}`,
          value: `Odds: ${homeOdds}`,
          inline: true,
        },
        drawOdds
          ? { name: "Draw", value: `Odds: ${drawOdds}`, inline: true }
          : { name: "\u200B", value: "\u200B", inline: true },
        {
          name: `awayTeam - ${awayTeam}`,
          value: `Odds: ${awayOdds}`,
          inline: true,
        },
        {
          name: "Total Bets",
          value: "0",
          inline: true,
        },
      )
      .setColor(Colors.Blue)
      .setTimestamp();

    const channel = await interaction.client.channels.fetch(
      league.LeagueChannel,
    );

    if (!channel) {
      await interaction.editReply(
        "Invalid league channel! Please check if its text channel.",
      );
      return;
    }

    if (channel.type !== ChannelType.GuildText) {
      await interaction.editReply("Invalid league channel!");
      return;
    }

    const buttons = createMatchButtons(
      newMatch.matchId,
      drawOdds !== undefined,
    );

    const message = await channel.send({
      embeds: [matchEmbed],
      components: [buttons],
    });

    newMatch.matchMsgId = message.id;

    await (await db()).collection<MatchType>("matches").insertOne(newMatch);

    await (await db())
      .collection<LeagueType>("leagues")
      .updateOne(
        { LeagueID: leagueId },
        { $push: { LeagueMatches: { matchId: newMatch.matchId } } },
      );

    const myEmbed = new EmbedBuilder()
      .setTitle("Match Created")
      .setDescription(`Match created successfully! ID: ${newMatch.matchId}`)
      .setColor(Colors.Green)
      .addFields(
        {
          name: "Home Team",
          value: homeTeam,
          inline: true,
        },
        {
          name: "Away Team",
          value: awayTeam,
          inline: true,
        },
        {
          name: "Home Odds",
          value: `${homeOdds}`,
          inline: true,
        },
        {
          name: "Away Odds",
          value: `${awayOdds}`,
          inline: true,
        },
        {
          name: "Draw Odds",
          value: `${drawOdds}` || "N/A",
          inline: true,
        },
        {
          name: "Handicap",
          value: `${handicap}` || "N/A",
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({
      content: `Match created successfully! ID: \`${newMatch.matchId}\``,
      embeds: [myEmbed],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply("Failed to create match!");
  }
}

async function updateMatch(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const matchId = interaction.options.getString("id-or-name", true);
  const homeOdds = interaction.options.getNumber("home-odds");
  const awayOdds = interaction.options.getNumber("away-odds");
  const bettingLockStatus = interaction.options.getBoolean(
    "betting-lock-status",
  );

  const match = await (await db())
    .collection<MatchType>("matches")
    .findOne({ matchId });

  if (!match) {
    await interaction.editReply("Match not found!");
    return;
  }

  const updates: Partial<MatchType> = {
    updatedAt: new Date(),
  };

  if (homeOdds) updates.homeTeamOdds = homeOdds;
  if (awayOdds) updates.awayTeamOdds = awayOdds;
  if (bettingLockStatus !== null) updates.BetsLocked = bettingLockStatus;

  await (await db())
    .collection<MatchType>("matches")
    .updateOne({ matchId }, { $set: updates });

  const channel = await interaction.client.channels.fetch(
    match.matchMsgChannel,
  );

  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply("Invalid league channel!");
    return;
  }

  try {
    const message = await channel.messages.fetch(match.matchMsgId);
    if (!message.embeds[0]) {
      await interaction.editReply("Match embed not found!");
      return;
    }
    const embed = message.embeds[0].toJSON();

    if (!embed.fields || !embed.fields[0] || !embed.fields[2]) {
      await interaction.editReply("Match embed fields not found!");
      return;
    }

    if (homeOdds) embed.fields[0].value = `Odds: ${homeOdds}`;
    if (awayOdds) embed.fields[2].value = `Odds: ${awayOdds}`;

    await message.edit({
      embeds: [embed],
      components:
        bettingLockStatus === false ? [createMatchButtons(matchId, true)] : [],
    });
  } catch (error) {
    console.error("Failed to update match embed:", error);
  }

  await interaction.editReply("Match updated successfully!");
}

async function endMatch(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const matchId = interaction.options.getString("id-or-name", true);
  const homeScore = interaction.options.getNumber("home-score", true);
  const awayScore = interaction.options.getNumber("away-score", true);

  const match = await (await db())
    .collection<MatchType>("matches")
    .findOne({ matchId });

  if (!match) {
    await interaction.editReply("Match not found!");
    return;
  }

  if (match.isCompleted) {
    await interaction.editReply("Match is already completed!");
    return;
  }

  const calculateHandicapResult = (
    homeScore: number,
    awayScore: number,
    handicap?: string,
  ) => {
    if (!handicap)
      return homeScore > awayScore
        ? "home"
        : homeScore < awayScore
          ? "away"
          : "draw";

    const handicapValue = Number.parseFloat(handicap);
    const adjustedHomeScore = homeScore + handicapValue;

    return adjustedHomeScore > awayScore
      ? "home"
      : adjustedHomeScore < awayScore
        ? "away"
        : "draw";
  };

  const result = calculateHandicapResult(
    homeScore,
    awayScore,
    match.homeTeamHandicap || match.awayTeamHandicap,
  );

  for (const bet of match.UserBets) {
    const user = await (await db())
      .collection<DiscordUser>("users")
      .findOne({ userId: bet.UserID });

    if (!user) continue;

    const won = bet.StakeOn === result;
    let odds = bet.StakeOn === "home" ? match.homeTeamOdds : match.awayTeamOdds;
    if (!odds) odds = 1;

    const winnings = won ? Math.floor(bet.StakeAmount * odds) : 0;

    const updates: Partial<DiscordUser> = {
      userPoints: user.userPoints + (won ? winnings : 0),
      BetsCorrect: user.BetsCorrect + (won ? 1 : 0),
      BetsIncorrect: user.BetsIncorrect + (won ? 0 : 1),
      profits: user.profits + (won ? winnings - bet.StakeAmount : 0),
      loss: user.loss + (won ? 0 : bet.StakeAmount),
      WinStreakCurrent: won ? user.WinStreakCurrent + 1 : 0,
      LooseStreakCurrent: won ? 0 : user.LooseStreakCurrent + 1,
    };

    if (!updates.WinStreakCurrent) {
      updates.WinStreakCurrent = 0;
    }

    if (!updates.LooseStreakCurrent) {
      updates.LooseStreakCurrent = 0;
    }

    if (won && updates.WinStreakCurrent > user.WinStreakMax) {
      updates.WinStreakMax = updates.WinStreakCurrent;
    }
    if (!won && updates.LooseStreakCurrent > user.LooseStreakMax) {
      updates.LooseStreakMax = updates.LooseStreakCurrent;
    }

    await (await db())
      .collection<DiscordUser>("users")
      .updateOne({ userId: bet.UserID }, { $set: updates });
  }

  await (await db()).collection<MatchType>("matches").updateOne(
    { matchId },
    {
      $set: {
        homeTeamScore: homeScore,
        awayTeamScore: awayScore,
        isCompleted: true,
        isDraw: result === "draw",
        updatedAt: new Date(),
      },
    },
  );

  const channel = await interaction.client.channels.fetch(
    match.matchMsgChannel,
  );

  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply("Invalid league channel!");
    return;
  }

  try {
    const message = await channel.messages.fetch(match.matchMsgId);
    if (!message.embeds[0]) {
      await interaction.editReply("Match embed not found!");
      return;
    }
    const embed = message.embeds[0].toJSON();

    if (!embed.fields) {
      await interaction.editReply("Match embed fields not found!");
      return;
    }

    embed.fields.push({
      name: `Results - ${result === "draw" ? "Draw" : result === "home" ? match.homeTeam : match.awayTeam}`,
      value: `Home: ${match.homeTeam} ${homeScore} - Away: ${awayScore} ${match.awayTeam}`,
      inline: false,
    });

    embed.color = result === "draw" ? Colors.Yellow : Colors.Green;

    await message.edit({
      embeds: [embed],
      components: [],
    });
  } catch (error) {
    console.error("Failed to update match embed:", error);
  }

  await interaction.editReply("Match completed and winnings distributed!");
}

async function cancelMatch(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const matchId = interaction.options.getString("id-or-name", true);

  const match = await (await db())
    .collection<MatchType>("matches")
    .findOne({ matchId });

  if (!match) {
    await interaction.editReply("Match not found!");
    return;
  }

  const bulkOps = match.UserBets.map(bet => ({
    updateOne: {
      filter: { userId: bet.UserID },
      update: {
        $inc: {
          userPoints: bet.StakeAmount,
          BetsWithdrawn: 1,
        },
      },
    },
  }));

  if (bulkOps.length > 0) {
    await (await db()).collection<DiscordUser>("users").bulkWrite(bulkOps);
  }

  await (await db()).collection<MatchType>("matches").updateOne(
    { matchId },
    {
      $set: {
        isAborted: true,
        updatedAt: new Date(),
      },
    },
  );

  const channel = await interaction.client.channels.fetch(
    match.matchMsgChannel,
  );
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply("Invalid league channel!");
    return;
  }
  try {
    const message = await channel.messages.fetch(match.matchMsgId);
    if (!message.embeds[0]) {
      await interaction.editReply("Match embed not found!");
      return;
    }
    const embed = message.embeds[0].toJSON();

    if (!embed.fields) {
      await interaction.editReply("Match embed fields not found!");
      return;
    }

    embed.fields.push({
      name: "Status",
      value: "Match Cancelled - All bets refunded",
      inline: false,
    });

    embed.color = Colors.Red;

    await message.edit({
      embeds: [embed],
      components: [],
    });
  } catch (error) {
    console.error("Failed to update match embed:", error);
  }

  await interaction.editReply("Match cancelled and all bets refunded!");
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
