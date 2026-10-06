import type { Theme, PostData, SlideData } from "../types";
import { PHOTO_H } from "../fields";

// 모든 템플릿이 같이 쓰는 그리기 조각. 1080×1350(4:5), 인스타 안전 영역:
//  · 안쪽 장: x 60~1020, y 175~1175   · 표지: 프로필 그리드(3:4) x 175~905, y 175~1175
export const SLIDE = { w: 1080, h: 1350 } as const;
//  · 릴스(1080×1920): x 60~940, y 250~1540 (위 머리글·오른쪽 버튼·아래 계정·캡션을 피한 대략값)
export const SAFE = { feed: [60, 175, 1020, 1175], cover: [175, 175, 905, 1175], reel: [60, 250, 940, 1540] } as const;

/** sub: 릴스 자막 몇 번째를 그릴지 (-1 = 자막 없이) */
export type Ctx = { theme: Theme; post: PostData; debug: boolean; resolve: (url: string) => string; size: { w: number; h: number }; sub: number };
export type SlideProps = { c: Ctx; s: SlideData; n: number; total: number };

export const str = (s: SlideData, k: string) => (typeof s[k] === "string" ? (s[k] as string) : "");
export function photoOf(c: Ctx, idx: unknown): string | null {
  if (c.debug || typeof idx !== "number") return null;
  const p = c.post.photos[idx];
  return p ? c.resolve(p.url) : null;
}
export const photoY = (s: SlideData) => (typeof s.photoY === "number" ? s.photoY : 50);
export const photoH = (s: SlideData) => Math.round((SLIDE.h * Math.min(PHOTO_H.max, Math.max(PHOTO_H.min, typeof s.photoH === "number" ? s.photoH : PHOTO_H.default))) / 100);

/** satori 는 글 안의 줄바꿈을 공백으로 그린다 → 줄마다 따로 */
export function Lines({ text, style, align = "center" }: { text: string; style: React.CSSProperties; align?: "center" | "flex-start" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, width: "100%" }}>
      {text.split("\n").map((l, i) => <span key={i} style={{ ...style, wordBreak: "break-all" }}>{l || " "}</span>)}
    </div>
  );
}

/** 사진 깔기 (아래로 갈수록 어둡게: low = 글이 아래에, full = 전체 어둡게) */
export function Backdrop({ c, src, y, shade }: { c: Ctx; src: string | null; y: number; shade: "low" | "full" }) {
  if (!src) return null;
  const d = c.theme.dark;
  const rgba = (a: number) => hexA(d, a);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={SLIDE.w} height={SLIDE.h} style={{ position: "absolute", left: 0, top: 0, width: SLIDE.w, height: SLIDE.h, objectFit: "cover", objectPosition: `50% ${y}%` }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: SLIDE.w, height: SLIDE.h, backgroundImage: shade === "full"
        ? `linear-gradient(180deg, ${rgba(0.55)} 0%, ${rgba(0.72)} 100%)`
        : `linear-gradient(180deg, ${rgba(0.45)} 0%, ${rgba(0)} 26%, ${rgba(0)} 42%, ${rgba(0.84)} 100%)` }} />
    </>
  );
}

export function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function Wordmark({ c }: { c: Ctx }) {
  const w = c.theme.wordmark;
  return <span style={{ display: "flex", padding: "8px 18px", borderRadius: 999, background: w.bg, color: w.color, fontSize: 22, fontWeight: 800, letterSpacing: 4 }}>{w.text}</span>;
}

/** 안쪽 장 머리: 워드마크 + 쪽 번호 */
export function Head({ c, n, total, light }: { c: Ctx; n: number; total: number; light: boolean }) {
  return (
    <div style={{ position: "absolute", left: SAFE.feed[0], top: SAFE.feed[1], width: SAFE.feed[2] - SAFE.feed[0], display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Wordmark c={c} />
      <span style={{ fontSize: 24, fontWeight: 800, color: light ? c.theme.ink : c.theme.light }}>{String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
    </div>
  );
}

/** 강조색 채움 알약 (글자는 onAccent) */
export const AccentPill = ({ c, text, size = 26 }: { c: Ctx; text: string; size?: number }) => (
  <span style={{ display: "flex", maxWidth: "100%", padding: "8px 22px", borderRadius: 999, background: c.theme.accent, color: c.theme.onAccent, fontSize: size, fontWeight: 800, wordBreak: "break-all" }}>{text}</span>
);
export const LightPill = ({ c, text, size = 30 }: { c: Ctx; text: string; size?: number }) => (
  <span style={{ display: "flex", maxWidth: "100%", padding: "12px 26px", borderRadius: 999, background: c.theme.light, color: c.theme.ink, fontSize: size, fontWeight: 800, wordBreak: "break-all" }}>{text}</span>
);
export const NumBox = ({ c, n, on, size = 56 }: { c: Ctx; n: number; on: boolean; size?: number }) => (
  <span style={{ display: "flex", flexShrink: 0, width: size, height: size, borderRadius: 14, border: `3px solid ${c.theme.ink}`, alignItems: "center", justifyContent: "center", fontSize: Math.round(size / 2), fontWeight: 800, color: on ? c.theme.onAccent : c.theme.ink, background: on ? c.theme.accent : c.theme.light }}>{n}</span>
);

/** 밝은 장 제목 (작은 줄 + 큰 줄) */
export function LightTitle({ c, small, big }: { c: Ctx; small: string; big: string }) {
  const [x0, , x1] = SAFE.feed;
  return (
    <div style={{ position: "absolute", left: x0, width: x1 - x0, top: 270, display: "flex", flexDirection: "column", gap: 4 }}>
      {small && <span style={{ fontSize: 34, fontWeight: 500, color: c.theme.ink, wordBreak: "break-all" }}>{small}</span>}
      <span style={{ fontSize: 76, fontWeight: 800, color: c.theme.ink, letterSpacing: -2, wordBreak: "break-all" }}>{big}</span>
    </div>
  );
}

/** 사진 위 질문 + 밝은 상자 답 (소개·인터뷰가 같이 쓴다) */
export function QA({ c, s, n, total }: SlideProps) {
  const [x0, , x1, y1] = SAFE.feed;
  return (
    <>
      <Backdrop c={c} src={photoOf(c, s.photo)} y={photoY(s)} shade="low" />
      <Head c={c} n={n} total={total} light={false} />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, bottom: SLIDE.h - y1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
        <span style={{ display: "flex", maxWidth: "100%", padding: "10px 22px", borderRadius: 14, background: c.theme.accent, color: c.theme.onAccent, fontSize: 32, fontWeight: 800, wordBreak: "break-all" }}>Q. {str(s, "q")}</span>
        <div style={{ display: "flex", width: "100%", padding: "30px 34px", borderRadius: 24, background: c.theme.light, border: `3px solid ${c.theme.ink}` }}>
          <Lines text={str(s, "a")} align="flex-start" style={{ fontSize: 34, fontWeight: 500, color: c.theme.ink, lineHeight: 1.5 }} />
        </div>
      </div>
    </>
  );
}

// ── 인기 형태 템플릿(뉴스·포스터·릴스)이 같이 쓰는 조각 ─────────────────

type Seg = { t: string; b: boolean; hl: boolean };
/** **굵게** · ==강조== 를 조각으로 */
export function parseRich(line: string): Seg[] {
  const out: Seg[] = [];
  const re = /\*\*(.+?)\*\*|==(.+?)==/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index), b: false, hl: false });
    out.push(m[1] !== undefined ? { t: m[1], b: true, hl: false } : { t: m[2], b: true, hl: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ t: line.slice(last), b: false, hl: false });
  return out;
}
/** 줄을 넘는 **…**·==…== 는 줄마다 닫고 다시 연다 */
export const spanLines = (t: string) => t.replace(/\*\*([\s\S]+?)\*\*/g, (m, x: string) => `**${x.split("\n").join("**\n**")}**`).replace(/==([\s\S]+?)==/g, (m, x: string) => `==${x.split("\n").join("==\n==")}==`);
export const plain = (s: string) => s.replace(/\*\*(.+?)\*\*|==(.+?)==/g, "$1$2");

/**
 * 표시가 섞인 글. 줄마다, 낱말마다 따로 그려 띄어쓰기에서 줄을 바꾼다(한국어 낱말 단위).
 * hl: "fill" = 강조색 채움 + onAccent 글자(기본, 브랜드 규칙) · "text" = 강조색 글자
 */
export function Rich({ c, text, size, color, weight = 500, lh = 1.5, align = "left", hl: hl0 = "fill", gap = 0 }: {
  c: Ctx; text: string; size: number; color: string; weight?: number; lh?: number; align?: "left" | "center"; hl?: string; gap?: number;
}) {
  const hl = hlMode(c, hl0, color);
  const jc = align === "center" ? "center" : "flex-start";
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", alignItems: jc, gap }}>
      {spanLines(text).split("\n").map((line, i) => {
        if (!line.trim()) return <span key={i} style={{ display: "flex", height: size * lh * 0.6 }} />;
        // 낱말 = 띄어쓰기로 나눈 덩어리 (덩어리 안에서는 굵게·강조가 바뀔 수 있다)
        const words: Seg[][] = [[]];
        // ==강조== 는 띄어쓰기가 있어도 한 덩어리 (채움 알약이 끊기지 않게)
        for (const sg of parseRich(line)) (sg.hl ? [sg.t] : sg.t.split(/( )/)).forEach((part) => {
          if (part === " ") { if (words[words.length - 1].length) words.push([]); }
          else if (part) words[words.length - 1].push({ ...sg, t: part });
        });
        return (
          <div key={i} style={{ display: "flex", flexWrap: "wrap", justifyContent: jc, width: "100%", columnGap: Math.round(size * 0.28) }}>
            {words.filter((w) => w.length).map((w, j) => (
              <div key={j} style={{ display: "flex", maxWidth: "100%" }}>
                {w.map((sg, k) => (
                  <span key={k} style={{
                    fontSize: size, lineHeight: lh, fontWeight: sg.b ? 800 : weight, wordBreak: "break-all",
                    color: sg.hl ? (hl === "fill" ? c.theme.onAccent : c.theme.accent) : color,
                    ...(sg.hl && hl === "fill" ? { background: c.theme.accent, padding: `0 ${Math.round(size * 0.16)}px`, borderRadius: Math.round(size * 0.18) } : {}),
                  }}>{sg.t}</span>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** 번호 원 (사진과 글 경계, 또는 제목 위) */
export function NumCircle({ c, n, size = 72, dark = false }: { c: Ctx; n: number; size?: number; dark?: boolean }) {
  return (
    <span style={{ display: "flex", flexShrink: 0, width: size, height: size, borderRadius: size, alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.5), fontWeight: 800,
      background: dark ? hexA(c.theme.dark, 0.72) : c.theme.light, color: dark ? c.theme.light : c.theme.ink, border: `3px solid ${dark ? hexA(c.theme.light, 0.9) : hexA(c.theme.ink, 0.12)}` }}>{n}</span>
  );
}

/** 테이프 제목: 살짝 기운 어두운 띠 위 밝은 글자 (포스터형) */
export function Tape({ c, text, size = 64, tilt = -1.5 }: { c: Ctx; text: string; size?: number; tilt?: number }) {
  return (
    <div style={{ display: "flex", maxWidth: "100%", transform: `rotate(${tilt}deg)` }}>
      <span style={{ display: "flex", maxWidth: "100%", padding: `${Math.round(size * 0.16)}px ${Math.round(size * 0.42)}px`, background: c.theme.dark, color: c.theme.light, fontSize: size, fontWeight: 800, letterSpacing: -1, lineHeight: 1.2, wordBreak: "break-all",
        boxShadow: `${Math.round(size * 0.12)}px ${Math.round(size * 0.1)}px 0 ${hexA(c.theme.dark, 0.18)}` }}>{text}</span>
    </div>
  );
}

/** 윗줄: "AI NEWS | 브랜드" 같은 작은 분류 줄 */
export function Kicker({ text, color, size = 26 }: { text: string; color: string; size?: number }) {
  const [a, b] = text.split("|").map((x) => x.trim());
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: size, fontWeight: 500, color, maxWidth: "100%" }}>
      <span style={{ wordBreak: "break-all" }}>{a}</span>
      {b !== undefined && <span style={{ display: "flex", width: 2, height: size, background: color }} />}
      {b !== undefined && <span style={{ wordBreak: "break-all" }}>{b}</span>}
    </div>
  );
}

/** 사진 출처 작은 글 (예: X / @account) */
export const Credit = ({ text, color, align = "right" }: { text: string; color: string; align?: "right" | "left" }) => (
  <span style={{ display: "flex", width: "100%", justifyContent: align === "right" ? "flex-end" : "flex-start", fontSize: 20, fontWeight: 500, color, wordBreak: "break-all" }}>{text}</span>
);

/** 사진 넣기 (상자 크기에 채워 자르기). 디버그(마진 계산)·사진 없음이면 아무것도 안 그린다 */
export function Pic({ src, x, y, w, h, pos = 50, radius = 0, fit = "cover" }: { src: string | null; x: number; y: number; w: number; h: number; pos?: number; radius?: number; fit?: "cover" | "contain" }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={w} height={h} style={{ position: "absolute", left: x, top: y, width: w, height: h, objectFit: fit, objectPosition: `50% ${pos}%`, borderRadius: radius }} />;
}

/** 글 크기 단계 (S·M·L) */
export const scale = (v: string) => (v === "s" ? 0.86 : v === "l" ? 1.14 : 1);

/** 글 폭 대략 (satori 는 미리 재지 못해서): 한글·한자 1, 넓은 영문 0.95, 나머지 0.6, 띄어쓰기 0.28 (× 글 크기) */
function widthOf(s: string) {
  let w = 0;
  for (const ch of s) w += /[ㄱ-힝一-鿿]/.test(ch) ? 1 : /[WMQ@%&]/.test(ch) ? 0.95 : ch === " " ? 0.28 : /[A-Z0-9]/.test(ch) ? 0.68 : 0.58;
  return w;
}
/** 글 덩어리 높이 대략 (줄바꿈 + 넘침 줄, 낱말 단위 줄바꿈 여유 10%) */
export function estH(text: string, size: number, lh: number, width: number) {
  if (!text) return 0;
  return text.split("\n").reduce((h, line) => h + (line.trim() ? Math.max(1, Math.ceil((widthOf(plain(line)) * size * 1.1) / width)) * size * lh : size * lh * 0.6), 0);
}
/** 주어진 높이에 들어가도록 글 크기 배율을 줄인다 (1 → 최소 min). blocks = [글, 크기, 줄간격, 폭] + 고정 높이 */
export function fit(blocks: [string, number, number, number][], fixed: number, avail: number, min = 0.62) {
  for (let k = 1; k >= min; k -= 0.04) {
    const h = fixed + blocks.reduce((a, [t, s, lh, w]) => a + estH(t, s * k, lh, w), 0);
    if (h <= avail) return k;
  }
  return min;
}
export const has = (v: unknown) => typeof v === "number";

/** 밝기 0~1 */
export function lum(hex: string) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
/** 채도 0~1 (가장 큰 채널 − 가장 작은 채널) */
export function chroma(hex: string) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (Math.max(...ch) - Math.min(...ch)) / 255;
}
/** '강조색 글자'인데 강조색이 너무 밝으면 채움으로 바꾼다 — 밝은 바탕에선 안 읽히고, 어두운 바탕에서도 회색(흑백 기본 #D9D9D9)이면
 *  흰 글자와 구분이 안 된다. 어두운 바탕 + 색이 있는 밝은 강조색(예: 라임 #CCFF00)만 글자 그대로 */
export const hlMode = (c: Ctx, hl: string, ink?: string) => (hl === "text" && lum(c.theme.accent) > 0.7 && !(ink && lum(ink) > 0.5 && chroma(c.theme.accent) > 0.3) ? "fill" : hl);
