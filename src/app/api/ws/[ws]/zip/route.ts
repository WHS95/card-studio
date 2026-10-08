import { wsAccess } from "@/lib/auth";
import { getPost } from "@/lib/store";
import { fullCaption, slideFile } from "@/lib/exporter";
import { zip } from "@/lib/zip";

// 5 제작 목록에서 고른 게시물들을 ZIP 하나로: 게시물마다 폴더(D3-1230-제목/) 안에 장(PNG·MP4) + caption.txt. ?ids=a,b,c (30개까지)
export async function GET(req: Request, ctx: RouteContext<"/api/ws/[ws]/zip">) {
  const { ws } = await ctx.params;
  const a = await wsAccess(ws, "view");
  if (!a) return new Response("로그인한 뒤 다시 해 주세요", { status: 401 });
  const ids = [...new Set((new URL(req.url).searchParams.get("ids") ?? "").split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 30);
  const files: { name: string; data: Buffer }[] = [];
  for (const id of ids) {
    const p = await getPost(id);
    if (!p?.data || p.workspace !== a.ws.id || p.archivedAt) continue;
    const dir = `D${p.day}-${p.slot.replace(":", "")}-${(p.title || "제목없음").replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40)}`;
    for (let i = 0; i < p.data.slides.length; i++) { const f = await slideFile(a.ws, p, i); files.push({ name: `${dir}/${f.name}`, data: f.data }); }
    files.push({ name: `${dir}/caption.txt`, data: Buffer.from(fullCaption(p), "utf8") });
  }
  if (!files.length) return new Response("고른 게시물에 내용이 없어요. 글을 채운 게시물을 골라 주세요", { status: 404 });
  const name = `${a.ws.id}-${ids.length}posts.zip`;
  return new Response(new Uint8Array(zip(files)), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store" } });
}
