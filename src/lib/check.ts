import "server-only";
import { decodePng } from "./png";
import { renderSlide } from "./render";
import { SAFE } from "./render/kit";
import type { PostData, Theme } from "./types";
import { formatOf } from "./fields";
import { templateOf } from "./templates";

// 인스타 마진 계산: 사진·영상을 빼고(바탕이 한 색) 그린 뒤, 안전 영역 밖에서 바탕색과 다른 픽셀을 센다.
//  · 표지 = 프로필 그리드(3:4) 기준 (175,175)~(905,1175) · 안쪽 장 = (60,175)~(1020,1175)
//  · 참고: 3:4 그리드는 실제로 좌우 약 34px씩 잘린다 — 표지 영역은 그보다 훨씬 넉넉하게 잡은 값이다.
export type SlideCheck = { n: number; zone: "cover" | "feed" | "reel"; outside: number; ok: boolean };

export async function checkPost(templateId: string, theme: Theme, post: PostData): Promise<SlideCheck[]> {
  const out: SlideCheck[] = [];
  for (let i = 0; i < post.slides.length; i++) {
    const img = await renderSlide(templateId, theme, post, i, { debug: true });
    const { w, h, ch, px } = decodePng(Buffer.from(await img.arrayBuffer()));
    const zone = formatOf(templateOf(templateId)) === "reel" ? "reel" : i === 0 ? "cover" : "feed";
    const [x0, y0, x1, y1] = SAFE[zone];
    const at = (x: number, y: number) => (y * w + x) * ch;
    const bg = at(2, 2);
    let bad = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if (x >= x0 && x < x1 && y >= y0 && y < y1) continue;
      const p = at(x, y);
      if (Math.max(Math.abs(px[p] - px[bg]), Math.abs(px[p + 1] - px[bg + 1]), Math.abs(px[p + 2] - px[bg + 2])) > 24) bad++;
    }
    out.push({ n: i + 1, zone, outside: bad, ok: bad === 0 });
  }
  return out;
}
