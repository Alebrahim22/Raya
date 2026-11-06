/** Player 0 sits at the bottom (rows 6–9), player 1 at the top (rows 0–3). */
export type Player = 0 | 1;

/** Numeric ranks 1–10, plus the immovable mine (B) and flag (F). */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'B' | 'F';

export interface Piece {
  id: string;
  owner: Player;
  rank: Rank;
  /** True once the opponent has seen this piece's rank (after any battle). */
  revealed: boolean;
}

export interface Pos {
  r: number;
  c: number;
}

export interface Move {
  from: Pos;
  to: Pos;
}

export type Cell = Piece | null;
export type Board = Cell[][];

export type BattleOutcome = 'attacker' | 'defender' | 'both';

export interface MoveEvent {
  player: Player;
  move: Move;
  pieceId: string;
  battle?: {
    attacker: Rank;
    defender: Rank;
    outcome: BattleOutcome;
  };
}

export type GameStatus =
  | { kind: 'playing' }
  | { kind: 'won'; winner: Player; reason: 'flag' | 'no-moves' | 'resign' }
  | { kind: 'draw'; reason: 'no-moves' };

/** Optional house rules the host picks before the game. */
export interface GameRules {
  /** The 4 may also step one square diagonally. */
  diagonal4?: boolean;
}

export interface GameState {
  board: Board;
  rules: GameRules;
  turn: Player;
  status: GameStatus;
  history: MoveEvent[];
  /** Per player: recent consecutive moves of one piece, for the two-square rule. */
  streak: [Streak | null, Streak | null];
}

export interface Streak {
  pieceId: string;
  a: Pos;
  b: Pos;
  count: number;
}

/** A setup is 4 rows × 10 columns, listed from the player's front row to back row. */
export type Setup = Rank[][];

/** What one player is allowed to see. Unrevealed enemy ranks are null. */
export interface PublicPiece {
  id: string;
  owner: Player;
  rank: Rank | null;
  revealed: boolean;
}

export interface PlayerView {
  me: Player;
  rules: GameRules;
  board: (PublicPiece | null)[][];
  turn: Player;
  status: GameStatus;
  history: MoveEvent[];
}
