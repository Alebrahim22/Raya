import { SIZE, isLake } from '@raya/engine';
import type { Move, Pos, PublicPiece } from '@raya/engine';
import { Emblem, PIECE_NAME } from './pieces';

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

export function Board({ board, me, selected, hints = [], last, lastBy, seq = 0, dimRows, onCell }: Props) {
  const rows = me === 0 ? [...Array(SIZE).keys()] : [...Array(SIZE).keys()].reverse();
  const cols = me === 0 ? [...Array(SIZE).keys()] : [...Array(SIZE).keys()].reverse();
  const foe = !!last && lastBy !== undefined && lastBy !== me;
  // display position (0..9) of a board square after flipping for seat 1
  const disp = (p: Pos) => ({ x: (me === 0 ? p.c : SIZE - 1 - p.c) + 0.5, y: (me === 0 ? p.r : SIZE - 1 - p.r) + 0.5 });
  const hintAt = (r: number, c: number) => hints.some((m) => m.to.r === r && m.to.c === c);
  return (
    <div className="board-wrap">
      <div className="board" role="grid" aria-label="الرقعة">
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
                  className={`${eq(selected, r, c) ? 'selected' : ''} ${hint ? 'target' : ''} ${p.owner !== me && p.rank !== null ? 'known' : ''}`} />}
              </button>
            );
          }),
        )}
        {foe && <FoeArrow key={seq} from={disp(last!.from)} to={disp(last!.to)} />}
      </div>
    </div>
  );
}

function FoeArrow({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  // start just outside the origin dot, stop short of the target centre so the head sits on its edge
  const x1 = from.x + ux * 0.18, y1 = from.y + uy * 0.18;
  const x2 = to.x - ux * 0.3, y2 = to.y - uy * 0.3;
  const hx = to.x - ux * 0.08, hy = to.y - uy * 0.08;
  const px = -uy * 0.24, py = ux * 0.24;
  const bx = to.x - ux * 0.42, by = to.y - uy * 0.42;
  return (
    <svg className="foe-arrow" viewBox="0 0 10 10" aria-hidden="true">
      <circle className="foe-dot" cx={from.x} cy={from.y} r={0.16} />
      <line className="foe-line" x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} />
      <polygon className="foe-head" points={`${hx},${hy} ${bx + px},${by + py} ${bx - px},${by - py}`} />
    </svg>
  );
}
