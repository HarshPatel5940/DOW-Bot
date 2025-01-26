/*
/match create  --> take league info later via dropdown
         --> a small check to have max 10 live matches per league
         --> send the embed in the respective league channel
         --> we can send betting buttons

/match update :message
/match end :choose winning team
       --> then showing confirmation for settle scores and
            --> and optionally unsetteling scores
/match remove

/match bets on
/match bets off

.2 Posting Matches
	•	Up to 10 (or more) matches per competition, flexible enough to handle additional games if needed.
	•	Match display in consolidated embeds (one embed per matchday or per competition round).
	•	The embed might list each matchup as:

Southampton +0.5 @1.80
Liverpool -0.5 @2.00


	•	Or for 1X2:

Southampton 3.60  | Draw 3.30 |  Liverpool 1.80


	•	Users will respond with their bets (Home, Away, or No Bet).

2.3 Access & Security
	•	Only Admins can add/edit matches and finalize results.
	•	Future possibility of token-gating certain features or channels for DOGW holders.

3.2 Match Details
	•	Home Team, Away Team
	•	Handicap lines (±0, ±0.25, ±0.5 … up to ±4.0, including quarter increments)
	•	Odds (always decimal)
	•	No Bet option for users who skip a match.

3.3 Odds Updates
	•	Initially, no mid-week changes to odds; lines can be “locked” upon posting or changed by admins manually (if needed).

Betting Mechanics
4.1 Placing Bets
	•	Users pick Home, Away, or No Bet on the posted lines.
	•	You may eventually introduce a custom stake system, but in Phase One, each bet is effectively 100 points by default.

4.2 Stake & Bankroll
	•	Users have a virtual bankroll and track profit/loss accordingly.
	•	Each bet deducts 100 points from the user’s “bankroll” if they lose; if they win, they get stake * odds.

4.3 Half & Quarter Handicap Handling
	•	For a .25 or .75 line, half the stake is refunded in a “push” scenario.
	•	Ideally automated: When the admin enters a final score, the system calculates if it’s half-win, half-loss, or push.

4.4 Cutoffs & Locking
	•	Bet cutoff at kickoff time. After that, no bets are accepted.
	•	If a user attempts to place a bet after kickoff, it should be rejected automatically.

4.5 Postponed/Voided Matches
	•	If a match is postponed, all bets are voided and the user’s stake is returned.
*/

import {
  ChannelType,
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { ulid } from "ulid";
import { createMatchButtons } from "../events/handleMatchButton";
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
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Get match info")
        .addStringOption((option) =>
          option
            .setName("id-or-name")
            .setDescription("Match ID to get info")
            .setAutocomplete(true)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new match")
        .addStringOption((option) =>
          option
            .setName("league")
            .setDescription("League ID where to create match")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("home-team")
            .setDescription("Home team name")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("away-team")
            .setDescription("Away team name")
            .setRequired(true),
        )
        .addNumberOption((option) =>
          option
            .setName("home-odds")
            .setDescription("Odds for home team")
            .setRequired(true),
        )
        .addNumberOption((option) =>
          option
            .setName("away-odds")
            .setDescription("Odds for away team")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("match-date")
            .setDescription("Date and time of the match. Format: MM-DD-YYYY")
            .setRequired(true),
        )
        .addNumberOption((option) =>
          option.setName("draw-odds").setDescription("Odds for draw"),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Update match details")
        .addStringOption((option) =>
          option
            .setName("id-or-name")
            .setDescription("Match ID to update")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addNumberOption((option) =>
          option.setName("home-odds").setDescription("New home team odds"),
        )
        .addNumberOption((option) =>
          option.setName("away-odds").setDescription("New away team odds"),
        )
        .addBooleanOption((option) =>
          option
            .setName("betting-lock-status")
            .setDescription("Enable/Disable betting for this match"),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("end")
        .setDescription("End a match and settle scores")
        .addStringOption((option) =>
          option
            .setName("id-or-name")
            .setDescription("Match ID to end")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addNumberOption((option) =>
          option
            .setName("home-score")
            .setDescription("Home team score")
            .setRequired(true),
        )
        .addNumberOption((option) =>
          option
            .setName("away-score")
            .setDescription("Away team score")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("cancel")
        .setDescription("Cancel/Void a match")
        .addStringOption((option) =>
          option
            .setName("id-or-name")
            .setDescription("Match ID to cancel")
            .setAutocomplete(true)
            .setRequired(true),
        ),
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);

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
        (league) =>
          league.LeagueID.includes(focusedValue) ||
          league.LeagueName.includes(focusedValue),
      );

      await interaction.respond(
        filtered.map((choice) => ({
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
          .find({ isCompleted: false })
          .toArray();
        MyCache.set("matches", matches);
      }

      const filtered = matches.filter((match) =>
        match.matchId.includes(focusedValue),
      );

      await interaction.respond(
        filtered.map((choice) => ({
          name: `${choice.homeTeam} vs ${choice.awayTeam}`,
          value: choice.matchId,
        })),
      );
    }
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
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
      matchId: { $in: league.LeagueMatches.map((m) => m.matchId) },
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
          ? `Handicap: ${homeTeam} (${handicap})`
          : "No handicap applied",
      )
      .addFields(
        {
          name: homeTeam,
          value: `Odds: ${homeOdds}`,
          inline: true,
        },
        drawOdds
          ? { name: "Draw", value: `Odds: ${drawOdds}`, inline: true }
          : { name: "\u200B", value: "\u200B", inline: true },
        {
          name: awayTeam,
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
      content: `Match created successfully! ID: ${newMatch.matchId}`,
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
      name: "Final Score",
      value: `${match.homeTeam} ${homeScore} - ${awayScore} ${match.awayTeam}`,
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

  const bulkOps = match.UserBets.map((bet) => ({
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
