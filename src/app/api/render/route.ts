import { readFile } from "node:fs/promises";
import { isAuthed, wsAccess } from "@/lib/auth";
import { templateOf } from "@/lib/templates";
import { validatePost } from "@/lib/fields";
import { renderSlide } from "@/lib/render";
import { renderVideo } from "@/lib/video";
import { checkPost } from "@/lib/check";
import { OpError } from "@/lib/ops";
import type { PostData } from "@/lib/types";

// 편집기 미리보기 (저장 전 데이터). body = { ws, template, data, n(0부터), mode: png(기본) | video | check }
export async function POST(req: Request) {
  if (!(await isAuthed())) return new Response("로그인한 뒤 다시 해 주세요", { status: 401 });
  const b = (await req.json().catch(() => null)) as { ws: string; template: string; data: PostData; n?: number; mode?: string } | null;
  const w = b && typeof b.ws === "string" ? (await wsAccess(b.ws, "view"))?.ws : null;
  if (!b || !w) return new Response("요청 형식이 맞지 않아요. 화면을 새로 고친 뒤 다시 해 주세요", { status: 400 });
  const t = templateOf(b.template);
  const err = validatePost(t, b.data);
  if (err) return new Response(err, { status: 422 });
  if (b.mode === "check") return Response.json({ slides: await checkPost(t.id, w.theme, b.data) });
  const n = b.n ?? 0;
  if (!Number.isInteger(n) || n < 0 || n >= b.data.slides.length) return new Response("요청 형식이 맞지 않아요. 화면을 새로 고친 뒤 다시 해 주세요", { status: 400 });
  if (b.mode === "video") {
    try { return new Response(new Uint8Array(await readFile(await renderVideo(t.id, w.theme, b.data, n))), { headers: { "content-type": "video/mp4", "cache-control": "private, no-store" } }); }
    catch (e) { return new Response(e instanceof OpError ? e.message : "영상을 만들지 못했어요. 잠시 뒤 다시 해 주세요", { status: 422 }); }
  }
  const img = await renderSlide(t.id, w.theme, b.data, n);
  return new Response(img.body, { headers: { "content-type": "image/png", "cache-control": "private, no-store" } });
}
