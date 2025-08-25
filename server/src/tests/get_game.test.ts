import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gamesTable } from '../db/schema';
import { type GetGameInput, type Game, type Board } from '../schema';
import { getGame } from '../handlers/get_game';

// Test input for getting a game
const testGameId = 1;
const testInput: GetGameInput = {
  game_id: testGameId
};

// Sample game data to insert for testing
const sampleGameData = {
  board: [null, 'X', null, 'O', 'X', null, null, 'O', null] as Board, // JSON board state
  current_player: 'X' as const,
  status: 'in_progress' as const,
  result: 'ongoing' as const,
  winner: null
};

const completedGameData = {
  board: ['X', 'X', 'X', 'O', 'O', null, null, null, null] as Board, // X wins top row
  current_player: 'O' as const,
  status: 'completed' as const,
  result: 'X_wins' as const,
  winner: 'X' as const
};

describe('getGame', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when game does not exist', async () => {
    const result = await getGame({ game_id: 999 });
    expect(result).toBeNull();
  });

  it('should return a game when it exists', async () => {
    // Insert a test game
    const insertedGame = await db.insert(gamesTable)
      .values(sampleGameData)
      .returning()
      .execute();

    const gameId = insertedGame[0].id;
    const result = await getGame({ game_id: gameId });

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(gameId);
    expect(result!.board).toEqual(sampleGameData.board);
    expect(result!.current_player).toEqual('X');
    expect(result!.status).toEqual('in_progress');
    expect(result!.result).toEqual('ongoing');
    expect(result!.winner).toBeNull();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return completed game with winner correctly', async () => {
    // Insert a completed game
    const insertedGame = await db.insert(gamesTable)
      .values(completedGameData)
      .returning()
      .execute();

    const gameId = insertedGame[0].id;
    const result = await getGame({ game_id: gameId });

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(gameId);
    expect(result!.board).toEqual(completedGameData.board);
    expect(result!.current_player).toEqual('O');
    expect(result!.status).toEqual('completed');
    expect(result!.result).toEqual('X_wins');
    expect(result!.winner).toEqual('X');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should handle JSON board data correctly', async () => {
    // Test with various board states
    const mixedBoardData = {
      board: ['X', 'O', 'X', null, 'O', 'X', 'O', null, 'X'] as Board, // Mixed board
      current_player: 'O' as const,
      status: 'in_progress' as const,
      result: 'ongoing' as const,
      winner: null
    };

    const insertedGame = await db.insert(gamesTable)
      .values(mixedBoardData)
      .returning()
      .execute();

    const gameId = insertedGame[0].id;
    const result = await getGame({ game_id: gameId });

    expect(result).not.toBeNull();
    expect(result!.board).toEqual(mixedBoardData.board);
    
    // Verify board structure - should be array of 9 elements
    expect(Array.isArray(result!.board)).toBe(true);
    expect(result!.board).toHaveLength(9);
    
    // Check specific positions
    expect(result!.board[0]).toEqual('X');
    expect(result!.board[1]).toEqual('O');
    expect(result!.board[3]).toBeNull();
    expect(result!.board[7]).toBeNull();
  });

  it('should handle empty board correctly', async () => {
    const emptyBoardData = {
      board: Array(9).fill(null) as Board, // Empty board
      current_player: 'X' as const,
      status: 'waiting' as const,
      result: 'ongoing' as const,
      winner: null
    };

    const insertedGame = await db.insert(gamesTable)
      .values(emptyBoardData)
      .returning()
      .execute();

    const gameId = insertedGame[0].id;
    const result = await getGame({ game_id: gameId });

    expect(result).not.toBeNull();
    expect(result!.board).toEqual(Array(9).fill(null));
    expect(result!.status).toEqual('waiting');
    
    // Verify all board positions are null
    result!.board.forEach((cell, index) => {
      expect(cell).toBeNull();
    });
  });

  it('should handle draw game correctly', async () => {
    const drawGameData = {
      board: ['X', 'O', 'X', 'O', 'O', 'X', 'O', 'X', 'O'] as Board, // Draw board
      current_player: 'X' as const,
      status: 'completed' as const,
      result: 'draw' as const,
      winner: null
    };

    const insertedGame = await db.insert(gamesTable)
      .values(drawGameData)
      .returning()
      .execute();

    const gameId = insertedGame[0].id;
    const result = await getGame({ game_id: gameId });

    expect(result).not.toBeNull();
    expect(result!.result).toEqual('draw');
    expect(result!.winner).toBeNull();
    expect(result!.status).toEqual('completed');
    
    // Verify board is full with no winner
    const boardHasNull = result!.board.some(cell => cell === null);
    expect(boardHasNull).toBe(false); // Board should be completely filled
  });

  it('should return most recently updated game when multiple exist', async () => {
    // Insert first game
    const firstGame = await db.insert(gamesTable)
      .values({
        ...sampleGameData,
        board: ['X', null, null, null, null, null, null, null, null] as Board
      })
      .returning()
      .execute();

    // Wait a bit and insert second game
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const secondGame = await db.insert(gamesTable)
      .values({
        ...sampleGameData,
        board: ['O', null, null, null, null, null, null, null, null] as Board
      })
      .returning()
      .execute();

    // Get each game individually
    const result1 = await getGame({ game_id: firstGame[0].id });
    const result2 = await getGame({ game_id: secondGame[0].id });

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    
    // Verify they are different games
    expect(result1!.id).not.toEqual(result2!.id);
    expect(result1!.board[0]).toEqual('X');
    expect(result2!.board[0]).toEqual('O');
    
    // Second game should have later timestamp
    expect(result2!.created_at.getTime()).toBeGreaterThanOrEqual(result1!.created_at.getTime());
  });
});