import { readFile } from "node:fs/promises";
import { isAuthed, wsAccess } from "@/lib/auth";
import { getPost } from "@/lib/store";
import { renderCarouselReel } from "@/lib/video";
import { OpError } from "@/lib/ops";

// 저장된 캐러셀 → 릴스 MP4 (?secs=장마다 초, 기본 3). 오래 걸릴 수 있다 (장 수 × 몇 초)
export async function GET(req: Request, ctx: RouteContext<"/api/posts/[id]/reel">) {
  if (!(await isAuthed())) return new Response("로그인한 뒤 다시 해 주세요", { status: 401 });
  const { id } = await ctx.params;
  const p = await getPost(id);
  // 그 서비스를 볼 수 있는 사람만
  const w = p && (await wsAccess(p.workspace, "view"))?.ws;
  if (!p || !w || !p.data) return new Response("게시물을 찾지 못했거나 아직 글이 없어요. 글을 채워 저장한 뒤 다시 해 주세요", { status: 404 });
  const secs = Number(new URL(req.url).searchParams.get("secs") ?? 3) || 3;
  try {
    const file = await renderCarouselReel(p.template, w.theme, p.data, secs);
    const name = `${w.id}-D${p.day}-${p.slot.replace(":", "")}-reel.mp4`;
    return new Response(new Uint8Array(await readFile(file)), { headers: { "content-type": "video/mp4", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store" } });
  } catch (e) { return new Response(e instanceof OpError ? e.message : "릴스를 만들지 못했어요. 잠시 뒤 다시 해 주세요", { status: 422 }); }
}
