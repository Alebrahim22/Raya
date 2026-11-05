import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Lobby, type Conn } from './rooms';
import type { ClientMsg, ServerMsg } from '@raya/engine';

const PORT = Number(process.env.PORT ?? 8787);
const lobby = new Lobby();

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('راية — game server');
});

const wss = new WebSocketServer({ server: http, maxPayload: 16 * 1024 });
const conns = new WeakMap<WebSocket, Conn>();

wss.on('connection', (ws) => {
  const conn: Conn = {
    send(msg: ServerMsg) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    },
  };
  conns.set(ws, conn);
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const ping = setInterval(() => {
    if (!alive) return ws.terminate();
    alive = false;
    ws.ping();
  }, 25_000);

  ws.on('message', (data) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return conn.send({ t: 'error', code: 'bad-msg', msg: 'invalid json' });
    }
    try {
      lobby.handle(conn, msg);
    } catch (err) {
      console.error('handler error', err);
      conn.send({ t: 'error', code: 'bad-msg', msg: 'could not handle message' });
    }
  });
  ws.on('close', () => {
    clearInterval(ping);
    lobby.disconnect(conn);
  });
});

setInterval(() => lobby.sweep(), 5 * 60_000);

http.listen(PORT, () => console.log(`raya server on :${PORT}`));
