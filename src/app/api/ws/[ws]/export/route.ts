import { isAuthed, wsAccess } from "@/lib/auth";
import { readDb } from "@/lib/store";

// 서비스 하나를 JSON 으로 (백업·옮기기): 서비스 설정·브리프·기둥 + 게시물(보관함 포함) + 아이디어 + 자료. 올린 파일은 주소만
export async function GET(_req: Request, ctx: RouteContext<"/api/ws/[ws]/export">) {
  if (!(await isAuthed())) return new Response("로그인한 뒤 다시 해 주세요", { status: 401 });
  const { ws } = await ctx.params;
  if (!(await wsAccess(ws, "manage"))) return new Response("서비스 소유자만 JSON으로 내려받을 수 있어요", { status: 403 });
  const db = await readDb();
  const workspace = db.workspaces.find((w) => w.id === ws);
  if (!workspace) return new Response("서비스를 찾지 못했어요", { status: 404 });
  const out = { format: "card-studio/workspace", version: 1, exportedAt: new Date().toISOString(), workspace, posts: db.posts.filter((p) => p.workspace === ws), ideas: db.ideas.filter((i) => i.workspace === ws), research: db.research.filter((r) => r.workspace === ws) };
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // 한국 날짜
  return new Response(JSON.stringify(out, null, 1), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${ws}-${day}.json"`, "cache-control": "no-store" } });
}
