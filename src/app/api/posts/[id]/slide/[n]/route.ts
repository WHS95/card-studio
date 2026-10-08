import { isAuthed, wsAccess } from "@/lib/auth";
import { getPost } from "@/lib/store";
import { slideFile } from "@/lib/exporter";
import { renderSlide } from "@/lib/render";
import { OpError } from "@/lib/ops";

// 저장된 게시물 한 장 (1부터): 영상 장이면 MP4, 아니면 PNG. ?download=1 내려받기, ?png=1 영상 장도 첫 장면 PNG(그리드 미리보기)
export async function GET(req: Request, ctx: RouteContext<"/api/posts/[id]/slide/[n]">) {
  if (!(await isAuthed())) return new Response("로그인한 뒤 다시 해 주세요", { status: 401 });
  const { id, n } = await ctx.params;
  const p = await getPost(id);
  // 그 서비스를 볼 수 있는 사람만
  const w = p && (await wsAccess(p.workspace, "view"))?.ws;
  const i = Number(n) - 1;
  if (!p?.data || !w || !Number.isInteger(i) || i < 0 || i >= p.data.slides.length) return new Response("이 장을 찾지 못했어요. 편집기를 새로 고친 뒤 다시 해 주세요", { status: 404 });
  if (new URL(req.url).searchParams.get("png") === "1") {
    const img = await renderSlide(p.template, w.theme, p.data, i);
    return new Response(img.body, { headers: { "content-type": "image/png", "cache-control": "private, max-age=60" } });
  }
  try {
    const f = await slideFile(w, p, i);
    const headers = new Headers({ "content-type": f.type, "cache-control": "private, no-store" });
    if (new URL(req.url).searchParams.get("download") === "1") headers.set("content-disposition", `attachment; filename="${f.name}"`);
    return new Response(new Uint8Array(f.data), { headers });
  } catch (e) { return new Response(e instanceof OpError ? e.message : "이 장을 만들지 못했어요. 잠시 뒤 다시 해 주세요", { status: 422 }); }
}
