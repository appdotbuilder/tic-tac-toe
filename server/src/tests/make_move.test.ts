import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gamesTable } from '../db/schema';
import { type MakeMoveInput, type Board } from '../schema';
import { makeMove } from '../handlers/make_move';
import { eq } from 'drizzle-orm';

// Helper function to create a test game
const createTestGame = async (board: Board = Array(9).fill(null), currentPlayer: 'X' | 'O' = 'X') => {
  const result = await db.insert(gamesTable)
    .values({
      board: board,
      current_player: currentPlayer,
      status: 'in_progress',
      result: 'ongoing',
      winner: null
    })
    .returning()
    .execute();
  
  return result[0];
};

describe('makeMove', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should make a valid move successfully', async () => {
    const game = await createTestGame();
    
    const input: MakeMoveInput = {
      game_id: game.id,
      position: 4, // Center position
      player: 'X'
    };

    const result = await makeMove(input);

    expect(result.id).toEqual(game.id);
    expect(result.board[4]).toEqual('X');
    expect(result.current_player).toEqual('O'); // Should switch to next player
    expect(result.status).toEqual('in_progress');
    expect(result.result).toEqual('ongoing');
    expect(result.winner).toBeNull();
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save move to database correctly', async () => {
    const game = await createTestGame();
    
    const input: MakeMoveInput = {
      game_id: game.id,
      position: 0,
      player: 'X'
    };

    await makeMove(input);

    // Verify database was updated
    const updatedGames = await db.select()
      .from(gamesTable)
      .where(eq(gamesTable.id, game.id))
      .execute();

    const updatedGame = updatedGames[0];
    const board = updatedGame.board as Board;
    
    expect(board[0]).toEqual('X');
    expect(updatedGame.current_player).toEqual('O');
    expect(updatedGame.status).toEqual('in_progress');
  });

  it('should detect horizontal win condition', async () => {
    // Create board with X about to win horizontally in top row
    const boardNearWin: Board = [
      'X', 'X', null,  // Top row - X needs position 2 to win
      null, null, null,
      null, null, null
    ];
    
    const game = await createTestGame(boardNearWin, 'X');
    
    const input: MakeMoveInput = {
      game_id: game.id,
      position: 2, // Complete the winning row
      player: 'X'
    };

    const result = await makeMove(input);

    expect(result.board[2]).toEqual('X');
    expect(result.status).toEqual('completed');
    expect(result.result).toEqual('X_wins');
    expect(result.winner).toEqual('X');
    expect(result.current_player).toEqual('X'); // Should stay same when game ends
  });

  it('should detect vertical win condition', async () => {
    // Create board with O about to win vertically in first column
    const boardNearWin: Board = [
      'O', null, null,  // First column - O needs position 6 to win
      'O', null, null,
      null, null, null
    ];
    
    const game = await createTestGame(boardNearWin, 'O');
    
    const input: MakeMoveInput = {
      game_id: game.id,
      position: 6, // Complete the winning column
      player: 'O'
    };

    const result = await makeMove(input);

    expect(result.board[6]).toEqual('O');
    expect(result.status).toEqual('completed');
    expect(result.result).toEqual('O_wins');
    expect(result.winner).toEqual('O');
  });

  it('should detect diagonal win condition', async () => {
    // Create board with X about to win diagonally
    const boardNearWin: Board = [
      'X', null, null,  // Diagonal - X needs position 8 to win
      null, 'X', null,
      null, null, null
    ];
    
    const game = await createTestGame(boardNearWin, 'X');
    
    const input: MakeMoveInput = {
      game_id: game.id,
      position: 8, // Complete the winning diagonal
      player: 'X'
    };

    const result = await makeMove(input);

    expect(result.board[8]).toEqual('X');
    expect(result.status).toEqual('completed');
    expect(result.result).toEqual('X_wins');
    expect(result.winner).toEqual('X');
  });

  it('should detect draw condition', async () => {
    // Create board that will be full after next move with no winner
    const boardNearDraw: Board = [
      'X', 'O', 'X',
      'O', 'O', 'X',
      'X', 'X', null  // Only position 8 left
    ];
    
    const game = await createTestGame(boardNearDraw, 'O');
    
    const input: MakeMoveInput = {
      game_id: game.id,
      position: 8, // Fill last position
      player: 'O'
    };

    const result = await makeMove(input);

    expect(result.board[8]).toEqual('O');
    expect(result.status).toEqual('completed');
    expect(result.result).toEqual('draw');
    expect(result.winner).toBeNull();
  });

  it('should throw error if game does not exist', async () => {
    const input: MakeMoveInput = {
      game_id: 999, // Non-existent game
      position: 0,
      player: 'X'
    };

    await expect(makeMove(input)).rejects.toThrow(/game with id 999 not found/i);
  });

  it('should throw error if game is already completed', async () => {
    // Create completed game
    const result = await db.insert(gamesTable)
      .values({
        board: ['X', 'X', 'X', null, null, null, null, null, null],
        current_player: 'X',
        status: 'completed',
        result: 'X_wins',
        winner: 'X'
      })
      .returning()
      .execute();
    
    const completedGame = result[0];
    
    const input: MakeMoveInput = {
      game_id: completedGame.id,
      position: 3,
      player: 'O'
    };

    await expect(makeMove(input)).rejects.toThrow(/game is already completed/i);
  });

  it('should throw error if not correct player turn', async () => {
    const game = await createTestGame(Array(9).fill(null), 'X'); // X's turn
    
    const input: MakeMoveInput = {
      game_id: game.id,
      position: 0,
      player: 'O' // Wrong player
    };

    await expect(makeMove(input)).rejects.toThrow(/it's not O's turn/i);
  });

  it('should throw error if position is already occupied', async () => {
    const boardWithMove: Board = [
      'X', null, null,  // Position 0 is occupied
      null, null, null,
      null, null, null
    ];
    
    const game = await createTestGame(boardWithMove, 'O');
    
    const input: MakeMoveInput = {
      game_id: game.id,
      position: 0, // Already occupied by X
      player: 'O'
    };

    await expect(makeMove(input)).rejects.toThrow(/position 0 is already occupied/i);
  });

  it('should throw error if game status is waiting', async () => {
    // Create game in waiting status
    const result = await db.insert(gamesTable)
      .values({
        board: Array(9).fill(null),
        current_player: 'X',
        status: 'waiting',
        result: 'ongoing',
        winner: null
      })
      .returning()
      .execute();
    
    const waitingGame = result[0];
    
    const input: MakeMoveInput = {
      game_id: waitingGame.id,
      position: 0,
      player: 'X'
    };

    await expect(makeMove(input)).rejects.toThrow(/game is not yet started/i);
  });

  it('should handle anti-diagonal win condition', async () => {
    // Create board with X about to win on anti-diagonal (positions 2, 4, 6)
    const boardNearWin: Board = [
      null, null, 'X',  // Position 2
      null, 'X', null,  // Position 4
      null, null, null  // Position 6 needed for win
    ];
    
    const game = await createTestGame(boardNearWin, 'X');
    
    const input: MakeMoveInput = {
      game_id: game.id,
      position: 6, // Complete anti-diagonal
      player: 'X'
    };

    const result = await makeMove(input);

    expect(result.board[6]).toEqual('X');
    expect(result.status).toEqual('completed');
    expect(result.result).toEqual('X_wins');
    expect(result.winner).toEqual('X');
  });

  it('should handle multiple moves in sequence', async () => {
    const game = await createTestGame();
    
    // First move - X
    let result = await makeMove({
      game_id: game.id,
      position: 4, // Center
      player: 'X'
    });
    
    expect(result.board[4]).toEqual('X');
    expect(result.current_player).toEqual('O');
    expect(result.status).toEqual('in_progress');

    // Second move - O
    result = await makeMove({
      game_id: game.id,
      position: 0, // Top-left
      player: 'O'
    });
    
    expect(result.board[0]).toEqual('O');
    expect(result.board[4]).toEqual('X'); // Previous move still there
    expect(result.current_player).toEqual('X');
    expect(result.status).toEqual('in_progress');
  });
});