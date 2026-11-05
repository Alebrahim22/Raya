import { ARMY, SIZE, inBounds, isLake, resolveBattle } from './rules';
import type { Move, Player, PlayerView, PublicPiece, Rank } from './types';

export type BotLevel = 'easy' | 'medium';

/** How much losing or taking each rank is worth to the bot. */
const VALUE: Record<string, number> = {
  10: 100, 9: 60, 8: 40, 7: 25, 6: 15, 5: 10, 4: 6, 3: 14, 2: 5, 1: 30, B: 8, F: 1000,
};

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

/**
 * The bot only ever sees a PlayerView: the same information a human has.
 * It never reads hidden ranks.
 */
export function botMoves(view: PlayerView): Move[] {
  const out: Move[] = [];
  const me = view.me;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = view.board[r][c];
      if (!p || p.owner !== me || p.rank === 'B' || p.rank === 'F' || p.rank === null) continue;
      const reach = p.rank === 2 ? SIZE : 1;
      for (const [dr, dc] of DIRS) {
        for (let s = 1; s <= reach; s++) {
          const rr = r + dr * s, cc = c + dc * s;
          if (!inBounds(rr, cc) || isLake(rr, cc)) break;
          const t = view.board[rr][cc];
          if (t && t.owner === me) break;
          out.push({ from: { r, c }, to: { r: rr, c: cc } });
          if (t) break;
        }
      }
    }
  }
  return out;
}

/** Probability of each rank for an unrevealed enemy piece, from what is still unaccounted for. */
function beliefs(view: PlayerView): { moved: Set<string>; pool: Map<Rank, number> } {
  const enemy = (1 - view.me) as Player;
  const pool = new Map<Rank, number>(ARMY.map(([r, n]) => [r, n] as [Rank, number]));
  // Remove enemy pieces whose rank we know, on board or already captured.
  for (const row of view.board) for (const p of row) {
    if (p && p.owner === enemy && p.rank !== null) pool.set(p.rank, (pool.get(p.rank) ?? 0) - 1);
  }
  for (const e of view.history) {
    if (!e.battle) continue;
    const enemyRank = e.player === enemy ? e.battle.attacker : e.battle.defender;
    const enemyLost = e.player === enemy ? e.battle.outcome !== 'attacker' : e.battle.outcome !== 'defender';
    if (enemyLost) pool.set(enemyRank, (pool.get(enemyRank) ?? 0) - 1);
  }
  const moved = new Set(view.history.filter((e) => e.player === enemy).map((e) => e.pieceId));
  return { moved, pool };
}

function battleScore(attacker: Rank, defender: Rank): number {
  const o = resolveBattle(attacker, defender);
  if (o === 'attacker') return VALUE[String(defender)];
  if (o === 'defender') return -VALUE[String(attacker)];
  return VALUE[String(defender)] - VALUE[String(attacker)];
}

function expectedAttack(attacker: Rank, target: PublicPiece, b: ReturnType<typeof beliefs>): number {
  if (target.rank !== null) return battleScore(attacker, target.rank);
  let total = 0, weight = 0;
  for (const [rank, n] of b.pool) {
    if (n <= 0) continue;
    if (b.moved.has(target.id) && (rank === 'B' || rank === 'F')) continue;
    total += n * battleScore(attacker, rank);
    weight += n;
  }
  return weight ? total / weight : 0;
}

function scoreMove(view: PlayerView, m: Move, b: ReturnType<typeof beliefs>, rand: () => number): number {
  const me = view.me;
  const mover = view.board[m.from.r][m.from.c]!;
  const rank = mover.rank as Rank;
  const target = view.board[m.to.r][m.to.c];
  let score = rand() * 2; // small noise so the bot is not predictable

  if (target) {
    score += expectedAttack(rank, target, b);
  } else {
    const forward = me === 0 ? m.from.r - m.to.r : m.to.r - m.from.r;
    score += forward * (rank === 2 ? 0.6 : 1.2);
  }

  // Danger: a known stronger enemy next to the destination.
  for (const [dr, dc] of DIRS) {
    const rr = m.to.r + dr, cc = m.to.c + dc;
    if (!inBounds(rr, cc)) continue;
    const n = view.board[rr][cc];
    if (n && n.owner !== me && n.rank !== null && typeof n.rank === 'number') {
      const o = resolveBattle(n.rank, rank);
      if (o === 'attacker') score -= VALUE[String(rank)] * 0.8;
      else if (o === 'defender') score += VALUE[String(n.rank)] * 0.3;
    }
  }

  // Keep the strongest pieces back until something is known.
  if (!target && (rank === 10 || rank === 9) && !mover.revealed) score -= 3;
  return score;
}

/**
 * `legal` is the rules engine's list of legal moves (it only reflects the two-square rule,
 * never hidden ranks). Without it the bot computes its own move list from the view.
 */
export function chooseBotMove(
  view: PlayerView, level: BotLevel = 'medium', rand: () => number = Math.random, legal?: Move[],
): Move | null {
  const moves = legal ?? botMoves(view);
  if (!moves.length) return null;
  if (level === 'easy') {
    const attacks = moves.filter((m) => view.board[m.to.r][m.to.c]);
    const pick = attacks.length && rand() < 0.4 ? attacks : moves;
    return pick[Math.floor(rand() * pick.length)];
  }
  const b = beliefs(view);
  let best = moves[0], bestScore = -Infinity;
  for (const m of moves) {
    const s = scoreMove(view, m, b, rand);
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best;
}
