import { useEffect, useMemo, useState } from 'react';
import {
  ARMY, applyMove, chooseBotMove, createGame, legalMoves, legalMovesFrom, randomSetup, resign, viewFor,
} from '@raya/engine';
import type { BotLevel, GameRules, GameState, MoveEvent, Pos, PublicPiece, Rank, Setup } from '@raya/engine';
import { Board, Token } from '../Board';
import { PIECE_NAME } from '../pieces';

interface Props {
  setup: Setup;
  level: BotLevel;
  rules: GameRules;
  onExit: () => void;
  onRematch: () => void;
}

const HUMAN = 0 as const;
const BOT = 1 as const;

export function remaining(view: ReturnType<typeof viewFor>, owner: 0 | 1): Map<Rank, number> {
  const left = new Map<Rank, number>(ARMY.map(([r, n]) => [r, n] as [Rank, number]));
  for (const e of view.history) {
    if (!e.battle) continue;
    const ownerAttacked = e.player === owner;
    const rank = ownerAttacked ? e.battle.attacker : e.battle.defender;
    const lost = ownerAttacked ? e.battle.outcome !== 'attacker' : e.battle.outcome !== 'defender';
    if (lost) left.set(rank, (left.get(rank) ?? 0) - 1);
  }
  return left;
}

function piecesLeft(state: GameState, owner: 0 | 1) {
  return state.board.flat().filter((p) => p && p.owner === owner).length;
}

export function GameScreen({ setup, level, rules, onExit, onRematch }: Props) {
  const [state, setState] = useState<GameState>(() => createGame(setup, randomSetup(), 0, rules));
  const [selected, setSelected] = useState<Pos | null>(null);
  const [clash, setClash] = useState<MoveEvent | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);

  const view = useMemo(() => viewFor(state, HUMAN), [state]);
  const hints = selected ? legalMovesFrom(state, selected) : [];
  const last = state.history.at(-1)?.move ?? null;
  const over = state.status.kind !== 'playing';

  useEffect(() => {
    if (over || state.turn !== BOT) return;
    const t = setTimeout(() => {
      const m = chooseBotMove(viewFor(state, BOT), level, Math.random, legalMoves(state));
      if (!m) return;
      const res = applyMove(state, m);
      if (res.event.battle) setClash(res.event);
      setState(res.state);
    }, state.history.at(-1)?.battle ? 1500 : 650); // let the clash effect play before the bot answers
    return () => clearTimeout(t);
  }, [state, level, over]);

  function tap(p: Pos) {
    if (over || state.turn !== HUMAN) return;
    const piece = state.board[p.r][p.c];
    if (piece && piece.owner === HUMAN) {
      setSelected(selected && selected.r === p.r && selected.c === p.c ? null : p);
      return;
    }
    if (selected && hints.some((m) => m.to.r === p.r && m.to.c === p.c)) {
      const res = applyMove(state, { from: selected, to: p });
      if (res.event.battle) setClash(res.event);
      setState(res.state);
      setSelected(null);
    }
  }

  const status = state.status;
  const won = status.kind === 'won' && status.winner === HUMAN;

  return (
    <main className="screen">
      <div className={`card bar enemy ${state.turn === BOT && !over ? 'active' : ''}`}>
        <div className="row">
          <div className="avatar">ب</div>
          <div className="who"><b>البوت · {level === 'easy' ? 'سهل' : 'متوسط'}</b><span>{piecesLeft(state, BOT)} قطعة باقية</span></div>
          {state.turn === BOT && !over && <span className="muted" style={{ fontSize: 13 }}>يفكّر…</span>}
        </div>
        <ArmyStrip view={view} owner={BOT} me={HUMAN} />
      </div>

      <Board board={view.board} me={HUMAN} selected={selected} hints={hints} last={last} lastBy={view.history.at(-1)?.player} seq={view.history.length} battle={view.history.at(-1)?.battle} onCell={tap} />

      <ClashCard event={clash} me={HUMAN} />


      <div className={`card bar me ${state.turn === HUMAN && !over ? 'active' : ''}`} style={{ marginTop: 'auto' }}>
        <ArmyStrip view={view} owner={HUMAN} me={HUMAN} />
        <div className="row">
          <div className="avatar">أنا</div>
          <div className="who">
            <b>{over ? 'انتهت المباراة' : state.turn === HUMAN ? 'دورك' : 'دور الخصم'}</b>
            <span>{selected ? `اخترت ${PIECE_NAME[String(state.board[selected.r][selected.c]?.rank)]}` : `${piecesLeft(state, HUMAN)} قطعة باقية`}</span>
          </div>
          {state.turn === HUMAN && !over && <span className="pill">حرّك</span>}
        </div>
      </div>
      <div className="grid2">
        <button type="button" className="btn" onClick={onExit}>القائمة</button>
        <button type="button" className="btn danger" disabled={over} onClick={() => setConfirmResign(true)}>استسلام</button>
      </div>

      {confirmResign && !over && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="تأكيد الاستسلام">
          <div className="card">
            <h2 style={{ fontSize: 28 }}>تستسلم؟</h2>
            <p className="muted" style={{ margin: 0 }}>راح تنحسب خسارة.</p>
            <div className="grid2">
              <button type="button" className="btn" onClick={() => setConfirmResign(false)}>لا، كمّل</button>
              <button type="button" className="btn danger" onClick={() => { setState(resign(state, HUMAN)); setConfirmResign(false); }}>استسلم</button>
            </div>
          </div>
        </div>
      )}

      {over && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="نتيجة المباراة">
          <div className="card">
            <h2>{status.kind === 'draw' ? 'تعادل' : won ? 'فزت!' : 'خسرت'}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {status.kind === 'won' && status.reason === 'flag' && (won ? 'أسرت راية الخصم.' : 'الخصم أسر رايتك.')}
              {status.kind === 'won' && status.reason === 'no-moves' && (won ? 'الخصم ما عنده حركات.' : 'ما بقى عندك حركات.')}
              {status.kind === 'won' && status.reason === 'resign' && 'استسلمت.'}
              {status.kind === 'draw' && 'ما بقى عند أحد حركات.'}
            </p>
            <button type="button" className="btn primary" onClick={onRematch}>مباراة جديدة</button>
            <button type="button" className="btn" onClick={onExit}>القائمة</button>
          </div>
        </div>
      )}
    </main>
  );
}

/** One side's remaining army, shown inside that player's bar. */
export function ArmyStrip({ view, owner, me }: { view: ReturnType<typeof viewFor>; owner: 0 | 1; me: 0 | 1 }) {
  const left = remaining(view, owner);
  return (
    <div className="army" aria-label={owner === me ? 'قطعي المتبقية' : 'قطع الخصم المتبقية'}>
      {ARMY.map(([rank]) => {
        const n = left.get(rank) ?? 0;
        const p: PublicPiece = { id: String(rank), owner, rank, revealed: true };
        return (
          <div key={String(rank)} className={`item ${n ? '' : 'gone'}`} title={`${PIECE_NAME[String(rank)]}: ${n}`}>
            <Token piece={p} me={me} /><b className="count">{n}</b>
          </div>
        );
      })}
    </div>
  );
}

export function ClashCard({ event, me }: { event: MoveEvent | null; me: 0 | 1 }) {
  if (!event?.battle) {
    return <div className="card clash row muted" style={{ justifyContent: 'center', fontSize: 13 }}>اضغط قطعة من قطعك، بعدين اضغط وين تبيها تروح</div>;
  }
  const { attacker, defender, outcome } = event.battle;
  const mineAttacked = event.player === me;
  const a: PublicPiece = { id: 'a', owner: event.player, rank: attacker, revealed: true };
  const d: PublicPiece = { id: 'd', owner: (1 - event.player) as 0 | 1, rank: defender, revealed: true };
  const iWon = outcome === 'both' ? null : (outcome === 'attacker') === mineAttacked;
  return (
    <div className="card clash row" aria-live="polite">
      <div className={`side ${outcome === 'defender' || outcome === 'both' ? 'lost' : ''}`}>
        <Token piece={a} me={me} /><span>{PIECE_NAME[String(attacker)]} {typeof attacker === 'number' ? attacker : ''}</span>
      </div>
      <span className="vs">ضد</span>
      <div className={`side ${outcome === 'attacker' || outcome === 'both' ? 'lost' : ''}`}>
        <Token piece={d} me={me} /><span>{PIECE_NAME[String(defender)]} {typeof defender === 'number' ? defender : ''}</span>
      </div>
      <span className="verdict">{iWon === null ? 'تعادل' : iWon ? 'فزت' : 'خسرت'}</span>
    </div>
  );
}
