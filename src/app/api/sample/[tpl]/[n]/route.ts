import { readFile } from "node:fs/promises";
import { getActor, isAuthed, roleIn } from "@/lib/auth";
import { listWorkspaces } from "@/lib/store";
import { templateOf } from "@/lib/templates";
import { renderSlide } from "@/lib/render";
import { renderVideo, videoOf } from "@/lib/video";
import { DEFAULT_THEME, NEUTRAL_ACCENT, OpError } from "@/lib/ops";

// 템플릿 갤러리 샘플: ?ws= 서비스 테마로 그린다(없으면 첫 서비스, 그것도 없으면 기본 테마). ?video=1 이면 영상 장 MP4
export async function GET(req: Request, ctx: RouteContext<"/api/sample/[tpl]/[n]">) {
  if (!(await isAuthed())) return new Response("로그인한 뒤 다시 해 주세요", { status: 401 });
  const { tpl, n } = await ctx.params;
  const t = templateOf(tpl);
  const post = t.id === tpl && t.sample ? t.sample() : null;
  const i = Number(n) - 1;
  if (!post || !Number.isInteger(i) || i < 0 || i >= post.slides.length) return new Response("샘플을 찾지 못했어요", { status: 404 });
  const q = new URL(req.url).searchParams;
  const actor = (await getActor())!;
  const mine = (await listWorkspaces()).filter((x) => roleIn(actor, x));
  // 서비스를 고르면 그 테마, 아니면 흑백 기본 테마
  const w = mine.find((x) => x.id === q.get("ws"));
  const theme = w?.theme ?? DEFAULT_THEME("STUDIO", NEUTRAL_ACCENT);
  if (q.get("video") === "1") {
    if (!videoOf(t.id, post, i)) return new Response("영상 장이 아니에요", { status: 404 });
    try { return new Response(new Uint8Array(await readFile(await renderVideo(t.id, theme, post, i))), { headers: { "content-type": "video/mp4", "cache-control": "private, max-age=600" } }); }
    catch (e) { return new Response(e instanceof OpError ? e.message : "영상을 만들지 못했어요. 잠시 뒤 다시 해 주세요", { status: 422 }); }
  }
  const img = await renderSlide(t.id, theme, post, i);
  return new Response(img.body, { headers: { "content-type": "image/png", "cache-control": "private, max-age=600" } });
}
