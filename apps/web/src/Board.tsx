import { SIZE, isLake } from '@raya/engine';
import type { Move, Pos, PublicPiece } from '@raya/engine';
import { Emblem, PIECE_NAME } from './pieces';

interface Props {
  board: (PublicPiece | null)[][];
  me: 0 | 1;
  selected?: Pos | null;
  hints?: Move[];
  last?: Move | null;
  dimRows?: (r: number) => boolean;
  onCell?: (p: Pos) => void;
}

const eq = (a: Pos | null | undefined, r: number, c: number) => !!a && a.r === r && a.c === c;

export function Token({ piece, me, className = '' }: { piece: PublicPiece; me: 0 | 1; className?: string }) {
  const mine = piece.owner === me;
  const hidden = piece.rank === null;
  return (
    <span className={`tok ${mine ? 'me' : 'en'} ${hidden ? 'hidden' : ''} ${className}`}>
      <Emblem rank={piece.rank} size={hidden ? 13 : 17} />
      {typeof piece.rank === 'number' && <span className="num">{piece.rank}</span>}
    </span>
  );
}

export function Board({ board, me, selected, hints = [], last, dimRows, onCell }: Props) {
  const rows = me === 0 ? [...Array(SIZE).keys()] : [...Array(SIZE).keys()].reverse();
  const cols = me === 0 ? [...Array(SIZE).keys()] : [...Array(SIZE).keys()].reverse();
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
              dimRows?.(r) ? 'dim' : '', last && (eq(last.from, r, c) || eq(last.to, r, c)) ? 'last' : ''].join(' ');
            const label = lake ? 'بحيرة' : p ? (p.rank === null ? 'قطعة خصم مخفية' : `${p.owner === me ? '' : 'خصم: '}${PIECE_NAME[String(p.rank)]}`) : 'مربع فاضي';
            return (
              <button key={`${r}-${c}`} type="button" className={cls} aria-label={label} disabled={lake}
                onClick={() => onCell?.({ r, c })}>
                {p && <Token piece={p} me={me} className={`${eq(selected, r, c) ? 'selected' : ''} ${hint ? 'target' : ''}`} />}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
