import "server-only";
import { readFile } from "node:fs/promises";
import { renderSlide } from "./render";
import { renderVideo, videoOf } from "./video";
import type { Post, Workspace } from "./types";

/** 캡션 + 사진 출처 (복사·내보내기 같은 글) */
export function fullCaption(p: Post) {
  const d = p.data;
  if (!d) return "";
  const credits = d.photos.filter((x) => x.credit).map((x) => `${x.credit}${x.source ? ` (${x.source})` : ""}`);
  return d.caption + (credits.length ? `\n\n사진: ${credits.join(", ")}` : "");
}

export const slideName = (w: Workspace, p: Post, i: number, ext: string) => `${w.id}-D${p.day}-${p.slot.replace(":", "")}-${String(i + 1).padStart(2, "0")}.${ext}`;

/** 저장된 게시물의 장 하나 → PNG 또는 MP4 */
export async function slideFile(w: Workspace, p: Post, i: number): Promise<{ name: string; type: string; data: Buffer }> {
  const d = p.data!;
  if (videoOf(p.template, d, i)) return { name: slideName(w, p, i, "mp4"), type: "video/mp4", data: await readFile(await renderVideo(p.template, w.theme, d, i)) };
  const img = await renderSlide(p.template, w.theme, d, i);
  return { name: slideName(w, p, i, "png"), type: "image/png", data: Buffer.from(await img.arrayBuffer()) };
}
