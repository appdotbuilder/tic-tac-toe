import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gamesTable } from '../db/schema';
import { type Game } from '../schema';
import { getGames } from '../handlers/get_games';

// Helper function to create a test game
const createTestGame = async (overrides: Partial<typeof gamesTable.$inferInsert> = {}) => {
  const defaultGame = {
    board: [null, null, null, null, null, null, null, null, null],
    current_player: 'X' as const,
    status: 'waiting' as const,
    result: 'ongoing' as const,
    winner: null,
    ...overrides
  };

  const result = await db.insert(gamesTable)
    .values(defaultGame)
    .returning()
    .execute();

  return result[0];
};

describe('getGames', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no games exist', async () => {
    const result = await getGames();
    
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all games from database', async () => {
    // Create multiple test games
    const game1 = await createTestGame({
      status: 'waiting'
    });
    const game2 = await createTestGame({
      status: 'in_progress',
      current_player: 'O'
    });
    const game3 = await createTestGame({
      status: 'completed',
      result: 'X_wins',
      winner: 'X'
    });

    const result = await getGames();

    expect(result).toHaveLength(3);
    
    // Verify all games are returned
    const gameIds = result.map(game => game.id);
    expect(gameIds).toContain(game1.id);
    expect(gameIds).toContain(game2.id);
    expect(gameIds).toContain(game3.id);
  });

  it('should return games ordered by most recent first', async () => {
    // Create games with slight delay to ensure different timestamps
    const firstGame = await createTestGame({ status: 'waiting' });
    
    // Small delay to ensure different created_at times
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const secondGame = await createTestGame({ status: 'in_progress' });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const thirdGame = await createTestGame({ status: 'completed' });

    const result = await getGames();

    expect(result).toHaveLength(3);
    
    // Should be ordered by created_at descending (most recent first)
    expect(result[0].id).toBe(thirdGame.id);
    expect(result[1].id).toBe(secondGame.id);
    expect(result[2].id).toBe(firstGame.id);
    
    // Verify timestamps are properly ordered
    expect(result[0].created_at.getTime()).toBeGreaterThanOrEqual(result[1].created_at.getTime());
    expect(result[1].created_at.getTime()).toBeGreaterThanOrEqual(result[2].created_at.getTime());
  });

  it('should return games with correct schema structure', async () => {
    const testBoard: ('X' | 'O' | null)[] = ['X', null, 'O', null, 'X', null, 'O', null, 'X'];
    const testGame = await createTestGame({
      board: testBoard,
      current_player: 'O',
      status: 'in_progress',
      result: 'ongoing'
    });

    const result = await getGames();

    expect(result).toHaveLength(1);
    const game = result[0];

    // Verify all required fields are present
    expect(game.id).toBeDefined();
    expect(game.board).toEqual(testBoard);
    expect(game.current_player).toBe('O');
    expect(game.status).toBe('in_progress');
    expect(game.result).toBe('ongoing');
    expect(game.winner).toBeNull();
    expect(game.created_at).toBeInstanceOf(Date);
    expect(game.updated_at).toBeInstanceOf(Date);
  });

  it('should handle games with different statuses and results', async () => {
    // Create games with different combinations of status/result
    await createTestGame({
      status: 'waiting',
      result: 'ongoing',
      winner: null
    });

    await createTestGame({
      status: 'in_progress', 
      result: 'ongoing',
      winner: null
    });

    await createTestGame({
      status: 'completed',
      result: 'X_wins',
      winner: 'X'
    });

    await createTestGame({
      status: 'completed',
      result: 'O_wins',
      winner: 'O'
    });

    await createTestGame({
      status: 'completed',
      result: 'draw',
      winner: null
    });

    const result = await getGames();

    expect(result).toHaveLength(5);
    
    // Verify all different statuses are represented
    const statuses = result.map(game => game.status);
    expect(statuses).toContain('waiting');
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('completed');
    
    // Verify all different results are represented
    const results = result.map(game => game.result);
    expect(results).toContain('ongoing');
    expect(results).toContain('X_wins');
    expect(results).toContain('O_wins');
    expect(results).toContain('draw');
  });

  it('should handle complex board states correctly', async () => {
    const complexBoard: ('X' | 'O' | null)[] = ['X', 'O', 'X', 'O', 'X', 'O', null, null, null];
    
    await createTestGame({
      board: complexBoard,
      current_player: 'X',
      status: 'in_progress'
    });

    const result = await getGames();
    
    expect(result).toHaveLength(1);
    expect(result[0].board).toEqual(complexBoard);
    
    // Verify board maintains correct structure
    expect(Array.isArray(result[0].board)).toBe(true);
    expect(result[0].board).toHaveLength(9);
  });
});