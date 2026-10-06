import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { PostData, Theme } from "../types";
import { templateOf } from "../templates";
import { UPLOAD_RE, sizeOf } from "../fields";
import { type Ctx, type SlideProps } from "./kit";
import { MAGAZINE } from "./magazine";
import { INTRO } from "./intro";
import { INTERVIEW } from "./interview";
import { NEWS } from "./news";
import { POSTER } from "./poster";
import { REEL } from "./reel";

const RENDERERS: Record<string, Record<string, (p: SlideProps) => React.ReactNode>> = { magazine: MAGAZINE, intro: INTRO, interview: INTERVIEW, news: NEWS, poster: POSTER, reel: REEL };

const fontCache = new Map<string, Buffer>();
async function font(file: string) {
  if (!fontCache.has(file)) fontCache.set(file, await readFile(join(process.cwd(), "assets", file)));
  return fontCache.get(file)!;
}

/** 직접 올린 사진(/uploads/…)은 파일을 읽어 data URL 로 (satori 가 상대 주소를 못 읽는다) */
const CLEAR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=";
async function resolver(post: PostData, videoHole: boolean) {
  const map = new Map<string, string>();
  for (const p of post.photos) {
    if (p.kind === "video" && videoHole) { map.set(p.url, CLEAR); continue; }
    // 영상은 첫 장면(poster)으로 그린다. 영상 합성(video.ts)에서는 이 자리를 비워 둔다
    const file = p.kind === "video" ? p.poster ?? "" : p.url;
    // 갤러리 샘플 그림 (/samples/…jpg, 저장소에 들어 있는 추상 그림)
    if (/^\/samples\/[a-z0-9-]+\.jpg$/.test(file)) {
      const buf = await readFile(join(process.cwd(), "public", file)).catch(() => null);
      if (buf) map.set(p.url, `data:image/jpeg;base64,${buf.toString("base64")}`);
      continue;
    }
    if (UPLOAD_RE.test(file) && !file.endsWith(".mp4")) {
      const buf = await readFile(join(process.cwd(), "public", file)).catch(() => null);
      if (buf) map.set(p.url, `data:image/${file.endsWith(".png") ? "png" : "jpeg"};base64,${buf.toString("base64")}`);
    }
  }
  return (url: string) => map.get(url) ?? url;
}

/** n번째(0부터) 장 PNG */
/** videoHole: 영상 자리를 투명하게 비우고 바탕도 투명하게 (영상 합성의 맨 위 층) */
/** sub: 릴스 자막 번호 (없으면 첫 자막, -1 = 자막 없이) */
export async function renderSlide(templateId: string, theme: Theme, post: PostData, n: number, opts: { debug?: boolean; videoHole?: boolean; sub?: number } = {}) {
  const t = templateOf(templateId);
  const s = post.slides[n];
  const R = RENDERERS[t.id]?.[s.kind];
  const kind = t.kinds.find((k) => k.kind === s.kind);
  const size = sizeOf(t);
  const c: Ctx = { theme, post, debug: !!opts.debug, resolve: await resolver(post, !!opts.videoHole), size, sub: opts.sub ?? 0 };
  // 바탕: 장 종류가 정하거나(light), 장의 bg 고르기 값(light·paper·dark·accent)
  const bg = bgOf(theme, s.bg, kind?.light);
  const el = (
    <div style={{ width: size.w, height: size.h, display: "flex", position: "relative", background: opts.videoHole ? "transparent" : bg, fontFamily: "Brand" }}>
      {R ? R({ c, s, n: n + 1, total: post.slides.length }) : null}
    </div>
  );
  return new ImageResponse(el, {
    width: size.w,
    height: size.h,
    fonts: [
      { name: "Brand", data: await font(theme.font.regular), style: "normal", weight: 500 },
      { name: "Brand", data: await font(theme.font.bold), style: "normal", weight: 800 },
    ],
  });
}

/** 장 바탕색: bg 고르기 값 → 색 (종이 = 밝은 바탕을 살짝 눌러 회색 기운) */
export function bgOf(theme: Theme, v: unknown, light?: boolean) {
  if (v === "paper") return paperOf(theme.light);
  if (v === "light") return theme.light;
  if (v === "dark") return theme.dark;
  if (v === "accent") return theme.accent;
  return light ? theme.light : theme.dark;
}
export function paperOf(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const f = (x: number) => Math.round(x * 0.93).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}
