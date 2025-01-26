import { ObjectId } from "mongodb";
import { z } from "zod";

export const MatchUserSchema = z.object({
  UserID: z.string(),
  StakeAmount: z.number().optional().default(100),
  StakeOn: z.enum(["home", "away"]).optional(),
  StakeGiven: z.boolean().optional().default(false),
});

export type MatchUserType = z.infer<typeof MatchUserSchema>;

export const MatchSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),

  matchId: z.string().ulid(),
  matchMsgChannel: z.string(),
  matchMsgId: z.string(),

  homeTeam: z.string(),
  awayTeam: z.string(),

  homeTeamScore: z.number().optional(),
  awayTeamScore: z.number().optional(),

  homeTeamOdds: z.number().optional(),
  awayTeamOdds: z.number().optional(),

  totalBets: z.number().optional().default(0),

  UserBets: z.array(MatchUserSchema),

  StakeGiven: z.boolean().optional().default(false),

  isStarted: z.boolean().optional().default(false),
  isAborted: z.boolean().optional().default(false),
  isDraw: z.boolean().optional().default(false),
  isCompleted: z.boolean().optional().default(false),

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
