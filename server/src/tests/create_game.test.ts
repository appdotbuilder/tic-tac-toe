import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gamesTable } from '../db/schema';
import { type CreateGameInput } from '../schema';
import { createGame } from '../handlers/create_game';
import { eq } from 'drizzle-orm';

// Simple test input - no inputs needed for creating a game
const testInput: CreateGameInput = {};

describe('createGame', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a new game with correct initial state', async () => {
    const result = await createGame(testInput);

    // Verify basic properties
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Verify game state
    expect(result.current_player).toEqual('X');
    expect(result.status).toEqual('in_progress');
    expect(result.result).toEqual('ongoing');
    expect(result.winner).toBeNull();
    
    // Verify board is empty 3x3 grid
    expect(result.board).toHaveLength(9);
    expect(result.board.every(cell => cell === null)).toBe(true);
  });

  it('should save game to database correctly', async () => {
    const result = await createGame(testInput);

    // Query the database to verify the game was saved
    const games = await db.select()
      .from(gamesTable)
      .where(eq(gamesTable.id, result.id))
      .execute();

    expect(games).toHaveLength(1);
    
    const savedGame = games[0];
    expect(savedGame.id).toEqual(result.id);
    expect(savedGame.current_player).toEqual('X');
    expect(savedGame.status).toEqual('in_progress');
    expect(savedGame.result).toEqual('ongoing');
    expect(savedGame.winner).toBeNull();
    expect(savedGame.created_at).toBeInstanceOf(Date);
    expect(savedGame.updated_at).toBeInstanceOf(Date);
    
    // Verify board JSON structure
    expect(Array.isArray(savedGame.board)).toBe(true);
    expect((savedGame.board as unknown[]).length).toBe(9);
    expect((savedGame.board as unknown[]).every(cell => cell === null)).toBe(true);
  });

  it('should create multiple games with unique IDs', async () => {
    const game1 = await createGame(testInput);
    const game2 = await createGame(testInput);
    const game3 = await createGame(testInput);

    // Each game should have a unique ID
    expect(game1.id).not.toEqual(game2.id);
    expect(game2.id).not.toEqual(game3.id);
    expect(game1.id).not.toEqual(game3.id);

    // All games should have the same initial state
    [game1, game2, game3].forEach(game => {
      expect(game.current_player).toEqual('X');
      expect(game.status).toEqual('in_progress');
      expect(game.result).toEqual('ongoing');
      expect(game.winner).toBeNull();
      expect(game.board).toHaveLength(9);
      expect(game.board.every(cell => cell === null)).toBe(true);
    });

    // Verify all games are in the database
    const allGames = await db.select()
      .from(gamesTable)
      .execute();

    expect(allGames).toHaveLength(3);
  });

  it('should handle board JSON serialization properly', async () => {
    const result = await createGame(testInput);

    // Verify the board structure after database round-trip
    expect(result.board).toEqual([null, null, null, null, null, null, null, null, null]);
    
    // Verify we can access individual positions
    for (let i = 0; i < 9; i++) {
      expect(result.board[i]).toBeNull();
    }

    // Verify the board is properly typed
    expect(typeof result.board).toBe('object');
    expect(Array.isArray(result.board)).toBe(true);
  });

  it('should set correct timestamps', async () => {
    const beforeCreation = new Date();
    const result = await createGame(testInput);
    const afterCreation = new Date();

    // Timestamps should be within the test execution window
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.updated_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());

    // created_at and updated_at should be very close (same operation)
    const timeDifference = Math.abs(result.updated_at.getTime() - result.created_at.getTime());
    expect(timeDifference).toBeLessThan(1000); // Less than 1 second difference
  });
});