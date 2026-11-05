import type { BotLevel } from '@raya/engine';
import type { Skin } from '../App';
import { Token } from '../Board';
import { ICONS, Icon } from '../pieces';

interface Props {
  skin: Skin;
  onSkin: (s: Skin) => void;
  level: BotLevel;
  onLevel: (l: BotLevel) => void;
  onPlayBot: () => void;
  onRules: () => void;
}

export function Home({ skin, onSkin, level, onLevel, onPlayBot, onRules }: Props) {
  return (
    <main className="screen">
      <div className="hero">
        <div className="hero-tokens" aria-hidden="true">
          <Token piece={{ id: 'a', owner: 0, rank: 10, revealed: true }} me={0} />
          <Token piece={{ id: 'b', owner: 1, rank: null, revealed: false }} me={0} />
          <Token piece={{ id: 'c', owner: 0, rank: 'F', revealed: true }} me={0} />
        </div>
        <h1>راية</h1>
        <p>احمِ رايتك.. واكشف رايتهم</p>
      </div>

      <button type="button" className="btn primary" onClick={onPlayBot}>
        <Icon d={ICONS.swords} /> العب ضد البوت
      </button>
      <div className="levels" role="group" aria-label="مستوى البوت">
        <button type="button" className="btn" aria-pressed={level === 'easy'} onClick={() => onLevel('easy')}>سهل</button>
        <button type="button" className="btn" aria-pressed={level === 'medium'} onClick={() => onLevel('medium')}>متوسط</button>
      </div>

      <div className="grid2">
        <button type="button" className="btn mode-tile" disabled title="قريباً">
          <Icon d={ICONS.friends} size={28} /> مع ربعي (قريباً)
        </button>
        <button type="button" className="btn mode-tile" disabled title="قريباً">
          <Icon d={ICONS.bolt} size={28} /> لعب سريع (قريباً)
        </button>
      </div>

      <div className="section-label">شكل اللعبة</div>
      <div className="skin-pick" role="group" aria-label="شكل اللعبة">
        <button type="button" className="btn" aria-pressed={skin === 'war'} onClick={() => onSkin('war')}>
          <b>طاولة الحرب</b><span className="muted">فخم وداكن</span>
        </button>
        <button type="button" className="btn" aria-pressed={skin === 'clay'} onClick={() => onSkin('clay')}>
          <b>صلصال</b><span className="muted">مشرق ومرح</span>
        </button>
      </div>

      <button type="button" className="btn" onClick={onRules}>طريقة اللعب</button>
    </main>
  );
}
