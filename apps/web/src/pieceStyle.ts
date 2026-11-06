import { useEffect, useState } from 'react';
import { load, save } from './storage';

export type PieceStyle = 'icons' | 'numbers';

/** Applied as data-pieces on <html>; the CSS swaps emblems for big numbers. */
export function applyPieceStyle(style: PieceStyle = load<PieceStyle>('raya.pieces', 'icons')): void {
  document.documentElement.dataset.pieces = style;
}

export function usePieceStyle(): [PieceStyle, (s: PieceStyle) => void] {
  const [style, setStyle] = useState<PieceStyle>(() => load<PieceStyle>('raya.pieces', 'icons'));
  useEffect(() => {
    applyPieceStyle(style);
    save('raya.pieces', style);
  }, [style]);
  return [style, setStyle];
}
