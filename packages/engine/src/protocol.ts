import type { Move, MoveEvent, PlayerView, Pos, Setup } from './types';

export type Seat = 0 | 1;
export type Phase = 'waiting' | 'setup' | 'playing' | 'over';

export type ClientMsg =
  | { t: 'create'; name: string }
  | { t: 'join'; code: string; name: string }
  | { t: 'quick'; name: string }
  | { t: 'cancelQuick' }
  | { t: 'resume'; code: string; token: string }
  | { t: 'setup'; setup: Setup }
  | { t: 'move'; from: Pos; to: Pos }
  | { t: 'resign' }
  | { t: 'rematch' }
  | { t: 'leave' };

export interface RoomInfo {
  code: string;
  phase: Phase;
  seat: Seat;
  names: [string | null, string | null];
  ready: [boolean, boolean];
  connected: [boolean, boolean];
  rematch: [boolean, boolean];
}

export type ServerMsg =
  | { t: 'joined'; code: string; token: string; seat: Seat }
  | { t: 'room'; room: RoomInfo }
  | { t: 'state'; view: PlayerView; legal: Move[]; event: MoveEvent | null }
  | { t: 'queued' }
  | { t: 'left' }
  | { t: 'error'; code: 'no-room' | 'room-full' | 'bad-setup' | 'illegal' | 'bad-token' | 'bad-msg'; msg: string };
