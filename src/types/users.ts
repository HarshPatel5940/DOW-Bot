import { ObjectId } from "mongodb";
import { z } from "zod";

export const DiscordUserSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  userId: z.string(),
  username: z.string(),

  userPoints: z.number().default(100),

  BetsPlaced: z.number().default(0),

  BetsCorrect: z.number().default(0),
  BetsIncorrect: z.number().default(0),

  profits: z.number().default(0),
  loss: z.number().default(0),

  roi: z.number().default(0),
  StakeInvestment: z.number().default(0),

  WinStreakCurrent: z.number().default(0),
  WinStreakMax: z.number().default(0),

  LooseStreakCurrent: z.number().default(0),
  LooseStreakMax: z.number().default(0),

  Investment1x2: z.number().default(0),
  InvestmentAsianHandicap: z.number().default(0),
  ROI1x2: z.number().default(0),
  ROIAsianHandicap: z.number().default(0),

  updatedAt: z
    .date()
    .optional()
    .default(() => new Date()),
});

export type DiscordUser = z.infer<typeof DiscordUserSchema>;
