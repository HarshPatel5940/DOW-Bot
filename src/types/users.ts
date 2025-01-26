import { ObjectId } from 'mongodb';
import { z } from 'zod';

export const DiscordUserSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  userId: z.string(),
  username: z.string(),

  userPoints: z.number().default(100),

  BetsPlaced: z.number().default(0),
  BetsWithdrawn: z.number().default(0),

  BetsCorrect: z.number().default(0),
  BetsIncorrect: z.number().default(0),

  profits: z.number().default(0),
  loss: z.number().default(0),

  WinStreakCurrent: z.number().default(0),
  WinStreakMax: z.number().default(0),

  LooseStreakCurrent: z.number().default(0),
  LooseStreakMax: z.number().default(0),

  updatedAt: z
    .date()
    .optional()
    .default(() => new Date()),
});

export type DiscordUser = z.infer<typeof DiscordUserSchema>;
