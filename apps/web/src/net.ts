import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, Move, MoveEvent, PlayerView, RoomInfo, ServerMsg } from '@raya/engine';
import { load, save } from './storage';

export const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? `ws://${location.hostname}:8787`;

interface Session { code: string; token: string }

export interface OnlineState {
  status: 'connecting' | 'open' | 'closed';
  room: RoomInfo | null;
  view: PlayerView | null;
  legal: Move[];
  event: MoveEvent | null;
  queued: boolean;
  error: string | null;
}

const ERRORS: Record<string, string> = {
  'no-room': 'ما لقينا الغرفة. تأكد من الكود.',
  'room-full': 'الغرفة فيها لاعبين.',
  'bad-setup': 'الترتيب غير صحيح.',
  illegal: 'حركة غير مسموحة.',
  'bad-token': 'انتهت الجلسة.',
  'bad-msg': 'صار خطأ، حاول مرة ثانية.',
};

/** One WebSocket to the game server, reconnecting and resuming the saved room on drops. */
export function useOnline() {
  const [st, setSt] = useState<OnlineState>({
    status: 'connecting', room: null, view: null, legal: [], event: null, queued: false, error: null,
  });
  const ws = useRef<WebSocket | null>(null);
  const outbox = useRef<ClientMsg[]>([]);
  const retry = useRef(0);
  const closedByUs = useRef(false);

  const send = useCallback((msg: ClientMsg) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg));
    else outbox.current.push(msg);
  }, []);

  useEffect(() => {
    closedByUs.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      setSt((s) => ({ ...s, status: 'connecting' }));
      const sock = new WebSocket(SERVER_URL);
      ws.current = sock;
      sock.onopen = () => {
        retry.current = 0;
        setSt((s) => ({ ...s, status: 'open' }));
        const session = load<Session | null>('raya.session', null);
        if (session) sock.send(JSON.stringify({ t: 'resume', ...session } satisfies ClientMsg));
        for (const m of outbox.current.splice(0)) sock.send(JSON.stringify(m));
      };
      sock.onmessage = (e) => {
        const msg = JSON.parse(String(e.data)) as ServerMsg;
        switch (msg.t) {
          case 'joined':
            save('raya.session', { code: msg.code, token: msg.token });
            setSt((s) => ({ ...s, queued: false, error: null }));
            break;
          case 'room':
            setSt((s) => ({
              ...s, room: msg.room,
              ...(msg.room.phase === 'setup' ? { view: null, legal: [], event: null } : {}),
            }));
            break;
          case 'state':
            setSt((s) => ({ ...s, view: msg.view, legal: msg.legal, event: msg.event }));
            break;
          case 'queued':
            setSt((s) => ({ ...s, queued: true }));
            break;
          case 'left':
            save('raya.session', null);
            setSt((s) => ({ ...s, room: null, view: null, legal: [], event: null }));
            break;
          case 'error':
            if (msg.code === 'bad-token' || (msg.code === 'no-room' && load('raya.session', null))) {
              save('raya.session', null);
              setSt((s) => ({ ...s, room: null, view: null }));
            }
            setSt((s) => ({ ...s, error: ERRORS[msg.code] ?? msg.msg }));
            break;
        }
      };
      sock.onclose = () => {
        setSt((s) => ({ ...s, status: 'closed' }));
        if (closedByUs.current) return;
        const wait = Math.min(1000 * 2 ** retry.current++, 10_000);
        timer = setTimeout(connect, wait);
      };
    };
    connect();
    return () => {
      closedByUs.current = true;
      clearTimeout(timer);
      ws.current?.close();
    };
  }, []);

  const clearError = useCallback(() => setSt((s) => ({ ...s, error: null })), []);
  return { ...st, send, clearError };
}
