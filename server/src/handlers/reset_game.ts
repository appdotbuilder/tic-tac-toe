import { db } from '../db';
import { gamesTable } from '../db/schema';
import { type ResetGameInput, type Game } from '../schema';
import { eq } from 'drizzle-orm';

export const resetGame = async (input: ResetGameInput): Promise<Game> => {
  try {
    // First verify the game exists
    const existingGame = await db.select()
      .from(gamesTable)
      .where(eq(gamesTable.id, input.game_id))
      .execute();

    if (existingGame.length === 0) {
      throw new Error(`Game with ID ${input.game_id} not found`);
    }

    // Reset the game to initial state
    const emptyBoard = Array(9).fill(null); // Reset to empty 3x3 board
    
    const result = await db.update(gamesTable)
      .set({
        board: emptyBoard,
        current_player: 'X', // X always starts first
        status: 'in_progress',
        result: 'ongoing',
        winner: null,
        updated_at: new Date()
      })
      .where(eq(gamesTable.id, input.game_id))
      .returning()
      .execute();

    const game = result[0];
    return {
      ...game,
      board: game.board as ('X' | 'O' | null)[] // Type assertion for JSON board column
    };
  } catch (error) {
    console.error('Game reset failed:', error);
    throw error;
  }
};