import { ObjectId } from 'mongodb';
import { z } from 'zod';

export const UserRanks = {
  Ferro1: 0,
  Ferro2: 10,
  Ferro3: 20,
  Bronze1: 30,
  Bronze2: 40,
  Bronze3: 50,
  Prata1: 60,
  Prata2: 70,
  Prata3: 80,
  Ouro1: 90,
  Ouro2: 100,
  Ouro3: 110,
  Platina1: 120,
  Platina2: 130,
  Platina3: 140,
  Diamante1: 150,
  Diamante2: 160,
  Diamante3: 170,
  Ascendente1: 180,
  Ascendente2: 190,
  Ascendente3: 200,
  Imortal1: 210,
  Imortal2: 220,
  Imortal3: 230,
  Radiante: 240,
} as const;

export type UserRankTypes = keyof typeof UserRanks;

export const DiscordUserSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  userId: z.string(),
  username: z.string(),

  isActive: z.boolean().optional().default(false),
  InGameUsername: z.string().max(50),

  InGameScore: z.number().min(0).max(50).default(0),
  InGameRank: z
    .enum(Object.keys(UserRanks) as [UserRankTypes, ...UserRankTypes[]])
    .optional()
    .default('Ferro1'),

  GamesPlayed: z.number().optional().default(0),

  GamesWin: z.number().optional().default(0),
  GamesDraw: z.number().optional().default(0),
  GamesLose: z.number().optional().default(0),

  updatedAt: z
    .date()
    .optional()
    .default(() => new Date()),
});

export type DiscordUser = z.infer<typeof DiscordUserSchema>;
