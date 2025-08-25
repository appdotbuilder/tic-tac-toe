import { db } from '../db';
import { gamesTable } from '../db/schema';
import { type MakeMoveInput, type Game, type Board, type Player, type GameResult } from '../schema';
import { eq } from 'drizzle-orm';

// Helper function to check for win conditions
const checkWinCondition = (board: Board, player: Player): boolean => {
  const winPatterns = [
    // Rows
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    // Columns
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    // Diagonals
    [0, 4, 8], [2, 4, 6]
  ];

  return winPatterns.some(pattern => 
    pattern.every(position => board[position] === player)
  );
};

// Helper function to check if board is full
const isBoardFull = (board: Board): boolean => {
  return board.every(cell => cell !== null);
};

// Helper function to determine game result
const determineGameResult = (board: Board, currentPlayer: Player): GameResult => {
  // Check if current player won with this move
  if (checkWinCondition(board, currentPlayer)) {
    return currentPlayer === 'X' ? 'X_wins' : 'O_wins';
  }
  
  // Check for draw
  if (isBoardFull(board)) {
    return 'draw';
  }
  
  // Game continues
  return 'ongoing';
};

export const makeMove = async (input: MakeMoveInput): Promise<Game> => {
  try {
    // 1. Fetch the game and validate it exists
    const games = await db.select()
      .from(gamesTable)
      .where(eq(gamesTable.id, input.game_id))
      .execute();

    if (games.length === 0) {
      throw new Error(`Game with id ${input.game_id} not found`);
    }

    const game = games[0];
    const board = game.board as Board;

    // 2. Validate that the game is in progress
    if (game.status === 'completed') {
      throw new Error('Game is already completed');
    }

    if (game.status === 'waiting') {
      throw new Error('Game is not yet started');
    }

    // 3. Validate that it's the correct player's turn
    if (game.current_player !== input.player) {
      throw new Error(`It's not ${input.player}'s turn. Current player is ${game.current_player}`);
    }

    // 4. Validate that the selected position is empty
    if (board[input.position] !== null) {
      throw new Error(`Position ${input.position} is already occupied`);
    }

    // 5. Update the board with the player's move
    const newBoard = [...board];
    newBoard[input.position] = input.player;

    // 6. Check for win and draw conditions
    const gameResult = determineGameResult(newBoard, input.player);
    
    // 7. Determine next player and game status
    const nextPlayer: Player = input.player === 'X' ? 'O' : 'X';
    const gameCompleted = gameResult !== 'ongoing';
    const winner = gameResult === 'X_wins' ? 'X' : gameResult === 'O_wins' ? 'O' : null;

    // 8. Update the game in the database
    const result = await db.update(gamesTable)
      .set({
        board: newBoard,
        current_player: gameCompleted ? input.player : nextPlayer, // Keep current player if game ends
        status: gameCompleted ? 'completed' : 'in_progress',
        result: gameResult,
        winner: winner,
        updated_at: new Date()
      })
      .where(eq(gamesTable.id, input.game_id))
      .returning()
      .execute();

    // 9. Return the updated game state
    const updatedGame = result[0];
    return {
      ...updatedGame,
      board: updatedGame.board as Board
    };
  } catch (error) {
    console.error('Move failed:', error);
    throw error;
  }
};