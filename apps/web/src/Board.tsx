import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { SIZE, isLake } from '@raya/engine';
import type { Move, MoveEvent, Pos, PublicPiece } from '@raya/engine';
import { Emblem, ICONS, Icon, PIECE_NAME } from './pieces';

interface Props {
  board: (PublicPiece | null)[][];
  me: 0 | 1;
  selected?: Pos | null;
  hints?: Move[];
  last?: Move | null;
  /** who made `last`; enemy moves get a highlighted arrow */
  lastBy?: 0 | 1;
  /** increases every move so the arrow animation replays */
  seq?: number;
  /** battle result of `last`, for the clash effect */
  battle?: MoveEvent['battle'];
  dimRows?: (r: number) => boolean;
  onCell?: (p: Pos) => void;
}

const eq = (a: Pos | null | undefined, r: number, c: number) => !!a && a.r === r && a.c === c;

export function Token({ piece, me, className = '' }: { piece: PublicPiece; me: 0 | 1; className?: string }) {
  const mine = piece.owner === me;
  const hidden = piece.rank === null;
  const numbered = typeof piece.rank === 'number';
  return (
    <span className={`tok ${mine ? 'me' : 'en'} ${hidden ? 'hidden' : ''} ${numbered ? 'has-num' : ''} ${className}`}>
      <Emblem rank={piece.rank} size={hidden ? 13 : 17} />
      {typeof piece.rank === 'number' && <span className="num">{piece.rank}</span>}
    </span>
  );
}

export function Board({ board, me, selected, hints = [], last, lastBy, seq = 0, battle, dimRows, onCell }: Props) {
  const rows = me === 0 ? [...Array(SIZE).keys()] : [...Array(SIZE).keys()].reverse();
  const cols = me === 0 ? [...Array(SIZE).keys()] : [...Array(SIZE).keys()].reverse();
  const foe = !!last && lastBy !== undefined && lastBy !== me;
  // display position (0..9) of a board square after flipping for seat 1
  const disp = (p: Pos) => ({ x: (me === 0 ? p.c : SIZE - 1 - p.c) + 0.5, y: (me === 0 ? p.r : SIZE - 1 - p.r) + 0.5 });
  // my attack: celebrate a win, soften a draw or a loss
  const myStrike = !!last && !!battle && lastBy === me;
  const iWon = myStrike && battle!.outcome === 'attacker';
  // keep the burst on screen for its full length even if the opponent answers quickly
  const [fx, setFx] = useState<{ seq: number; at: { x: number; y: number }; battle: NonNullable<MoveEvent['battle']> } | null>(null);
  useEffect(() => {
    if (!myStrike) return;
    setFx({ seq, at: disp(last!.to), battle: battle! });
    const t = setTimeout(() => setFx((f) => (f && f.seq === seq ? null : f)), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, myStrike]);
  const hintAt = (r: number, c: number) => hints.some((m) => m.to.r === r && m.to.c === c);
  return (
    <div className="board-wrap">
      <div className="board" role="grid" aria-label="الرقعة">
        <Lakes />
        {rows.map((r) =>
          cols.map((c) => {
            const p = board[r][c];
            const lake = isLake(r, c);
            const hint = hintAt(r, c);
            const cls = ['cell', (r + c) % 2 ? 'alt' : '', lake ? 'lake' : '', hint && !p ? 'hint' : '',
              dimRows?.(r) ? 'dim' : '', last && (eq(last.from, r, c) || eq(last.to, r, c)) ? 'last' : '',
              foe && eq(last!.from, r, c) ? 'foe-from' : '', foe && eq(last!.to, r, c) ? 'foe-to' : ''].join(' ');
            const label = lake ? 'بحيرة' : p ? (p.rank === null ? 'قطعة خصم مخفية' : `${p.owner === me ? '' : 'خصم مكشوف: '}${PIECE_NAME[String(p.rank)]}`) : 'مربع فاضي';
            return (
              <button key={`${r}-${c}`} type="button" className={cls} aria-label={label} disabled={lake}
                onClick={() => onCell?.({ r, c })}>
                {p && <Token piece={p} me={me}
                  className={`${eq(selected, r, c) ? 'selected' : ''} ${hint ? 'target' : ''} ${p.owner !== me && p.rank !== null ? 'known' : ''} ${iWon && eq(last!.to, r, c) ? 'win-hop' : ''}`}
                  key={iWon && eq(last!.to, r, c) ? `hop-${seq}` : p.id} />}
              </button>
            );
          }),
        )}
        {foe && <FoeArrow key={seq} from={disp(last!.from)} to={disp(last!.to)} />}
        {fx && <ClashFx key={`fx-${fx.seq}`} at={fx.at} battle={fx.battle} me={me} />}
      </div>
    </div>
  );
}

function FoeArrow({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  // a soft dotted trail from the origin ring to just before the target, then a small rounded chevron
  const x1 = from.x + ux * 0.2, y1 = from.y + uy * 0.2;
  const x2 = to.x - ux * 0.34, y2 = to.y - uy * 0.34;
  const tipX = to.x - ux * 0.2, tipY = to.y - uy * 0.2;
  const backX = tipX - ux * 0.16, backY = tipY - uy * 0.16;
  const px = -uy * 0.13, py = ux * 0.13;
  // big viewBox for the same reason as the lakes: crisp rendering on the tilted board
  return (
    <svg className="foe-arrow" viewBox="0 0 1000 1000" aria-hidden="true">
      <defs>
        <mask id="foe-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="10" height="10">
          <line className="foe-mask" x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} strokeDashoffset={0}>
            <animate attributeName="stroke-dashoffset" from="1" to="0" dur="0.55s" fill="freeze"
              calcMode="spline" keyTimes="0;1" keySplines="0.3 0 0.2 1" />
          </line>
        </mask>
      </defs>
      <g transform="scale(100)" opacity="1">
        {/* settle to a quieter state once the eye has caught it */}
        <animate attributeName="opacity" from="1" to="0.7" begin="1.6s" dur="0.8s" fill="freeze" />
        <circle className="foe-ring" cx={from.x} cy={from.y} r={0.13} />
        <line className="foe-line" x1={x1} y1={y1} x2={x2} y2={y2} mask="url(#foe-reveal)" />
        <path className="foe-head" opacity="0" d={`M${backX + px} ${backY + py} L${tipX} ${tipY} L${backX - px} ${backY - py}`}>
          <animate attributeName="opacity" from="0" to="1" begin="0.45s" dur="0.25s" fill="freeze" />
        </path>
      </g>
    </svg>
  );
}

const SHORE = 'M0.95 0.05 C1.5 0.02 1.97 0.3 1.95 0.9 C1.94 1.3 1.98 1.7 1.5 1.92 C1.1 2.0 0.5 1.97 0.22 1.75 C0.0 1.55 0.04 1.15 0.06 0.85 C0.08 0.35 0.45 0.07 0.95 0.05Z';

function Sparkle({ x, y, s, delay }: { x: number; y: number; s: number; delay: number }) {
  return (
    <path className="sparkle" transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -1 C0.12 -0.12 0.12 -0.12 1 0 C0.12 0.12 0.12 0.12 0 1 C-0.12 0.12 -0.12 0.12 -1 0 C-0.12 -0.12 -0.12 -0.12 0 -1Z">
      <animate attributeName="opacity" values="0;1;0" dur="3.2s" begin={`${delay}s`} repeatCount="indefinite" />
    </path>
  );
}

/* The two 2x2 lakes sit on the same display squares for both seats (cols 2-3 and 6-7, rows 4-5).
   Drawn in a 1000-unit viewBox scaled by 100, and animated with SMIL rather than CSS: Chrome
   rasterises CSS-animated SVG on the tilted board at viewBox size, which came out blurry. */
function Lakes() {
  const inner = 'translate(1 1) scale(0.84) translate(-1 -1)';
  return (
    <svg className="lakes" viewBox="0 0 1000 1000" aria-hidden="true">
      <defs>
        <radialGradient id="lake-depth" cx="0.45" cy="0.42" r="0.62">
          <stop offset="0" className="lw-b" />
          <stop offset="0.75" className="lw-a" />
          <stop offset="1" className="lw-edge" />
        </radialGradient>
        <linearGradient id="lake-shore" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="ls-a" />
          <stop offset="1" className="ls-b" />
        </linearGradient>
        <clipPath id="lake-water-clip"><path d={SHORE} transform={inner} /></clipPath>
      </defs>
      <g transform="scale(100)">
        {[2, 6].map((x) => (
          <g key={x} className="lake" transform={x === 2 ? `translate(${x} 4)` : `translate(${x + 2} 4) scale(-1 1)`}>
            <path className="shore" d={SHORE} />
            <path className="water" d={SHORE} transform={inner} />
            <g clipPath="url(#lake-water-clip)">
              {/* drifting caustic light */}
              <ellipse className="caustic" cx="0.7" cy="0.7" rx="0.42" ry="0.16">
                <animate attributeName="cx" values="0.55;0.95;0.55" dur="9s" repeatCount="indefinite" />
              </ellipse>
              <ellipse className="caustic" cx="1.3" cy="1.3" rx="0.36" ry="0.12">
                <animate attributeName="cx" values="1.45;1.05;1.45" dur="11s" repeatCount="indefinite" />
              </ellipse>
              {/* slow ripple rings */}
              {[0, 3].map((d) => (
                <circle key={d} className="ripple" cx="1.25" cy="1.15" r="0.05">
                  <animate attributeName="r" values="0.05;0.55" dur="6s" begin={`${d}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0" dur="6s" begin={`${d}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </g>
            {/* foam line hugging the shore */}
            <path className="foam" d={SHORE} transform="translate(1 1) scale(0.86) translate(-1 -1)">
              <animate attributeName="stroke-dashoffset" values="0;0.74" dur="6s" repeatCount="indefinite" />
            </path>
            <Sparkle x={0.55} y={0.55} s={0.07} delay={0} />
            <Sparkle x={1.45} y={0.6} s={0.05} delay={1.1} />
            <Sparkle x={1.1} y={1.5} s={0.06} delay={2.2} />
            <g className="rocks">
              <ellipse cx="1.72" cy="1.62" rx="0.14" ry="0.1" />
              <ellipse cx="1.56" cy="1.74" rx="0.08" ry="0.06" />
            </g>
            <g className="lily" transform="translate(0.55 1.4)">
              <path className="pad" d="M0 0 L0.2 -0.05 A0.21 0.21 0 1 1 0.16 -0.15 Z" />
              <circle className="bloom" cx="-0.04" cy="0.02" r="0.065" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

const SHARDS = 12;

/** Burst where my attack landed: the enemy piece cracks into shards with a shockwave, and a victory badge pops. */
function ClashFx({ at, battle, me }: { at: { x: number; y: number }; battle: NonNullable<MoveEvent['battle']>; me: 0 | 1 }) {
  const enemy = (1 - me) as 0 | 1;
  const kind = battle.outcome === 'attacker' ? 'win' : battle.outcome === 'both' ? 'draw' : 'lose';
  const ghost: PublicPiece = { id: 'ghost', owner: enemy, rank: battle.defender, revealed: true };
  const label = kind === 'win' ? 'ضربة!' : kind === 'draw' ? 'تعادل' : 'صدّها';
  return (
    <div className={`fx fx-${kind} ${at.y < 2 ? 'fx-low' : ''}`} style={{ left: `calc(8px + (100% - 16px) * ${at.x / 10})`, top: `calc(8px + (100% - 16px) * ${at.y / 10})` }} aria-hidden="true">
      {kind !== 'lose' && <span className="fx-ghost"><Token piece={ghost} me={me} /></span>}
      <span className="fx-flash" />
      <span className="fx-wave" />
      {kind !== 'lose' && Array.from({ length: SHARDS }, (_, i) => {
        const angle = (360 / SHARDS) * i + (i % 2 ? 9 : -6);
        const dist = (kind === 'win' ? 46 : 26) + (i % 3) * 14;
        return <span key={i} className={`fx-shard ${i % 3 === 0 ? 'spark' : ''}`}
          style={{ '--a': `${angle}deg`, '--d': `${dist}px`, '--r': `${(i * 67) % 360}deg` } as CSSProperties} />;
      })}
      <span className="fx-badge">{kind === 'win' && <Icon d={ICONS.swords} size={14} />}{label}</span>
    </div>
  );
}
