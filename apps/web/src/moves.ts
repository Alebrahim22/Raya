import type { Move, Pos } from '@raya/engine';

export function legalMovesFromList(legal: Move[], from: Pos): Move[] {
  return legal.filter((m) => m.from.r === from.r && m.from.c === from.c);
}
