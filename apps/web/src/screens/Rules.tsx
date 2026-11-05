import { ARMY } from '@raya/engine';
import { Token } from '../Board';
import { ICONS, Icon, PIECE_NAME } from '../pieces';

export function Rules({ onBack }: { onBack: () => void }) {
  return (
    <main className="screen">
      <div className="setup-head">
        <h2>طريقة اللعب</h2>
        <button type="button" className="icon-btn" aria-label="رجوع" onClick={onBack}><Icon d={ICONS.back} /></button>
      </div>
      <section className="card rules">
        <h3>الهدف</h3>
        <p style={{ margin: 0 }}>أسّر راية خصمك، أو خلّه بدون أي حركة ممكنة.</p>
      </section>
      <section className="card rules">
        <h3>القواعد</h3>
        <ul>
          <li>كل لاعب يرتّب 40 قطعة بسرية في أول 4 صفوف عنده.</li>
          <li>حركة وحدة بالدور: مربع واحد للأمام أو الخلف أو الجانب، بدون قطري ولا بحيرات.</li>
          <li>الكشّاف يمشي أي مسافة بخط مستقيم، ويقدر يهاجم بنفس الحركة.</li>
          <li>الهجوم يكشف القطعتين: الأقوى يبقى، وإذا تساووا تنشال الثنتين.</li>
          <li>الظل يُسقط القائد بس إذا هو اللي بدأ الهجوم.</li>
          <li>اللغم يدمّر أي مهاجم ما عدا المهندس. اللغم والراية ما يتحركون.</li>
          <li>ما يصير تروح وترجع بين نفس المربعين أكثر من 3 مرات ورا بعض.</li>
        </ul>
      </section>
      <section className="card legend" aria-label="القطع">
        {ARMY.map(([rank, n]) => (
          <div className="item" key={String(rank)}>
            <Token piece={{ id: String(rank), owner: 0, rank, revealed: true }} me={0} />
            <span>{PIECE_NAME[String(rank)]} <span className="muted">×{n}</span></span>
          </div>
        ))}
      </section>
    </main>
  );
}
