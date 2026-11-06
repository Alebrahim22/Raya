import { useEffect, useState } from 'react';
import type { GameRules } from '@raya/engine';
import { load, save } from './storage';

/** The host's house-rule choice, remembered on this device. */
export function useHouseRules(): [GameRules, (r: GameRules) => void] {
  const [rules, setRules] = useState<GameRules>(() => load<GameRules>('raya.rules', {}));
  useEffect(() => save('raya.rules', rules), [rules]);
  return [rules, setRules];
}

/** Toggle for the host; read-only note for everyone else. */
export function HouseRules({ rules, onChange }: { rules: GameRules; onChange?: (r: GameRules) => void }) {
  const on = !!rules.diagonal4;
  if (!onChange) {
    if (!on) return null;
    return (
      <div className="house-rule readonly" role="note">
        <span className="hr-badge" aria-hidden="true">٤</span>
        <span><b>قاعدة إضافية مفعّلة</b><small>الجندي (٤) يقدر يتحرك ويهاجم قطري مربع واحد</small></span>
      </div>
    );
  }
  return (
    <button type="button" className={`house-rule ${on ? 'on' : ''}`} role="switch" aria-checked={on}
      onClick={() => onChange({ ...rules, diagonal4: !on })}>
      <span className="hr-badge" aria-hidden="true">٤</span>
      <span><b>الجندي يتحرك قطري</b><small>قاعدة إضافية: الـ٤ يقدر يمشي ويهاجم مربع واحد بزاوية ٤٥°</small></span>
      <span className="hr-switch" aria-hidden="true" />
    </button>
  );
}
