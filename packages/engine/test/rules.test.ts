import { describe, expect, it } from 'vitest';
import {
  applyMove, chooseBotMove, createGame, isLegal, legalMoves, legalMovesFrom, randomSetup, resolveBattle,
  validateSetup, viewFor,
} from '../src';
import type { Board, GameState, Piece, Player, Rank, Setup } from '../src';

const SETUP: Setup = [
  [2, 6, 2, 7, 'B', 2, 8, 5, 2, 6],
  [5, 3, 9, 1, 10, 2, 7, 'B', 3, 6],
  [4, 'B', 8, 4, 3, 6, 2, 'B', 7, 5],
  [4, 3, 'B', 'F', 'B', 2, 5, 4, 3, 2],
];

/** A hand-built position: everything else empty. Each player keeps a flag far away. */
function position(pieces: Array<[number, number, Player, Rank]>, turn: Player = 0, rules: GameState['rules'] = {}): GameState {
  const board: Board = Array.from({ length: 10 }, () => Array<Piece | null>(10).fill(null));
  let n = 0;
  for (const [r, c, owner, rank] of pieces) board[r][c] = { id: `t${n++}`, owner, rank, revealed: false };
  return { board, rules, turn, status: { kind: 'playing' }, history: [], streak: [null, null] };
}

describe('setup', () => {
  it('accepts a full army and rejects a wrong one', () => {
    expect(validateSetup(SETUP)).toBeNull();
    const bad = SETUP.map((r) => [...r]);
    bad[0][0] = 10;
    expect(validateSetup(bad)).not.toBeNull();
  });

  it('places player 0 on rows 6–9 and player 1 on rows 0–3, front row first', () => {
    const g = createGame(SETUP, SETUP);
    expect(g.board[6][0]!.owner).toBe(0);
    expect(g.board[6][0]!.rank).toBe(2);
    expect(g.board[3][9]!.owner).toBe(1); // mirrored: player 1's left column is board column 9
    expect(g.board[3][9]!.rank).toBe(2);
    expect(g.board[4].every((p) => p === null)).toBe(true);
  });

  it('random setups are always valid', () => {
    for (let i = 0; i < 50; i++) expect(validateSetup(randomSetup())).toBeNull();
  });
});

describe('battles', () => {
  it.each<[Rank, Rank, string]>([
    [7, 6, 'attacker'], [6, 7, 'defender'], [5, 5, 'both'],
    [1, 10, 'attacker'], [10, 1, 'attacker'], [1, 9, 'defender'],
    [3, 'B', 'attacker'], [10, 'B', 'defender'], [2, 'F', 'attacker'],
  ])('%s attacking %s → %s', (a, d, out) => {
    expect(resolveBattle(a, d)).toBe(out);
  });

  it('a spy that is attacked by the 10 dies', () => {
    const g = position([[5, 0, 1, 10], [6, 0, 0, 1], [0, 9, 0, 'F'], [9, 9, 1, 'F']], 1);
    const { state, event } = applyMove(g, { from: { r: 5, c: 0 }, to: { r: 6, c: 0 } });
    expect(event.battle!.outcome).toBe('attacker');
    expect(state.board[6][0]!.rank).toBe(10);
  });

  it('reveals both pieces after a battle, and the winner stays revealed', () => {
    const g = position([[5, 0, 0, 7], [4, 0, 1, 6], [9, 9, 0, 'F'], [0, 9, 1, 'F'], [0, 0, 1, 4]]);
    const { state } = applyMove(g, { from: { r: 5, c: 0 }, to: { r: 4, c: 0 } });
    expect(state.board[4][0]!.rank).toBe(7);
    expect(state.board[4][0]!.revealed).toBe(true);
  });

  it('a mine stays on the board after destroying an attacker', () => {
    const g = position([[5, 0, 0, 8], [4, 0, 1, 'B'], [9, 9, 0, 'F'], [9, 8, 0, 4], [0, 9, 1, 'F'], [0, 0, 1, 4]]);
    const { state } = applyMove(g, { from: { r: 5, c: 0 }, to: { r: 4, c: 0 } });
    expect(state.board[4][0]!.rank).toBe('B');
    expect(state.board[5][0]).toBeNull();
  });
});

describe('movement', () => {
  it('mines and flags never move', () => {
    const g = position([[5, 0, 0, 'B'], [5, 1, 0, 'F'], [0, 0, 1, 4], [0, 9, 1, 'F']]);
    expect(legalMoves(g)).toHaveLength(0);
  });

  it('normal pieces step one square orthogonally, not into lakes', () => {
    const g = position([[5, 1, 0, 6], [9, 9, 0, 'F'], [0, 9, 1, 'F'], [0, 0, 1, 4]]);
    const dests = legalMovesFrom(g, { r: 5, c: 1 }).map((m) => `${m.to.r},${m.to.c}`).sort();
    expect(dests).toEqual(['4,1', '5,0', '6,1']); // 5,2 is a lake
  });

  it('the 4 moves diagonally only when the house rule is on, and can strike that way', () => {
    const pieces: Array<[number, number, Player, Rank]> = [[7, 5, 0, 4], [6, 6, 1, 3], [8, 4, 0, 6], [9, 9, 0, 'F'], [0, 9, 1, 'F']];
    const dests = (g: GameState) => legalMovesFrom(g, { r: 7, c: 5 }).map((m) => `${m.to.r},${m.to.c}`).sort();
    expect(dests(position(pieces))).toEqual(['6,5', '7,4', '7,6', '8,5']);
    // diagonals: 6,4 empty, 6,6 enemy (attack), 8,6 empty, 8,4 own piece (blocked)
    expect(dests(position(pieces, 0, { diagonal4: true }))).toEqual(['6,4', '6,5', '6,6', '7,4', '7,6', '8,5', '8,6']);
    // other ranks never gain diagonals
    expect(legalMovesFrom(position(pieces, 0, { diagonal4: true }), { r: 8, c: 4 }).every((m) => m.to.r === 8 || m.to.c === 4)).toBe(true);
    // diagonal steps never land in a lake
    const nearLake = position([[6, 1, 0, 4], [9, 9, 0, 'F'], [0, 9, 1, 'F']], 0, { diagonal4: true });
    expect(legalMovesFrom(nearLake, { r: 6, c: 1 }).some((m) => m.to.r === 5 && m.to.c === 2)).toBe(false);
  });

  it('createGame and views carry the house rules', () => {
    const g = createGame(SETUP, SETUP, 0, { diagonal4: true });
    expect(g.rules.diagonal4).toBe(true);
    expect(viewFor(g, 1).rules.diagonal4).toBe(true);
    expect(applyMove(g, legalMoves(g)[0]).state.rules.diagonal4).toBe(true);
  });

  it('the scout runs any distance and can attack at the end of the run', () => {
    const g = position([[9, 0, 0, 2], [2, 0, 1, 5], [9, 9, 0, 'F'], [0, 9, 1, 'F']]);
    const up = legalMovesFrom(g, { r: 9, c: 0 }).filter((m) => m.to.c === 0).map((m) => m.to.r).sort((a, b) => a - b);
    expect(up).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it('the scout cannot jump over pieces or lakes', () => {
    const g = position([[5, 4, 0, 2], [5, 5, 0, 4], [9, 9, 0, 'F'], [0, 9, 1, 'F'], [0, 0, 1, 4]]);
    const right = legalMovesFrom(g, { r: 5, c: 4 }).filter((m) => m.to.r === 5);
    expect(right.map((m) => m.to.c)).toEqual([]); // blocked by own piece at 5,5 and the lake at 5,3
  });

  it('only the side to move can move', () => {
    const g = createGame(SETUP, SETUP);
    expect(isLegal(g, { from: { r: 3, c: 0 }, to: { r: 4, c: 0 } })).toBe(false);
    expect(() => applyMove(g, { from: { r: 3, c: 0 }, to: { r: 4, c: 0 } })).toThrow();
  });
});

describe('two-square rule', () => {
  it('forbids a fourth shuttle between the same two squares', () => {
    let g = position([[5, 0, 0, 6], [9, 9, 0, 'F'], [0, 9, 1, 4], [0, 8, 1, 'F']]);
    const up = { from: { r: 5, c: 0 }, to: { r: 4, c: 0 } };
    const down = { from: { r: 4, c: 0 }, to: { r: 5, c: 0 } };
    const enemyA = { from: { r: 0, c: 9 }, to: { r: 1, c: 9 } };
    const enemyB = { from: { r: 1, c: 9 }, to: { r: 0, c: 9 } };
    g = applyMove(g, up).state; g = applyMove(g, enemyA).state;
    g = applyMove(g, down).state; g = applyMove(g, enemyB).state;
    g = applyMove(g, up).state; g = applyMove(g, enemyA).state;
    expect(isLegal(g, down)).toBe(false);
    expect(isLegal(g, { from: { r: 4, c: 0 }, to: { r: 4, c: 1 } })).toBe(true);
  });
});

describe('winning', () => {
  it('capturing the flag wins', () => {
    const g = position([[5, 0, 0, 4], [4, 0, 1, 'F'], [9, 9, 0, 'F'], [0, 0, 1, 5]]);
    const { state } = applyMove(g, { from: { r: 5, c: 0 }, to: { r: 4, c: 0 } });
    expect(state.status).toEqual({ kind: 'won', winner: 0, reason: 'flag' });
  });

  it('a player with no legal moves loses', () => {
    const g = position([[5, 0, 0, 7], [4, 0, 1, 6], [9, 9, 0, 'F'], [0, 9, 1, 'F']]);
    const { state } = applyMove(g, { from: { r: 5, c: 0 }, to: { r: 4, c: 0 } });
    expect(state.status).toEqual({ kind: 'won', winner: 0, reason: 'no-moves' });
  });
});

describe('hidden information', () => {
  it('a player never sees unrevealed enemy ranks', () => {
    const g = createGame(SETUP, SETUP);
    const v = viewFor(g, 0);
    expect(v.board[0].every((p) => p!.rank === null)).toBe(true);
    expect(v.board[9].every((p) => p!.rank !== null)).toBe(true);
  });
});

describe('bot', () => {
  it('always plays a legal move and finishes games', () => {
    for (let game = 0; game < 20; game++) {
      let g = createGame(randomSetup(), randomSetup());
      for (let ply = 0; ply < 2000 && g.status.kind === 'playing'; ply++) {
        const m = chooseBotMove(viewFor(g, g.turn), ply % 2 ? 'easy' : 'medium', Math.random, legalMoves(g));
        expect(m).not.toBeNull();
        expect(isLegal(g, m!)).toBe(true);
        g = applyMove(g, m!).state;
      }
    }
  });

  it('medium beats easy most of the time', () => {
    let wins = 0, played = 0;
    for (let game = 0; game < 40; game++) {
      let g = createGame(randomSetup(), randomSetup(), (game % 2) as Player);
      for (let ply = 0; ply < 3000 && g.status.kind === 'playing'; ply++) {
        const level = g.turn === 0 ? 'medium' : 'easy';
        g = applyMove(g, chooseBotMove(viewFor(g, g.turn), level, Math.random, legalMoves(g))!).state;
      }
      if (g.status.kind === 'won') { played++; if (g.status.winner === 0) wins++; }
    }
    expect(wins / played).toBeGreaterThan(0.6);
  });
});
