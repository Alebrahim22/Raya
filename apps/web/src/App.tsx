import { useEffect, useState } from 'react';
import type { BotLevel, Setup } from '@raya/engine';
import { Home } from './screens/Home';
import { SetupScreen } from './screens/SetupScreen';
import { GameScreen } from './screens/GameScreen';
import { Rules } from './screens/Rules';
import { load, save } from './storage';

export type Skin = 'war' | 'clay';
type Screen = { name: 'home' } | { name: 'setup' } | { name: 'game'; setup: Setup } | { name: 'rules' };

export function App() {
  const [skin, setSkin] = useState<Skin>(() => load<Skin>('raya.skin', 'war'));
  const [level, setLevel] = useState<BotLevel>(() => load<BotLevel>('raya.level', 'medium'));
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', skin === 'war' ? '#110F24' : '#DDEBFA');
    save('raya.skin', skin);
  }, [skin]);
  useEffect(() => save('raya.level', level), [level]);

  return (
    <div className="app">
      {screen.name === 'home' && (
        <Home skin={skin} onSkin={setSkin} level={level} onLevel={setLevel}
          onPlayBot={() => setScreen({ name: 'setup' })} onRules={() => setScreen({ name: 'rules' })} />
      )}
      {screen.name === 'setup' && (
        <SetupScreen onBack={() => setScreen({ name: 'home' })} onReady={(setup) => setScreen({ name: 'game', setup })} />
      )}
      {screen.name === 'game' && (
        <GameScreen key={JSON.stringify(screen.setup)} setup={screen.setup} level={level}
          onExit={() => setScreen({ name: 'home' })} onRematch={() => setScreen({ name: 'setup' })} />
      )}
      {screen.name === 'rules' && <Rules onBack={() => setScreen({ name: 'home' })} />}
    </div>
  );
}
