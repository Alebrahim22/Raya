import type {
  BattleOutcome, Board, GameState, Move, MoveEvent, Piece, Player, PlayerView, Pos, Rank, Setup, Streak,
} from './types';

export const SIZE = 10;

/** How many of each rank a player has: 40 pieces in total. */
export const ARMY: ReadonlyArray<readonly [Rank, number]> = [
  [10, 1], [9, 1], [8, 2], [7, 3], [6, 4], [5, 4], [4, 4], [3, 5], [2, 8], [1, 1], ['B', 6], ['F', 1],
];

/** Max times a piece may shuttle between the same two squares in a row. */
export const TWO_SQUARE_LIMIT = 3;

export function isLake(r: number, c: number): boolean {
  return (r === 4 || r === 5) && (c === 2 || c === 3 || c === 6 || c === 7);
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

export function isMovable(rank: Rank): boolean {
  return rank !== 'B' && rank !== 'F';
}

/** Board rows a player's setup occupies, front row first. */
export function setupRows(player: Player): number[] {
  return player === 0 ? [6, 7, 8, 9] : [3, 2, 1, 0];
}

export function validateSetup(setup: Setup): string | null {
  if (setup.length !== 4 || setup.some((row) => row.length !== SIZE)) return 'setup must be 4 rows of 10';
  const counts = new Map<Rank, number>();
  for (const row of setup) for (const rank of row) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  for (const [rank, n] of ARMY) {
    if ((counts.get(rank) ?? 0) !== n) return `expected ${n} of ${rank}, got ${counts.get(rank) ?? 0}`;
  }
  if (counts.size !== ARMY.length) return 'unknown rank in setup';
  return null;
}

/**
 * Setup columns are written from the player's own point of view (left to right as they see it).
 * Player 1 sits across the table, so their columns are mirrored onto the board.
 */
function placeSetup(board: Board, player: Player, setup: Setup): void {
  const rows = setupRows(player);
  let n = 0;
  setup.forEach((line, i) => {
    line.forEach((rank, j) => {
      const c = player === 0 ? j : SIZE - 1 - j;
      board[rows[i]][c] = { id: `p${player}-${n++}`, owner: player, rank, revealed: false };
    });
  });
}

export function createGame(setup0: Setup, setup1: Setup, first: Player = 0): GameState {
  for (const s of [setup0, setup1]) {
    const err = validateSetup(s);
    if (err) throw new Error(`invalid setup: ${err}`);
  }
  const board: Board = Array.from({ length: SIZE }, () => Array<Piece | null>(SIZE).fill(null));
  placeSetup(board, 0, setup0);
  placeSetup(board, 1, setup1);
  return { board, turn: first, status: { kind: 'playing' }, history: [], streak: [null, null] };
}

const DIRS: Pos[] = [{ r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }];

function samePos(a: Pos, b: Pos): boolean {
  return a.r === b.r && a.c === b.c;
}

/** Pseudo-legal moves for the piece at `from`, ignoring the two-square rule. */
function rawMovesFrom(board: Board, from: Pos): Move[] {
  const piece = board[from.r][from.c];
  if (!piece || !isMovable(piece.rank)) return [];
  const out: Move[] = [];
  const reach = piece.rank === 2 ? SIZE : 1; // the scout runs any distance in a straight line
  for (const d of DIRS) {
    for (let step = 1; step <= reach; step++) {
      const r = from.r + d.r * step;
      const c = from.c + d.c * step;
      if (!inBounds(r, c) || isLake(r, c)) break;
      const target = board[r][c];
      if (target && target.owner === piece.owner) break;
      out.push({ from, to: { r, c } });
      if (target) break; // attack stops the run
    }
  }
  return out;
}

/** Two-square rule: forbid the move that would make a fourth shuttle in a row. */
function breaksTwoSquare(streak: Streak | null, pieceId: string, move: Move): boolean {
  if (!streak || streak.pieceId !== pieceId || streak.count < TWO_SQUARE_LIMIT) return false;
  const onLine = (samePos(move.from, streak.a) && samePos(move.to, streak.b))
    || (samePos(move.from, streak.b) && samePos(move.to, streak.a));
  return onLine;
}

export function legalMoves(state: GameState, player: Player = state.turn): Move[] {
  if (state.status.kind !== 'playing') return [];
  const out: Move[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = state.board[r][c];
      if (!p || p.owner !== player) continue;
      for (const m of rawMovesFrom(state.board, { r, c })) {
        if (!breaksTwoSquare(state.streak[player], p.id, m)) out.push(m);
      }
    }
  }
  return out;
}

export function isLegal(state: GameState, move: Move): boolean {
  return legalMoves(state).some((m) => samePos(m.from, move.from) && samePos(m.to, move.to));
}

/** Who survives when `attacker` strikes `defender`. */
export function resolveBattle(attacker: Rank, defender: Rank): BattleOutcome {
  if (defender === 'F') return 'attacker';
  if (defender === 'B') return attacker === 3 ? 'attacker' : 'defender';
  if (attacker === 1 && defender === 10) return 'attacker'; // the spy only wins when it strikes first
  if (attacker === defender) return 'both';
  return (attacker as number) > (defender as number) ? 'attacker' : 'defender';
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function nextStreak(prev: Streak | null, pieceId: string, move: Move): Streak {
  if (prev && prev.pieceId === pieceId && samePos(prev.b, move.from) && samePos(prev.a, move.to)) {
    return { pieceId, a: move.from, b: move.to, count: prev.count + 1 };
  }
  return { pieceId, a: move.from, b: move.to, count: 1 };
}

export function applyMove(state: GameState, move: Move): { state: GameState; event: MoveEvent } {
  if (!isLegal(state, move)) throw new Error('illegal move');
  const board = cloneBoard(state.board);
  const mover = board[move.from.r][move.from.c]!;
  const target = board[move.to.r][move.to.c];
  const player = state.turn;
  const event: MoveEvent = { player, move, pieceId: mover.id };
  let flagTaken = false;

  board[move.from.r][move.from.c] = null;
  if (!target) {
    board[move.to.r][move.to.c] = mover;
  } else {
    const outcome = resolveBattle(mover.rank, target.rank);
    event.battle = { attacker: mover.rank, defender: target.rank, outcome };
    mover.revealed = true;
    target.revealed = true;
    if (outcome === 'attacker') {
      board[move.to.r][move.to.c] = mover;
      if (target.rank === 'F') flagTaken = true;
    } else if (outcome === 'both') {
      board[move.to.r][move.to.c] = null;
    }
    // 'defender': target stays put, attacker is removed
  }

  const streak: [Streak | null, Streak | null] = [...state.streak];
  streak[player] = target ? null : nextStreak(state.streak[player], mover.id, move);

  const next: GameState = {
    board,
    turn: (1 - player) as Player,
    status: { kind: 'playing' },
    history: [...state.history, event],
    streak,
  };

  if (flagTaken) {
    next.status = { kind: 'won', winner: player, reason: 'flag' };
  } else {
    const oppStuck = legalMoves(next, next.turn).length === 0;
    if (oppStuck) {
      const meStuck = legalMoves({ ...next, turn: player }, player).length === 0;
      next.status = meStuck ? { kind: 'draw', reason: 'no-moves' } : { kind: 'won', winner: player, reason: 'no-moves' };
    }
  }
  return { state: next, event };
}

export function resign(state: GameState, player: Player): GameState {
  if (state.status.kind !== 'playing') return state;
  return { ...state, status: { kind: 'won', winner: (1 - player) as Player, reason: 'resign' } };
}

/** The board as one player may see it: unrevealed enemy ranks are hidden. */
export function viewFor(state: GameState, me: Player): PlayerView {
  const over = state.status.kind !== 'playing';
  return {
    me,
    turn: state.turn,
    status: state.status,
    history: state.history,
    board: state.board.map((row) => row.map((p) => {
      if (!p) return null;
      const visible = p.owner === me || p.revealed || over;
      return { id: p.id, owner: p.owner, rank: visible ? p.rank : null, revealed: p.revealed };
    })),
  };
}

export function legalMovesFrom(state: GameState, from: Pos): Move[] {
  return legalMoves(state).filter((m) => samePos(m.from, from));
}

/** Uniformly shuffled legal setup. `rand` returns [0, 1). */
export function randomSetup(rand: () => number = Math.random): Setup {
  const pool: Rank[] = [];
  for (const [rank, n] of ARMY) for (let i = 0; i < n; i++) pool.push(rank);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return [0, 1, 2, 3].map((i) => pool.slice(i * SIZE, i * SIZE + SIZE));
}
