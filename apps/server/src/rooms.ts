import { randomBytes, randomInt } from 'node:crypto';
import {
  applyMove, createGame, isLegal, legalMoves, resign, validateSetup, viewFor,
} from '@raya/engine';
import type { GameState, MoveEvent, Setup } from '@raya/engine';
import type { ClientMsg, Phase, RoomInfo, Seat, ServerMsg } from '@raya/engine';

/** Anything that can receive messages: a WebSocket in production, a stub in tests. */
export interface Conn {
  send(msg: ServerMsg): void;
}

interface SeatState {
  token: string;
  name: string;
  conn: Conn | null;
  setup: Setup | null;
  rematch: boolean;
}

export interface Room {
  code: string;
  seats: [SeatState | null, SeatState | null];
  phase: Phase;
  game: GameState | null;
  lastEvent: MoveEvent | null;
  touched: number;
  firstSeat: Seat;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid misreading
const IDLE_MS = 60 * 60 * 1000;

export class Lobby {
  rooms = new Map<string, Room>();
  private where = new Map<Conn, { code: string; seat: Seat }>();
  private queue: { conn: Conn; name: string } | null = null;

  constructor(private now: () => number = Date.now) {}

  handle(conn: Conn, msg: ClientMsg): void {
    switch (msg.t) {
      case 'create': this.create(conn, msg.name); return;
      case 'join': return this.join(conn, msg.code, msg.name);
      case 'quick': return this.quick(conn, msg.name);
      case 'cancelQuick': if (this.queue?.conn === conn) this.queue = null; return;
      case 'resume': return this.resume(conn, msg.code, msg.token);
      case 'setup': return this.setup(conn, msg.setup);
      case 'move': return this.move(conn, msg);
      case 'resign': return this.resign(conn);
      case 'rematch': return this.rematch(conn);
      case 'leave': return this.leave(conn);
      default: conn.send({ t: 'error', code: 'bad-msg', msg: 'unknown message' });
    }
  }

  disconnect(conn: Conn): void {
    if (this.queue?.conn === conn) this.queue = null;
    const at = this.where.get(conn);
    this.where.delete(conn);
    if (!at) return;
    const room = this.rooms.get(at.code);
    const seat = room?.seats[at.seat];
    if (room && seat && seat.conn === conn) {
      seat.conn = null;
      this.broadcastRoom(room);
    }
  }

  /** Drop rooms nobody has touched for an hour. */
  sweep(): void {
    const cutoff = this.now() - IDLE_MS;
    for (const [code, room] of this.rooms) if (room.touched < cutoff) this.rooms.delete(code);
  }

  // ---------- joining ----------

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < 5; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  private seatFor(room: Room, seat: Seat, conn: Conn, name: string): void {
    this.detach(conn);
    const token = randomBytes(16).toString('hex');
    room.seats[seat] = { token, name: clean(name), conn, setup: null, rematch: false };
    this.where.set(conn, { code: room.code, seat });
    conn.send({ t: 'joined', code: room.code, token, seat });
  }

  private create(conn: Conn, name: string): Room {
    const room: Room = {
      code: this.newCode(), seats: [null, null], phase: 'waiting', game: null, lastEvent: null,
      touched: this.now(), firstSeat: randomInt(2) as Seat,
    };
    this.rooms.set(room.code, room);
    this.seatFor(room, 0, conn, name);
    this.broadcastRoom(room);
    return room;
  }

  private join(conn: Conn, rawCode: string, name: string): void {
    const room = this.rooms.get(String(rawCode).trim().toUpperCase());
    if (!room) return conn.send({ t: 'error', code: 'no-room', msg: 'room not found' });
    if (room.seats[1]) return conn.send({ t: 'error', code: 'room-full', msg: 'room is full' });
    this.seatFor(room, 1, conn, name);
    room.phase = 'setup';
    room.touched = this.now();
    this.broadcastRoom(room);
  }

  private quick(conn: Conn, name: string): void {
    const waiting = this.queue;
    if (waiting && waiting.conn !== conn) {
      this.queue = null;
      const room = this.create(waiting.conn, waiting.name);
      this.join(conn, room.code, name);
      return;
    }
    this.queue = { conn, name };
    conn.send({ t: 'queued' });
  }

  private resume(conn: Conn, rawCode: string, token: string): void {
    const room = this.rooms.get(String(rawCode).trim().toUpperCase());
    if (!room) return conn.send({ t: 'error', code: 'no-room', msg: 'room not found' });
    const seat = ([0, 1] as Seat[]).find((s) => room.seats[s]?.token === token);
    if (seat === undefined) return conn.send({ t: 'error', code: 'bad-token', msg: 'not your room' });
    this.detach(conn);
    const st = room.seats[seat]!;
    st.conn = conn;
    this.where.set(conn, { code: room.code, seat });
    conn.send({ t: 'joined', code: room.code, token, seat });
    room.touched = this.now();
    this.broadcastRoom(room);
    if (room.game) this.sendState(room, seat);
  }

  private leave(conn: Conn): void {
    const ctx = this.ctx(conn);
    this.detach(conn);
    conn.send({ t: 'left' });
    if (!ctx) return;
    const { room, seat } = ctx;
    if (room.phase === 'playing' && room.game) {
      room.game = resign(room.game, seat);
      room.phase = 'over';
      this.broadcastState(room);
    }
    room.seats[seat] = null;
    if (!room.seats[0] && !room.seats[1]) this.rooms.delete(room.code);
    else this.broadcastRoom(room);
  }

  private detach(conn: Conn): void {
    const at = this.where.get(conn);
    if (!at) return;
    this.where.delete(conn);
    const st = this.rooms.get(at.code)?.seats[at.seat];
    if (st && st.conn === conn) st.conn = null;
  }

  // ---------- playing ----------

  private ctx(conn: Conn): { room: Room; seat: Seat } | null {
    const at = this.where.get(conn);
    const room = at && this.rooms.get(at.code);
    if (!at || !room) {
      conn.send({ t: 'error', code: 'no-room', msg: 'not in a room' });
      return null;
    }
    room.touched = this.now();
    return { room, seat: at.seat };
  }

  private setup(conn: Conn, setup: Setup): void {
    const ctx = this.ctx(conn);
    if (!ctx) return;
    const { room, seat } = ctx;
    if (room.phase !== 'setup') return conn.send({ t: 'error', code: 'illegal', msg: 'not in setup' });
    if (!Array.isArray(setup) || validateSetup(setup)) return conn.send({ t: 'error', code: 'bad-setup', msg: 'invalid setup' });
    room.seats[seat]!.setup = setup;
    const [a, b] = room.seats;
    if (a?.setup && b?.setup) {
      room.game = createGame(a.setup, b.setup, room.firstSeat);
      room.lastEvent = null;
      room.phase = 'playing';
      this.broadcastRoom(room);
      this.broadcastState(room);
    } else {
      this.broadcastRoom(room);
    }
  }

  private move(conn: Conn, msg: Extract<ClientMsg, { t: 'move' }>): void {
    const ctx = this.ctx(conn);
    if (!ctx) return;
    const { room, seat } = ctx;
    const game = room.game;
    const move = { from: msg.from, to: msg.to };
    if (room.phase !== 'playing' || !game || game.turn !== seat || !isLegal(game, move)) {
      return conn.send({ t: 'error', code: 'illegal', msg: 'illegal move' });
    }
    const res = applyMove(game, move);
    room.game = res.state;
    room.lastEvent = res.event;
    if (res.state.status.kind !== 'playing') room.phase = 'over';
    this.broadcastState(room);
    if (room.phase === 'over') this.broadcastRoom(room);
  }

  private resign(conn: Conn): void {
    const ctx = this.ctx(conn);
    if (!ctx || !ctx.room.game || ctx.room.phase !== 'playing') return;
    ctx.room.game = resign(ctx.room.game, ctx.seat);
    ctx.room.phase = 'over';
    this.broadcastState(ctx.room);
    this.broadcastRoom(ctx.room);
  }

  private rematch(conn: Conn): void {
    const ctx = this.ctx(conn);
    if (!ctx || ctx.room.phase !== 'over') return;
    const { room, seat } = ctx;
    room.seats[seat]!.rematch = true;
    if (room.seats[0]?.rematch && room.seats[1]?.rematch) {
      for (const s of room.seats) if (s) { s.rematch = false; s.setup = null; }
      room.game = null;
      room.lastEvent = null;
      room.phase = 'setup';
      room.firstSeat = (1 - room.firstSeat) as Seat;
    }
    this.broadcastRoom(room);
  }

  // ---------- broadcasting ----------

  private info(room: Room, seat: Seat): RoomInfo {
    const s = room.seats;
    return {
      code: room.code, phase: room.phase, seat,
      names: [s[0]?.name ?? null, s[1]?.name ?? null],
      ready: [!!s[0]?.setup, !!s[1]?.setup],
      connected: [!!s[0]?.conn, !!s[1]?.conn],
      rematch: [!!s[0]?.rematch, !!s[1]?.rematch],
    };
  }

  private broadcastRoom(room: Room): void {
    for (const seat of [0, 1] as Seat[]) room.seats[seat]?.conn?.send({ t: 'room', room: this.info(room, seat) });
  }

  private sendState(room: Room, seat: Seat): void {
    const st = room.seats[seat];
    if (!st?.conn || !room.game) return;
    const legal = room.game.turn === seat ? legalMoves(room.game, seat) : [];
    // Each player gets only their own redacted view; hidden ranks never leave the server.
    st.conn.send({ t: 'state', view: viewFor(room.game, seat), legal, event: room.lastEvent });
  }

  private broadcastState(room: Room): void {
    this.sendState(room, 0);
    this.sendState(room, 1);
  }
}

function clean(name: unknown): string {
  const s = String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  return s || 'لاعب';
}
