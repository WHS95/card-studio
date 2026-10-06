import { isAuthed, wsAccess } from "@/lib/auth";
import { getPost } from "@/lib/store";
import { fullCaption, slideFile } from "@/lib/exporter";
import { zip } from "@/lib/zip";

// 저장된 게시물 전체: 장(PNG·MP4) + caption.txt 를 ZIP 하나로
export async function GET(_req: Request, ctx: RouteContext<"/api/posts/[id]/zip">) {
  if (!(await isAuthed())) return new Response("로그인이 필요해요", { status: 401 });
  const { id } = await ctx.params;
  const p = await getPost(id);
  // 그 서비스를 볼 수 있는 사람만
  const w = p && (await wsAccess(p.workspace, "view"))?.ws;
  if (!p?.data || !w) return new Response("없어요", { status: 404 });
  const files = [];
  for (let i = 0; i < p.data.slides.length; i++) { const f = await slideFile(w, p, i); files.push({ name: f.name, data: f.data }); }
  files.push({ name: "caption.txt", data: Buffer.from(fullCaption(p), "utf8") });
  const name = `${w.id}-D${p.day}-${p.slot.replace(":", "")}.zip`;
  return new Response(new Uint8Array(zip(files)), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store" } });
}
