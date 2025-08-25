import { db } from '../db';
import { gamesTable } from '../db/schema';
import { type Game } from '../schema';
import { desc } from 'drizzle-orm';

export async function getGames(): Promise<Game[]> {
  try {
    // Fetch all games ordered by most recent first
    const results = await db.select()
      .from(gamesTable)
      .orderBy(desc(gamesTable.created_at))
      .execute();

    // Transform results to match the expected Game type
    // The board field comes back as unknown from JSON, so we need to cast it
    return results.map(result => ({
      ...result,
      board: result.board as Game['board'] // Cast JSON board to proper type
    }));
  } catch (error) {
    console.error('Failed to fetch games:', error);
    throw error;
  }
}