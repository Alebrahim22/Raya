import { describe, expect, it } from 'vitest';
import { randomSetup } from '@raya/engine';
import { Lobby, type Conn } from '../src/rooms';
import type { ServerMsg } from '@raya/engine';

class Stub implements Conn {
  inbox: ServerMsg[] = [];
  send(m: ServerMsg) { this.inbox.push(m); }
  last<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }> | undefined {
    return [...this.inbox].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  }
}

function startGame() {
  const lobby = new Lobby();
  const a = new Stub(), b = new Stub();
  lobby.handle(a, { t: 'create', name: 'محمد' });
  const code = a.last('joined')!.code;
  lobby.handle(b, { t: 'join', code: code.toLowerCase(), name: 'فهد' });
  lobby.handle(a, { t: 'setup', setup: randomSetup() });
  lobby.handle(b, { t: 'setup', setup: randomSetup() });
  return { lobby, a, b, code };
}

describe('rooms', () => {
  it('creates a room, lets a friend join by code, and starts after both setups', () => {
    const { a, b } = startGame();
    expect(a.last('room')!.room.phase).toBe('playing');
    expect(b.last('room')!.room.names).toEqual(['محمد', 'فهد']);
    expect(a.last('state')).toBeTruthy();
    expect(b.last('state')).toBeTruthy();
  });

  it('never sends a player the opponent hidden ranks', () => {
    const { a, b } = startGame();
    const va = a.last('state')!.view;
    const vb = b.last('state')!.view;
    expect(va.board.flat().filter((p) => p && p.owner === 1).every((p) => p!.rank === null)).toBe(true);
    expect(vb.board.flat().filter((p) => p && p.owner === 0).every((p) => p!.rank === null)).toBe(true);
  });

  it('only the player whose turn it is gets legal moves, and moves are validated', () => {
    const { lobby, a, b } = startGame();
    const [mover, other] = a.last('state')!.legal.length ? [a, b] : [b, a];
    expect(other.last('state')!.legal).toHaveLength(0);
    lobby.handle(other, { t: 'move', from: { r: 6, c: 0 }, to: { r: 5, c: 0 } });
    expect(other.last('error')!.code).toBe('illegal');
    const m = mover.last('state')!.legal[0];
    lobby.handle(mover, { t: 'move', ...m });
    expect(other.last('state')!.legal.length).toBeGreaterThan(0);
  });

  it('rejects a bad setup and a third player', () => {
    const lobby = new Lobby();
    const a = new Stub(), b = new Stub(), c = new Stub();
    lobby.handle(a, { t: 'create', name: 'a' });
    const code = a.last('joined')!.code;
    lobby.handle(b, { t: 'join', code, name: 'b' });
    lobby.handle(c, { t: 'join', code, name: 'c' });
    expect(c.last('error')!.code).toBe('room-full');
    lobby.handle(a, { t: 'setup', setup: [[1]] as never });
    expect(a.last('error')!.code).toBe('bad-setup');
  });

  it('lets a disconnected player resume with their token', () => {
    const { lobby, a, b, code } = startGame();
    const token = a.last('joined')!.token;
    lobby.disconnect(a);
    expect(b.last('room')!.room.connected).toEqual([false, true]);
    const a2 = new Stub();
    lobby.handle(a2, { t: 'resume', code, token: 'wrong' });
    expect(a2.last('error')!.code).toBe('bad-token');
    lobby.handle(a2, { t: 'resume', code, token });
    expect(a2.last('state')).toBeTruthy();
    expect(b.last('room')!.room.connected).toEqual([true, true]);
  });

  it('quick match pairs two waiting players', () => {
    const lobby = new Lobby();
    const a = new Stub(), b = new Stub();
    lobby.handle(a, { t: 'quick', name: 'a' });
    expect(a.last('queued')).toBeTruthy();
    lobby.handle(b, { t: 'quick', name: 'b' });
    expect(a.last('room')!.room.phase).toBe('setup');
    expect(b.last('joined')!.seat).toBe(1);
  });

  it('resign ends the game and rematch goes back to setup', () => {
    const { lobby, a, b } = startGame();
    lobby.handle(a, { t: 'resign' });
    const st = b.last('state')!.view.status;
    expect(st).toEqual({ kind: 'won', winner: 1, reason: 'resign' });
    lobby.handle(a, { t: 'rematch' });
    lobby.handle(b, { t: 'rematch' });
    expect(a.last('room')!.room.phase).toBe('setup');
  });
});
