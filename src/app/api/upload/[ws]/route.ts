import { isAuthed, wsAccess } from "@/lib/auth";
import { saveUpload } from "@/lib/media";
import { OpError } from "@/lib/ops";

// 직접 올리기: 파일 본문을 그대로 PUT (server action 1MB 제한을 피해 디스크로 흘려 쓴다). 사진 8MB·영상 300MB
export async function PUT(req: Request, ctx: RouteContext<"/api/upload/[ws]">) {
  if (!(await isAuthed())) return Response.json({ error: "로그인이 필요해요" }, { status: 401 });
  const { ws } = await ctx.params;
  if (!(await wsAccess(ws, "edit")) || !req.body) return Response.json({ error: "서비스를 찾지 못했거나 올릴 권한이 없어요" }, { status: 404 });
  try {
    return Response.json({ photo: await saveUpload(ws, req.body) });
  } catch (e) {
    if (e instanceof OpError) return Response.json({ error: e.message }, { status: 422 });
    console.error(e);
    return Response.json({ error: "올리지 못했어요" }, { status: 500 });
  }
}
