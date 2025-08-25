import { db } from '../db';
import { gamesTable } from '../db/schema';
import { type GetGameInput, type Game } from '../schema';
import { eq } from 'drizzle-orm';

export const getGame = async (input: GetGameInput): Promise<Game | null> => {
  try {
    // Query the game by ID
    const results = await db.select()
      .from(gamesTable)
      .where(eq(gamesTable.id, input.game_id))
      .execute();

    // Return null if game not found
    if (results.length === 0) {
      return null;
    }

    const game = results[0];
    
    // Return the game with proper type conversion
    return {
      ...game,
      board: game.board as Game['board'], // JSON field - cast to proper type
      created_at: new Date(game.created_at), // Ensure Date type
      updated_at: new Date(game.updated_at)  // Ensure Date type
    };
  } catch (error) {
    console.error('Get game failed:', error);
    throw error;
  }
};