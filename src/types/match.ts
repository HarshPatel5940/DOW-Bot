import { ObjectId } from "mongodb";
import { z } from "zod";

export const MatchUserSchema = z.object({
  UserID: z.string(),
  StakeAmount: z.number().optional().default(100),
  StakeOn: z.enum(["home", "away", "draw"]).optional(),
  StakeGiven: z.boolean().optional().default(false),

  CorrectGuesses: z.number().optional().default(0),
});

export type MatchUserType = z.infer<typeof MatchUserSchema>;

export const HandicapType = z.enum([
  "+0",
  "+0.25",
  "+0.5",
  "+0.75",
  "+1",
  "+1.25",
  "+1.5",
  "+1.75",
  "+2",
  "-0",
  "-0.25",
  "-0.5",
  "-0.75",
  "-1",
  "-1.25",
  "-1.5",
  "-1.75",
  "-2",
]);

export const MatchSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),

  matchId: z.string().ulid(),
  matchMsgChannel: z.string(),
  matchMsgId: z.string(),

  homeTeam: z.string(),
  awayTeam: z.string(),

  homeTeamScore: z.number().optional(),
  awayTeamScore: z.number().optional(),

  homeTeamHandicap: HandicapType.optional(),
  awayTeamHandicap: HandicapType.optional(),

  homeTeamOdds: z.number().optional(),
  awayTeamOdds: z.number().optional(),
  draw: z.boolean().optional().default(false),
  drawOdds: z.number().optional(),

  UserBets: z.array(MatchUserSchema),
  totalBets: z.number().optional().default(0),
  BetsLocked: z.boolean().optional().default(false),

  StakeGiven: z.boolean().optional().default(false),
  isStarted: z.boolean().optional().default(false),
  isAborted: z.boolean().optional().default(false),
  isDraw: z.boolean().optional().default(false),
  isCompleted: z.boolean().optional().default(false),

  matchDate: z.date().default(() => new Date()),
  venue: z.string(),
  kickoffTime: z.string(),

  updatedAt: z
    .date()
    .optional()
    .default(() => new Date()),
});

export type MatchType = z.infer<typeof MatchSchema>;

export const LeagueSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),

  LeagueID: z.string().ulid(),
  LeagueName: z.string(),
  LeagueDescription: z.string(),
  LeagueChannel: z.string(),

  LeagueStartDate: z.date(),
  LeagueEndDate: z.date(),

  LeagueMatches: z.array(
    z.object({
      matchId: z.string().ulid(),
    }),
  ),

  IsLeagueCompleted: z.boolean().optional().default(false),

  updatedAt: z
    .date()
    .optional()
    .default(() => new Date()),
});

export type LeagueType = z.infer<typeof LeagueSchema>;
