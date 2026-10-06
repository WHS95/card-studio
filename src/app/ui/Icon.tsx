// 선 아이콘 (흑백 도구 화면용). 장식이라 aria-hidden — 버튼에는 aria-label 을 따로 단다
const D: Record<string, string> = {
  home: "M3 9.5 L10 4 L17 9.5 V16 H12 V12 H8 V16 H3 Z",
  grid: "M3 3h6v6H3z M11 3h6v6h-6z M3 11h6v6H3z M11 11h6v6h-6z",
  star: "M10 3 L12.1 7.4 L17 8 L13.4 11.3 L14.3 16 L10 13.7 L5.7 16 L6.6 11.3 L3 8 L7.9 7.4 Z",
  tpl: "M3 3h14v14H3z M3 8 H17 M8 8 V17",
  book: "M4 4 H9 a2 2 0 0 1 2 2 V16 a2 2 0 0 0 -2 -2 H4 Z M16 4 H11 V16 a2 2 0 0 1 2 -2 H16 Z",
  card: "M3 5h14v10H3z M3 8.5 H17",
  plug: "M7 3 V7 M13 3 V7 M5 7 H15 V10 a5 5 0 0 1 -10 0 Z M10 15 V18",
  key: "M7 8.5 a3.5 3.5 0 1 0 0.01 0 M9.5 9.5 L16 3 M13 6 L15 8",
  people: "M7.5 4.4 a2.6 2.6 0 1 0 0.01 0 M2.8 16 a4.7 4.7 0 0 1 9.4 0 M14 6 a2 2 0 1 0 0.01 0 M12.6 12.4 a4 4 0 0 1 4.9 3.6",
  export: "M10 3 V12 M6.5 8.5 L10 12 L13.5 8.5 M4 14 V16 H16 V14",
  gear: "M10 7.4 a2.6 2.6 0 1 0 0.01 0 M10 2.5 V4.5 M10 15.5 V17.5 M2.5 10 H4.5 M15.5 10 H17.5 M4.7 4.7 L6.1 6.1 M13.9 13.9 L15.3 15.3 M4.7 15.3 L6.1 13.9 M13.9 6.1 L15.3 4.7",
  panel: "M3 4h14v12H3z M12 4 V16",
  spark: "M10 3 L11.4 8.6 L17 10 L11.4 11.4 L10 17 L8.6 11.4 L3 10 L8.6 8.6 Z",
  plus: "M10 4 V16 M4 10 H16",
  send: "M10 16 V5 M5.5 9.5 L10 5 L14.5 9.5",
  check: "M4.5 10.5 L8 14 L15.5 6",
  warn: "M10 3 L17.5 16 H2.5 Z M10 8 V11.2 M10 13.6 V13.7",
  logout: "M8 4 H4 V16 H8 M12 6 L16 10 L12 14 M16 10 H8",
  brain: "M8 4 a3 3 0 0 0 -3 3 a3 3 0 0 0 0 6 a3 3 0 0 0 3 3 V4 Z M12 4 a3 3 0 0 1 3 3 a3 3 0 0 1 0 6 a3 3 0 0 1 -3 3 V4 Z",
  pen: "M4 16 L5 12 L13 4 L16 7 L8 15 Z",
  brush: "M14 3 L17 6 L10 13 L7 10 Z M7 10 C 4 10 4 14 3 16 C 6 16 9 15.5 9.5 12.5",
};
export type IconName = keyof typeof D;
export default function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className={className} style={{ flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={D[name] ?? D.spark} />
    </svg>
  );
}
