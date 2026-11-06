import type { Rank } from '@raya/engine';

export const PIECE_NAME: Record<string, string> = {
  10: 'القائد', 9: 'الوزير', 8: 'الفارس', 7: 'الحارس', 6: 'الرامي', 5: 'الرمّاح',
  4: 'الجندي', 3: 'المهندس', 2: 'الكشّاف', 1: 'الظل', B: 'اللغم', F: 'الراية',
};

const ICON: Record<string, string> = {
  10: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  9: 'M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z',
  8: 'M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M9.5 17.5L21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4',
  7: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  6: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  5: 'M5 19L19 5M12 5h7v7',
  4: 'M5 13l7-5 7 5M5 18l7-5 7 5',
  3: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z',
  2: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  1: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  B: 'M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2',
  F: 'M6 21V3M6 4h11l-2.5 4L17 12H6',
  hidden: 'M5 5h14v14H5zM12 2.1L21.9 12 12 21.9 2.1 12z',
};

export function Emblem({ rank, size = 18 }: { rank: Rank | null; size?: number }) {
  const d = ICON[rank === null ? 'hidden' : String(rank)];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  swords: ICON[8],
  bot: 'M4 9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM12 3v3M9 12h.01M15 12h.01',
  friends: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.5 3.5 5.2',
  palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 21 9.7C21 5.9 17 3 12 3zM7.5 12.5h.01M9.5 8h.01M14.5 8h.01',
  back: 'M9 6l6 6-6 6',
  shuffle: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  flag: ICON.F,
};
