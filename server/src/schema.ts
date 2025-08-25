import { z } from 'zod';

// Player enum for tic-tac-toe
export const playerSchema = z.enum(['X', 'O']);
export type Player = z.infer<typeof playerSchema>;

// Game status enum
export const gameStatusSchema = z.enum(['waiting', 'in_progress', 'completed']);
export type GameStatus = z.infer<typeof gameStatusSchema>;

// Game result enum
export const gameResultSchema = z.enum(['X_wins', 'O_wins', 'draw', 'ongoing']);
export type GameResult = z.infer<typeof gameResultSchema>;

// Board cell schema - can be empty (null), X, or O
export const cellSchema = z.union([playerSchema, z.null()]);
export type Cell = z.infer<typeof cellSchema>;

// Board schema - 3x3 grid represented as array of 9 cells
export const boardSchema = z.array(cellSchema).length(9);
export type Board = z.infer<typeof boardSchema>;

// Game schema
export const gameSchema = z.object({
  id: z.number(),
  board: boardSchema,
  current_player: playerSchema,
  status: gameStatusSchema,
  result: gameResultSchema,
  winner: playerSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Game = z.infer<typeof gameSchema>;

// Input schema for creating a new game
export const createGameInputSchema = z.object({
  // No inputs needed - game starts with default values
});

export type CreateGameInput = z.infer<typeof createGameInputSchema>;

// Input schema for making a move
export const makeMoveInputSchema = z.object({
  game_id: z.number(),
  position: z.number().int().min(0).max(8), // 0-8 for 3x3 board positions
  player: playerSchema
});

export type MakeMoveInput = z.infer<typeof makeMoveInputSchema>;

// Input schema for resetting a game
export const resetGameInputSchema = z.object({
  game_id: z.number()
});

export type ResetGameInput = z.infer<typeof resetGameInputSchema>;

// Input schema for getting a specific game
export const getGameInputSchema = z.object({
  game_id: z.number()
});

export type GetGameInput = z.infer<typeof getGameInputSchema>;