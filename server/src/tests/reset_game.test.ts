import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gamesTable } from '../db/schema';
import { type ResetGameInput } from '../schema';
import { resetGame } from '../handlers/reset_game';
import { eq } from 'drizzle-orm';

describe('resetGame', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should reset a game to initial state', async () => {
    // Create a game with some moves made
    const gameResult = await db.insert(gamesTable)
      .values({
        board: ['X', 'O', 'X', null, 'O', null, null, null, null], // Partially played game
        current_player: 'O',
        status: 'in_progress',
        result: 'ongoing',
        winner: null
      })
      .returning()
      .execute();

    const gameId = gameResult[0].id;
    const input: ResetGameInput = { game_id: gameId };

    const result = await resetGame(input);

    // Verify reset state
    expect(result.id).toEqual(gameId);
    expect(result.board).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(result.current_player).toEqual('X');
    expect(result.status).toEqual('in_progress');
    expect(result.result).toEqual('ongoing');
    expect(result.winner).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should reset a completed game', async () => {
    // Create a completed game
    const gameResult = await db.insert(gamesTable)
      .values({
        board: ['X', 'X', 'X', 'O', 'O', null, null, null, null], // X wins
        current_player: 'O',
        status: 'completed',
        result: 'X_wins',
        winner: 'X'
      })
      .returning()
      .execute();

    const gameId = gameResult[0].id;
    const input: ResetGameInput = { game_id: gameId };

    const result = await resetGame(input);

    // Verify the game is reset to initial state
    expect(result.id).toEqual(gameId);
    expect(result.board).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(result.current_player).toEqual('X');
    expect(result.status).toEqual('in_progress');
    expect(result.result).toEqual('ongoing');
    expect(result.winner).toBeNull();
  });

  it('should update the database correctly', async () => {
    // Create a game
    const gameResult = await db.insert(gamesTable)
      .values({
        board: ['X', 'O', null, null, null, null, null, null, null],
        current_player: 'X',
        status: 'in_progress',
        result: 'ongoing',
        winner: null
      })
      .returning()
      .execute();

    const gameId = gameResult[0].id;
    const input: ResetGameInput = { game_id: gameId };

    await resetGame(input);

    // Query the database to verify the reset
    const games = await db.select()
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
      .execute();

    expect(games).toHaveLength(1);
    const game = games[0];
    expect(game.board).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(game.current_player).toEqual('X');
    expect(game.status).toEqual('in_progress');
    expect(game.result).toEqual('ongoing');
    expect(game.winner).toBeNull();
    expect(game.updated_at).toBeInstanceOf(Date);
  });

  it('should preserve original created_at timestamp', async () => {
    // Create a game with a specific created_at time
    const originalTime = new Date('2023-01-01T12:00:00Z');
    const gameResult = await db.insert(gamesTable)
      .values({
        board: ['X', 'O', null, null, null, null, null, null, null],
        current_player: 'X',
        status: 'in_progress',
        result: 'ongoing',
        winner: null,
        created_at: originalTime
      })
      .returning()
      .execute();

    const gameId = gameResult[0].id;
    const input: ResetGameInput = { game_id: gameId };

    const result = await resetGame(input);

    // Verify created_at is preserved while updated_at is new
    expect(result.created_at).toEqual(originalTime);
    expect(result.updated_at).not.toEqual(originalTime);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should handle waiting games', async () => {
    // Create a game in waiting status
    const gameResult = await db.insert(gamesTable)
      .values({
        board: [null, null, null, null, null, null, null, null, null],
        current_player: 'X',
        status: 'waiting',
        result: 'ongoing',
        winner: null
      })
      .returning()
      .execute();

    const gameId = gameResult[0].id;
    const input: ResetGameInput = { game_id: gameId };

    const result = await resetGame(input);

    // Verify the game is reset to in_progress status
    expect(result.status).toEqual('in_progress');
    expect(result.board).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(result.current_player).toEqual('X');
  });

  it('should throw error for non-existent game', async () => {
    const input: ResetGameInput = { game_id: 999 };

    await expect(resetGame(input)).rejects.toThrow(/Game with ID 999 not found/);
  });

  it('should update timestamp correctly', async () => {
    // Create a game
    const gameResult = await db.insert(gamesTable)
      .values({
        board: ['X', null, null, null, null, null, null, null, null],
        current_player: 'O',
        status: 'in_progress',
        result: 'ongoing',
        winner: null
      })
      .returning()
      .execute();

    const gameId = gameResult[0].id;
    const originalUpdatedAt = gameResult[0].updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const input: ResetGameInput = { game_id: gameId };
    const result = await resetGame(input);

    // Verify updated_at is newer
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});