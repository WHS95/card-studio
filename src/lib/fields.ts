import type { Photo, PostData, SlideData } from "./types";

// 칸 정의 하나로 검사·편집 화면·최대 길이 테스트를 모두 만든다 (템플릿 추가 = 칸 정의 + 렌더러).

/** rich: **굵게** · ==강조== 표시를 쓸 수 있는 칸 (글자 수는 표시 기호까지 센다) */
export type TextField = { key: string; label: string; type: "text"; max: number; lines?: number; hint?: string; optional?: boolean; rich?: boolean };
export type PhotoField = { key: string; label: string; type: "photo"; tune?: ("h" | "y")[]; video?: boolean };
export type ToggleField = { key: string; label: string; type: "toggle" };
/** 고르기 (배치·정렬·크기 같은 조절). 값이 없으면 default */
export type ChoiceField = { key: string; label: string; type: "choice"; options: { v: string; label: string }[]; default: string };
/** 숫자 (자막 시작 초 등) */
export type NumberField = { key: string; label: string; type: "number"; min: number; max: number; step: number; unit?: string };
export type ItemsField = { key: string; label: string; type: "items"; min: number; max: number; item: (TextField | PhotoField | ToggleField | ChoiceField | NumberField)[] };
export type Field = TextField | PhotoField | ToggleField | ChoiceField | NumberField | ItemsField;

export type SlideKind = {
  kind: string;
  label: string;
  fields: Field[];
  light?: boolean; // 밝은 바탕 장
  fixed?: boolean; // 빼거나 옮길 수 없음 (표지)
  blank: () => SlideData; // 새로 더할 때 기본값
};

/** 판 크기: 피드 캐러셀 4:5 · 릴스 9:16 */
export const SIZES = { feed: { w: 1080, h: 1350 }, reel: { w: 1080, h: 1920 } } as const;
export type Format = keyof typeof SIZES;

export type Template = {
  id: string;
  name: string;
  description: string;
  format?: Format; // 없으면 feed
  group?: string; // 갤러리 묶음 (카드뉴스 · 영상)
  inspired?: string; // 어떤 인기 형태를 본떴는지 (갤러리 설명)
  videoMax?: number; // 영상 장 최대 길이 (없으면 VIDEO_DUR.max)
  kinds: SlideKind[];
  maxSlides: number;
  /** 기획(제목·카테고리)으로 첫 초안 */
  draft: (seed: { title: string; category: string; handle: string }) => PostData;
  /** 갤러리 샘플 (사진은 /samples/ 추상 그림만 — 실제 장소·브랜드 사진 아님) */
  sample?: () => PostData;
};
export const formatOf = (t: Template): Format => t.format ?? "feed";
export const sizeOf = (t: Template) => SIZES[formatOf(t)];
/** 고르기 칸 값 (없거나 모르는 값이면 default) */
export function choice(s: Record<string, unknown>, f: ChoiceField | undefined, fallback = ""): string {
  if (!f) return fallback;
  const v = s[f.key];
  return typeof v === "string" && f.options.some((o) => o.v === v) ? v : f.default;
}

export const PHOTO_H = { min: 20, max: 80, default: 41 } as const;
/** 인스타 캐러셀 영상 한 장: 3~60초 */
export const VIDEO_DUR = { min: 3, max: 60, default: 15 } as const;
export const UPLOAD_RE = /^\/uploads\/[a-z0-9-]+\/[a-f0-9]+\.(jpg|png|mp4)$/;
/** 갤러리 샘플 그림·영상 (저장소 public/samples, 추상 그림) — 샘플로 시작한 게시물에서 바꿔 끼우라고 둔다 */
export const SAMPLE_RE = /^\/samples\/[a-z0-9-]+\.(jpg|mp4)$/;
export const isVideo = (p: Photo | undefined) => p?.kind === "video";
/** 장이 쓰는 영상 (장 사진 칸 중 영상인 첫 번째) */
export function slideVideo(fields: Field[], s: SlideData, photos: Photo[]): Photo | null {
  for (const f of fields) if (f.type === "photo" && typeof s[f.key] === "number" && isVideo(photos[s[f.key] as number])) return photos[s[f.key] as number];
  return null;
}
export const CAPTION_MAX = 2200;
export const PHOTOS_MAX = 10;

const lineCount = (s: string) => s.split("\n").length;

function checkField(f: Field, v: unknown, photos: Photo[], path: string) {
  if (f.type === "text") {
    if (typeof v !== "string") throw new Error(`${path}${f.label} 형식이 맞지 않아요`);
    if (!f.optional && !v.trim()) throw new Error(`${path}${f.label} 칸을 채워 주세요`);
    if (v.length > f.max) throw new Error(`${path}${f.label} 칸은 ${f.max}자까지예요`);
    if (lineCount(v) > (f.lines ?? 1)) throw new Error(`${path}${f.label} 칸은 ${f.lines ?? 1}줄까지예요`);
  } else if (f.type === "photo") {
    if (v !== null && v !== undefined && (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= photos.length)) throw new Error(`${path}${f.label} 사진 번호가 맞지 않아요`);
    if (typeof v === "number" && isVideo(photos[v]) && !f.video) throw new Error(`${path}${f.label} 칸에는 영상을 넣을 수 없어요`);
  } else if (f.type === "toggle") {
    if (v !== undefined && typeof v !== "boolean") throw new Error(`${path}${f.label} 형식이 맞지 않아요`);
  } else if (f.type === "choice") {
    if (v !== undefined && !f.options.some((o) => o.v === v)) throw new Error(`${path}${f.label} 값이 맞지 않아요 (${f.options.map((o) => o.v).join("|")})`);
  } else if (f.type === "number") {
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v) || v < f.min || v > f.max)) throw new Error(`${path}${f.label} 값은 ${f.min}~${f.max} 사이로 넣어 주세요`);
  } else {
    if (!Array.isArray(v) || v.length < f.min || v.length > f.max) throw new Error(`${path}${f.label} 칸은 ${f.min}~${f.max}개예요`);
    v.forEach((it, i) => { for (const sub of f.item) checkField(sub, (it as Record<string, unknown>)?.[sub.key], photos, `${path}${f.label} ${i + 1}의 `); });
  }
}

const pct = (v: unknown, lo: number, hi: number, name: string) => { if (v !== undefined && (typeof v !== "number" || v < lo || v > hi)) throw new Error(`${name} 값은 ${lo}~${hi} 사이로 넣어 주세요`); };

/** 템플릿 기준 검사. 틀리면 이유, 맞으면 null */
export function validatePost(t: Template, p: unknown): string | null {
  if (!p || typeof p !== "object") return "형식이 맞지 않아요";
  const post = p as PostData;
  if (!Array.isArray(post.slides) || post.slides.length < 1 || post.slides.length > t.maxSlides) return `장은 1~${t.maxSlides}장까지 만들 수 있어요`;
  if (post.slides[0]?.kind !== t.kinds[0].kind) return "첫 장에는 표지를 둬 주세요";
  if (typeof post.caption !== "string" || post.caption.length > CAPTION_MAX) return `캡션은 ${CAPTION_MAX}자까지예요`;
  if (!Array.isArray(post.photos) || post.photos.length > PHOTOS_MAX) return `사진은 ${PHOTOS_MAX}장까지예요`;
  for (const ph of post.photos) {
    if (!ph || typeof ph.url !== "string" || typeof ph.credit !== "string" || typeof ph.source !== "string") return "사진 형식이 맞지 않아요";
    if (ph.kind === "video") {
      const ok = (u: unknown) => typeof u === "string" && (UPLOAD_RE.test(u) || SAMPLE_RE.test(u));
      if (!ok(ph.url) || !ph.url.endsWith(".mp4") || !ok(ph.poster) || typeof ph.duration !== "number") return "영상은 직접 올린 것만 쓸 수 있어요";
    } else if (!(/^https:\/\/[^\s"'<>]+$/.test(ph.url) || ((UPLOAD_RE.test(ph.url) || SAMPLE_RE.test(ph.url)) && !ph.url.endsWith(".mp4")))) return "사진 주소가 맞지 않아요. https:// 주소나 직접 올린 파일을 넣어 주세요";
  }
  try {
    post.slides.forEach((s, i) => {
      const k = t.kinds.find((x) => x.kind === s.kind);
      if (!k) throw new Error(`${i + 1}번째 장 종류가 이 템플릿에 없어요`);
      if (k.fixed && i !== 0) throw new Error(`'${k.label}' 장은 첫 장에만 둘 수 있어요`);
      for (const f of k.fields) checkField(f, s[f.key], post.photos, `${i + 1}번째 장 `);
      pct(s.photoH, PHOTO_H.min, PHOTO_H.max, "사진 높이");
      pct(s.photoY, 0, 100, "사진 위치");
      const vid = slideVideo(k.fields, s, post.photos);
      if (vid) {
        const start = typeof s.videoStart === "number" ? s.videoStart : 0;
        const dur = typeof s.videoDur === "number" ? s.videoDur : Math.min(VIDEO_DUR.default, vid.duration ?? VIDEO_DUR.default);
        if (start < 0 || !Number.isFinite(start)) throw new Error(`${i + 1}번째 장 영상 시작이 맞지 않아요`);
        const dmax = t.videoMax ?? VIDEO_DUR.max;
        if (dur < VIDEO_DUR.min || dur > dmax) throw new Error(`${i + 1}번째 장 영상 길이는 ${VIDEO_DUR.min}~${dmax}초예요`);
        if (start + dur > (vid.duration ?? 0) + 0.05) throw new Error(`${i + 1}번째 장 영상은 ${Math.floor(vid.duration ?? 0)}초까지예요. 시작과 길이를 더해 그 안으로 맞춰 주세요`);
        if (s.videoMute !== undefined && typeof s.videoMute !== "boolean") throw new Error(`${i + 1}번째 장 소리 설정이 맞지 않아요`);
      }
    });
  } catch (e) {
    return (e as Error).message;
  }
  return null;
}

export const FIXTURE_VARIANTS = ["space", "nospace", "lines", "chips"] as const;
export type FixtureVariant = (typeof FIXTURE_VARIANTS)[number];

/** 안전 영역 검사용: 모든 칸을 최대로 (space: 띄어쓰기 있는 한글 / nospace: 넓은 영문 / lines: 줄바꿈까지 / chips: 쉼표로 나눈 짧은 낱말 6개 + 켜기) */
export function fixturePost(t: Template, variant: FixtureVariant): PostData {
  const fill = (s: string, n: number) => s.repeat(Math.ceil(n / s.length)).slice(0, n);
  const text = (f: TextField) => {
    const t1 = (n: number) => (variant === "nospace" ? fill("W", n) : fill("가나다라마 바사아자 ", n));
    const lines = f.lines ?? 1;
    if (variant === "chips") { const per = Math.max(1, Math.floor((f.max - 10) / 6)); return Array.from({ length: 6 }, () => fill("가나다라마바사아자", per)).join(", ").slice(0, f.max); }
    if (variant !== "lines" || lines < 2) return t1(f.max);
    const per = Math.floor((f.max - (lines - 1)) / lines);
    return Array.from({ length: lines }, () => t1(per)).join("\n");
  };
  // 고르기 칸은 경우마다 다른 값을 돌아가며 (모든 배치가 한 번씩은 검사되게)
  const vi = FIXTURE_VARIANTS.indexOf(variant);
  const fillFields = (fields: Field[]): Record<string, unknown> => Object.fromEntries(fields.map((f) => [f.key,
    f.type === "text" ? text(f) : f.type === "photo" ? 0 : f.type === "toggle" ? variant === "space" || variant === "chips"
      : f.type === "choice" ? f.options[vi % f.options.length].v : f.type === "number" ? f.min : Array.from({ length: f.max }, () => fillFields(f.item)),
  ]));
  // 사진 칸은 0번(실제로는 없음): 그리지는 않지만 사진 자리를 잡는 배치까지 검사된다. chips 는 사진 높이 최대로
  return { photos: [], caption: "", slides: t.kinds.map((k) => ({ kind: k.kind, ...fillFields(k.fields), ...(variant === "chips" ? { photoH: PHOTO_H.max } : {}) })) };
}
