import { useMemo, useState } from 'react';
import { SIZE, randomSetup, validateSetup } from '@raya/engine';
import type { PublicPiece, Pos, Setup } from '@raya/engine';
import { Board } from '../Board';
import { ICONS, Icon, PIECE_NAME } from '../pieces';
import { load, save } from '../storage';
import { usePieceStyle } from '../pieceStyle';

interface Props {
  onBack: () => void;
  onReady: (s: Setup) => void;
  subtitle?: string;
}

export function SetupScreen({ onBack, onReady, subtitle }: Props) {
  const [setup, setSetup] = useState<Setup>(() => {
    const saved = load<Setup | null>('raya.lastSetup', null);
    return saved && !validateSetup(saved) ? saved : randomSetup();
  });
  const [picked, setPicked] = useState<Pos | null>(null);
  const [pieceStyle, setPieceStyle] = usePieceStyle();

  const board = useMemo(() => {
    const b: (PublicPiece | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    setup.forEach((row, i) => row.forEach((rank, c) => {
      b[6 + i][c] = { id: `s${i}-${c}`, owner: 0, rank, revealed: true };
    }));
    return b;
  }, [setup]);

  function tap(p: Pos) {
    if (p.r < 6) return;
    if (!picked) { setPicked(p); return; }
    const next = setup.map((row) => [...row]);
    const a = next[picked.r - 6][picked.c];
    next[picked.r - 6][picked.c] = next[p.r - 6][p.c];
    next[p.r - 6][p.c] = a;
    setSetup(next);
    setPicked(null);
  }

  const pickedName = picked ? PIECE_NAME[String(setup[picked.r - 6][picked.c])] : null;

  return (
    <main className="screen">
      <div className="setup-head">
        <div>
          <h2>رتّب جيشك{subtitle ? <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> · {subtitle}</span> : null}</h2>
          <span className="muted" style={{ fontSize: 13 }}>
            {pickedName ? `اخترت ${pickedName}. اضغط قطعة ثانية للتبديل` : 'اضغط قطعتين عشان تبدّل مكانهم'}
          </span>
        </div>
        <button type="button" className="icon-btn" aria-label="رجوع" onClick={onBack}><Icon d={ICONS.back} /></button>
      </div>

      <Board board={board} me={0} selected={picked} dimRows={(r) => r < 6} onCell={tap} />

      <div className="style-pick" role="group" aria-label="شكل القطع">
        <span className="muted">شكل القطع</span>
        <button type="button" className="btn" aria-pressed={pieceStyle === 'icons'} onClick={() => setPieceStyle('icons')}>رموز</button>
        <button type="button" className="btn" aria-pressed={pieceStyle === 'numbers'} onClick={() => setPieceStyle('numbers')}>أرقام كبيرة</button>
      </div>

      <div className="grid2">
        <button type="button" className="btn" onClick={() => { setSetup(randomSetup()); setPicked(null); }}>
          <Icon d={ICONS.shuffle} size={18} /> ترتيب عشوائي
        </button>
        <button type="button" className="btn" onClick={() => { const s = load<Setup | null>('raya.lastSetup', null); if (s && !validateSetup(s)) setSetup(s); }}>
          آخر ترتيب لي
        </button>
      </div>
      <button type="button" className="btn primary" style={{ marginTop: 'auto' }}
        onClick={() => { save('raya.lastSetup', setup); onReady(setup); }}>
        جاهز
      </button>
    </main>
  );
}
