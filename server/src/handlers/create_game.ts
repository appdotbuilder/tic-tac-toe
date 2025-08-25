import { db } from '../db';
import { gamesTable } from '../db/schema';
import { type CreateGameInput, type Game } from '../schema';

export const createGame = async (input: CreateGameInput): Promise<Game> => {
  try {
    // Create empty 3x3 board represented as array of 9 null cells
    const emptyBoard = Array(9).fill(null);
    
    // Insert new game record with initial state
    const result = await db.insert(gamesTable)
      .values({
        board: emptyBoard, // JSON column - no conversion needed
        current_player: 'X', // X always starts first
        status: 'in_progress', // Game starts immediately
        result: 'ongoing', // No winner yet
        winner: null // No winner initially
      })
      .returning()
      .execute();

    const game = result[0];
    return {
      ...game,
      board: game.board as (null | 'X' | 'O')[] // Type assertion for JSON field
    };
  } catch (error) {
    console.error('Game creation failed:', error);
    throw error;
  }
};