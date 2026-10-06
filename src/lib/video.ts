import "server-only";
import { createHash } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ffmpeg } from "./media";
import { OpError } from "./ops";
import { bgOf, renderSlide } from "./render";
import { photoH, photoY } from "./render/kit";
import { panelOf, subsOf } from "./render/reel";
import { VIDEO_DUR, formatOf, sizeOf, slideVideo } from "./fields";
import { templateOf } from "./templates";
import type { PostData, Theme } from "./types";

// 영상 장 합성: ① 바탕색 → ② 영상(칸 크기로 채워 자르기, 사진 위치 = 세로 자르기 위치) → ③ 카드 글 PNG(영상 자리·바탕 투명)
// 결과 1080×1350 H.264 yuv420p 30fps (+AAC, 소리 빼기 가능). 같은 입력이면 .cache/video 에서 다시 쓴다.

const CACHE = join(process.cwd(), ".cache", "video");

/** 장이 영상을 쓰면 그 영상 정보 */
export function videoOf(templateId: string, post: PostData, n: number) {
  const s = post.slides[n];
  const k = templateOf(templateId).kinds.find((x) => x.kind === s?.kind);
  if (!s || !k) return null;
  const v = slideVideo(k.fields, s, post.photos);
  if (!v) return null;
  const t = templateOf(templateId);
  const size = sizeOf(t);
  // 릴스: 위 판 아래 전부 / 사진 높이 조절이 있는 칸(설명 장)은 위쪽 상자 / 나머지는 장 전체
  const tall = k.fields.some((f) => f.type === "photo" && f.tune?.includes("h"));
  const reel = formatOf(t) === "reel";
  const panel = reel ? panelOf(s) : 0;
  const box = reel ? { x: 0, y: panel, w: size.w, h: size.h - panel } : { x: 0, y: 0, w: size.w, h: tall ? photoH(s) : size.h };
  const start = typeof s.videoStart === "number" ? s.videoStart : 0;
  const dur = typeof s.videoDur === "number" ? s.videoDur : Math.min(VIDEO_DUR.default, v.duration ?? VIDEO_DUR.default);
  // 자막: 영상 안 시각(초) 순서대로, 길이 안에 드는 것만
  const subs = reel ? subsOf(s).map((x, i) => ({ i, at: Number(x.at) || 0 })).filter((x) => x.at < dur) : [];
  return { video: v, box, size, y: photoY(s), start, dur, mute: s.videoMute === true, light: !!k.light, bg: s.bg, subs };
}

export async function renderVideo(templateId: string, theme: Theme, post: PostData, n: number): Promise<string> {
  const v = videoOf(templateId, post, n);
  if (!v) throw new OpError(`${n + 1}번째 장에는 영상이 없어요`);
  const key = createHash("sha1").update(JSON.stringify([templateId, theme, post.slides[n], post.photos, n, post.slides.length, v])).digest("hex").slice(0, 20);
  await mkdir(CACHE, { recursive: true });
  const out = join(CACHE, `${key}.mp4`);
  if (await stat(out).then((x) => x.size > 0).catch(() => false)) return out;

  // 글 층: 자막이 없으면 한 장, 있으면 자막마다 한 장 (첫 자막 전 구간은 자막 없이)
  const layers: { file: string; from: number; to: number }[] = [];
  const draw = async (name: string, sub: number) => {
    const file = join(CACHE, `${key}.${name}.png`);
    const img = await renderSlide(templateId, theme, post, n, { videoHole: true, sub });
    await writeFile(file, Buffer.from(await img.arrayBuffer()));
    return file;
  };
  if (!v.subs.length) layers.push({ file: await draw("all", -1), from: 0, to: v.dur });
  else {
    if (v.subs[0].at > 0) layers.push({ file: await draw("pre", -1), from: 0, to: v.subs[0].at });
    for (let j = 0; j < v.subs.length; j++) layers.push({ file: await draw(`s${j}`, v.subs[j].i), from: v.subs[j].at, to: v.subs[j + 1]?.at ?? v.dur });
  }
  const src = join(process.cwd(), "public", v.video.url);
  const base = bgOf(theme, v.bg, v.light).replace("#", "0x");
  const { w, h } = v.box;
  const tmp = join(CACHE, `${key}.part.mp4`);
  // [0] 영상 · [1] 바탕색 · [2..] 글 층 — 바탕 위 영상, 그 위에 글 층을 시간 구간마다
  let chain = `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-${w})/2:(ih-${h})*${v.y / 100},setsar=1,fps=30[v];[1:v][v]overlay=${v.box.x}:${v.box.y}:shortest=1[b0]`;
  layers.forEach((l, j) => {
    const en = layers.length > 1 ? `:enable='between(t,${l.from.toFixed(2)},${(j === layers.length - 1 ? v.dur + 1 : l.to - 0.001).toFixed(3)})'` : "";
    chain += `;[b${j}][${j + 2}:v]overlay=0:0${en}[b${j + 1}]`;
  });
  chain += `;[b${layers.length}]format=yuv420p[out]`;
  const args = [
    "-y", "-v", "error",
    "-ss", String(v.start), "-t", String(v.dur), "-i", src,
    "-f", "lavfi", "-i", `color=c=${base}:s=${v.size.w}x${v.size.h}:r=30:d=${v.dur}`,
    ...layers.flatMap((l) => ["-loop", "1", "-t", String(v.dur), "-i", l.file]),
    "-filter_complex", chain,
    "-map", "[out]",
    ...(v.mute ? ["-an"] : ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k", "-ar", "44100"]),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-profile:v", "high", "-r", "30",
    "-movflags", "+faststart", "-t", String(v.dur), tmp,
  ];
  const r = await ffmpeg(args);
  for (const l of layers) await rm(l.file, { force: true });
  if (r.code !== 0) { await rm(tmp, { force: true }); console.error(r.err); throw new OpError("영상을 만들지 못했어요"); }
  const { rename } = await import("node:fs/promises");
  await rename(tmp, out);
  return out;
}

/**
 * 캐러셀 → 릴스 MP4 (1080×1920): 장마다 secs 초(영상 장은 그 영상 길이), 4:5 카드를 가운데 두고 위아래는 바탕색.
 * 소리는 넣지 않는다 (인스타에서 음악을 고른다). 장 사이는 짧게 밝기 전환.
 */
export async function renderCarouselReel(templateId: string, theme: Theme, post: PostData, secs = 3): Promise<string> {
  const t = templateOf(templateId);
  if (formatOf(t) === "reel") throw new OpError("이미 릴스 템플릿이에요. 장 MP4 를 받아 주세요");
  const per = Math.min(10, Math.max(1.5, secs));
  const key = createHash("sha1").update(JSON.stringify(["carousel-reel", templateId, theme, post, per])).digest("hex").slice(0, 20);
  await mkdir(CACHE, { recursive: true });
  const out = join(CACHE, `${key}.reel.mp4`);
  if (await stat(out).then((x) => x.size > 0).catch(() => false)) return out;
  const base = theme.dark.replace("#", "0x");
  const parts: string[] = [];
  try {
    for (let i = 0; i < post.slides.length; i++) {
      const v = videoOf(templateId, post, i);
      const part = join(CACHE, `${key}.p${i}.mp4`);
      const src = v ? await renderVideo(templateId, theme, post, i) : join(CACHE, `${key}.p${i}.png`);
      if (!v) { const img = await renderSlide(templateId, theme, post, i); await writeFile(src, Buffer.from(await img.arrayBuffer())); }
      const d = v ? v.dur : per;
      const r = await ffmpeg([
        "-y", "-v", "error",
        ...(v ? ["-i", src] : ["-loop", "1", "-t", String(d), "-i", src]),
        "-f", "lavfi", "-i", `color=c=${base}:s=1080x1920:r=30:d=${d}`,
        "-filter_complex", `[0:v]scale=1080:1350,setsar=1,fps=30[c];[1:v][c]overlay=0:285:shortest=1,fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(0, d - 0.25)}:d=0.25,format=yuv420p[o]`,
        "-map", "[o]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", "30", "-t", String(d), part,
      ]);
      if (!v) await rm(src, { force: true });
      if (r.code !== 0) { console.error(r.err); throw new OpError(`${i + 1}번째 장을 영상으로 만들지 못했어요`); }
      parts.push(part);
    }
    const list = join(CACHE, `${key}.txt`);
    await writeFile(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
    const tmp = join(CACHE, `${key}.reel.part.mp4`);
    const r = await ffmpeg(["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", tmp]);
    await rm(list, { force: true });
    if (r.code !== 0) { console.error(r.err); throw new OpError("릴스를 이어 붙이지 못했어요"); }
    const { rename } = await import("node:fs/promises");
    await rename(tmp, out);
    return out;
  } finally {
    for (const p of parts) await rm(p, { force: true });
  }
}
