import { serial, text, pgTable, timestamp, pgEnum, json } from 'drizzle-orm/pg-core';

// Define enums for the database
export const playerEnum = pgEnum('player', ['X', 'O']);
export const gameStatusEnum = pgEnum('game_status', ['waiting', 'in_progress', 'completed']);
export const gameResultEnum = pgEnum('game_result', ['X_wins', 'O_wins', 'draw', 'ongoing']);

export const gamesTable = pgTable('games', {
  id: serial('id').primaryKey(),
  board: json('board').notNull(), // Store 3x3 board as JSON array of 9 cells
  current_player: playerEnum('current_player').notNull(),
  status: gameStatusEnum('status').notNull(),
  result: gameResultEnum('result').notNull(),
  winner: playerEnum('winner'), // Nullable - only set when game is won
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// TypeScript types for the table schema
export type Game = typeof gamesTable.$inferSelect; // For SELECT operations
export type NewGame = typeof gamesTable.$inferInsert; // For INSERT operations

// Important: Export all tables and relations for proper query building
export const tables = { games: gamesTable };