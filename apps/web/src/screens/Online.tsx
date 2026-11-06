import { useEffect, useState } from 'react';
import { legalMovesFromList } from '../moves';
import type { Pos, Setup } from '@raya/engine';
import { Board } from '../Board';
import { ICONS, Icon, PIECE_NAME } from '../pieces';
import { load, save } from '../storage';
import { useOnline } from '../net';
import { SetupScreen } from './SetupScreen';
import { ClashCard, EnemyTray, remaining } from './GameScreen';

interface Props {
  mode: 'friend' | 'quick';
  joinCode?: string | null;
  onExit: () => void;
}

export function Online({ mode, joinCode, onExit }: Props) {
  const net = useOnline();
  const [name, setName] = useState(() => load<string>('raya.name', ''));
  const [code, setCode] = useState(joinCode ?? '');
  const [sentSetup, setSentSetup] = useState(false);
  const room = net.room;

  useEffect(() => save('raya.name', name), [name]);
  useEffect(() => { if (room?.phase !== 'setup') setSentSetup(false); }, [room?.phase]);
  useEffect(() => {
    if (room?.phase === 'setup' && room.ready[room.seat]) setSentSetup(true);
  }, [room]);

  function exit() {
    if (room) net.send({ t: 'leave' });
    if (net.queued) net.send({ t: 'cancelQuick' });
    save('raya.session', null);
    onExit();
  }

  const myName = name.trim() || 'لاعب';

  // ---------- not in a room yet ----------
  if (!room) {
    return (
      <main className="screen">
        <div className="setup-head">
          <h2>{mode === 'friend' ? 'العب مع ربعك' : 'لعب سريع'}</h2>
          <button type="button" className="icon-btn" aria-label="رجوع" onClick={exit}><Icon d={ICONS.back} /></button>
        </div>
        <ConnBadge status={net.status} />
        <label className="field">
          <span>اسمك</span>
          <input id="player-name" value={name} maxLength={20} placeholder="مثلاً: محمد" onChange={(e) => setName(e.target.value)} />
        </label>

        {mode === 'friend' ? (
          <>
            <button type="button" className="btn primary" onClick={() => net.send({ t: 'create', name: myName })}>سوّ غرفة جديدة</button>
            <div className="section-label">أو ادخل كود غرفة صديقك</div>
            <div className="row">
              <input id="room-code" className="code-input" value={code} maxLength={5} placeholder="ABCDE" dir="ltr"
                onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="كود الغرفة" />
              <button type="button" className="btn" disabled={code.trim().length < 5}
                onClick={() => net.send({ t: 'join', code: code.trim(), name: myName })}>ادخل</button>
            </div>
          </>
        ) : net.queued ? (
          <div className="card waiting">
            <div className="spinner" aria-hidden="true" />
            <b>ندوّر لك على خصم…</b>
            <span className="muted">أول ما يدخل أحد ثاني تبدأ المباراة</span>
            <button type="button" className="btn" onClick={() => net.send({ t: 'cancelQuick' })}>إلغاء</button>
          </div>
        ) : (
          <button type="button" className="btn primary" onClick={() => net.send({ t: 'quick', name: myName })}>دوّر لي على خصم</button>
        )}
        {net.error && <p className="error" role="alert">{net.error}</p>}
      </main>
    );
  }

  const seat = room.seat;
  const opp = (1 - seat) as 0 | 1;
  const oppName = room.names[opp];

  // ---------- waiting for a friend ----------
  if (room.phase === 'waiting') {
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    return (
      <main className="screen">
        <div className="setup-head">
          <h2>غرفتك جاهزة</h2>
          <button type="button" className="icon-btn" aria-label="رجوع" onClick={exit}><Icon d={ICONS.back} /></button>
        </div>
        <div className="card waiting">
          <span className="muted">أرسل الكود أو الرابط لصديقك</span>
          <div className="room-code" dir="ltr">{room.code}</div>
          <CopyButton text={link} label="انسخ رابط الدعوة" />
          <div className="spinner" aria-hidden="true" />
          <span className="muted">ننتظر صديقك يدخل…</span>
        </div>
      </main>
    );
  }

  // ---------- setup ----------
  if (room.phase === 'setup') {
    if (!sentSetup) {
      return (
        <SetupScreen onBack={exit} subtitle={oppName ? `ضد ${oppName}` : undefined}
          onReady={(setup: Setup) => { net.send({ t: 'setup', setup }); setSentSetup(true); }} />
      );
    }
    return (
      <main className="screen">
        <div className="setup-head">
          <h2>جاهز</h2>
          <button type="button" className="icon-btn" aria-label="رجوع" onClick={exit}><Icon d={ICONS.back} /></button>
        </div>
        <div className="card waiting">
          <div className="spinner" aria-hidden="true" />
          <b>{room.ready[opp] ? 'نبدأ…' : `ننتظر ${oppName ?? 'الخصم'} يرتّب قطعه`}</b>
        </div>
      </main>
    );
  }

  // ---------- playing / over ----------
  return <OnlineGame net={net} onExit={exit} />;
}

function OnlineGame({ net, onExit }: { net: ReturnType<typeof useOnline>; onExit: () => void }) {
  const [selected, setSelected] = useState<Pos | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const room = net.room!;
  const view = net.view;
  useEffect(() => setSelected(null), [view]);
  if (!view) {
    return <main className="screen"><div className="card waiting"><div className="spinner" aria-hidden="true" /></div></main>;
  }

  const seat = room.seat;
  const opp = (1 - seat) as 0 | 1;
  const myTurn = view.turn === seat && view.status.kind === 'playing';
  const over = view.status.kind !== 'playing';
  const hints = selected ? legalMovesFromList(net.legal, selected) : [];
  const count = (o: 0 | 1) => view.board.flat().filter((p) => p && p.owner === o).length;
  const status = view.status;
  const won = status.kind === 'won' && status.winner === seat;

  function tap(p: Pos) {
    if (!myTurn) return;
    const piece = view!.board[p.r][p.c];
    if (piece && piece.owner === seat) {
      setSelected(selected && selected.r === p.r && selected.c === p.c ? null : p);
      return;
    }
    if (selected && hints.some((m) => m.to.r === p.r && m.to.c === p.c)) {
      net.send({ t: 'move', from: selected, to: p });
      setSelected(null);
    }
  }

  return (
    <main className="screen">
      <div className={`card bar enemy row ${view.turn === opp && !over ? 'active' : ''}`}>
        <div className="avatar">{(room.names[opp] ?? '؟').slice(0, 1)}</div>
        <div className="who">
          <b>{room.names[opp] ?? 'الخصم'}</b>
          <span>{room.connected[opp] ? `${count(opp)} قطعة باقية` : 'انقطع اتصاله… ننتظره يرجع'}</span>
        </div>
        {view.turn === opp && !over && <span className="muted" style={{ fontSize: 13 }}>يفكّر…</span>}
      </div>

      <Board board={view.board} me={seat} selected={selected} hints={hints} last={view.history.at(-1)?.move ?? null} lastBy={view.history.at(-1)?.player} seq={view.history.length} onCell={tap} />
      <ClashCard event={net.event} me={seat} />
      <EnemyTray left={remaining(view, opp)} me={seat} />

      <div className={`card bar me row ${myTurn ? 'active' : ''}`} style={{ marginTop: 'auto' }}>
        <div className="avatar">أنا</div>
        <div className="who">
          <b>{over ? 'انتهت المباراة' : myTurn ? 'دورك' : 'دور الخصم'}</b>
          <span>{selected ? `اخترت ${PIECE_NAME[String(view.board[selected.r][selected.c]?.rank)]}` : `${count(seat)} قطعة باقية`}</span>
        </div>
        {net.status !== 'open' ? <span className="pill">يعيد الاتصال…</span> : myTurn && <span className="pill">حرّك</span>}
      </div>
      <div className="grid2">
        <button type="button" className="btn" onClick={onExit}>خروج</button>
        <button type="button" className="btn danger" disabled={over} onClick={() => setConfirmResign(true)}>استسلام</button>
      </div>

      {confirmResign && !over && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="تأكيد الاستسلام">
          <div className="card">
            <h2 style={{ fontSize: 28 }}>تستسلم؟</h2>
            <div className="grid2">
              <button type="button" className="btn" onClick={() => setConfirmResign(false)}>لا، كمّل</button>
              <button type="button" className="btn danger" onClick={() => { net.send({ t: 'resign' }); setConfirmResign(false); }}>استسلم</button>
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
              {status.kind === 'won' && status.reason === 'resign' && (won ? 'الخصم استسلم.' : 'استسلمت.')}
              {status.kind === 'draw' && 'ما بقى عند أحد حركات.'}
            </p>
            {room.names[opp] && (
              <button type="button" className="btn primary" disabled={room.rematch[seat]} onClick={() => net.send({ t: 'rematch' })}>
                {room.rematch[seat] ? 'ننتظر الخصم يوافق…' : room.rematch[opp] ? 'الخصم يبي مباراة ثانية، وافق' : 'مباراة ثانية'}
              </button>
            )}
            <button type="button" className="btn" onClick={onExit}>القائمة</button>
          </div>
        </div>
      )}
    </main>
  );
}

function ConnBadge({ status }: { status: string }) {
  if (status === 'open') return null;
  return <p className="muted" style={{ margin: 0, fontSize: 13 }}>{status === 'connecting' ? 'نتصل بالسيرفر… (أول مرة ممكن تاخذ دقيقة)' : 'انقطع الاتصال، نحاول مرة ثانية…'}</p>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      if (navigator.share) { await navigator.share({ title: 'راية', text: 'تعال نلعب راية', url: text }); return; }
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch { /* user cancelled share or clipboard blocked */ }
  }
  return <button type="button" className="btn primary" onClick={copy}>{done ? 'انتسخ!' : label}</button>;
}
