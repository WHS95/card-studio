import { wsAccess } from "@/lib/auth";
import { countVideo, OpError } from "@/lib/ops";
import { extendable, getVeoJob, startVeo, type VeoInput } from "@/lib/veo";

// AI 영상(Veo): POST 로 시작(작업 번호), GET ?job= 으로 상태. 편집 권한 + 요금제의 한 달 영상 수
export async function POST(req: Request, ctx: RouteContext<"/api/veo/[ws]">) {
  const { ws } = await ctx.params;
  const a = await wsAccess(ws, "edit");
  if (!a) return Response.json({ error: "권한이 없어요" }, { status: 403 });
  const input = (await req.json().catch(() => null)) as VeoInput | null;
  if (!input) return Response.json({ error: "형식이 맞지 않아요" }, { status: 400 });
  try {
    await countVideo(ws, a.actor.kind === "admin", true); // 한도만 먼저 확인
    const job = await startVeo(ws, input);
    await countVideo(ws, true); // 시작이 받아들여진 것만 센다
    return Response.json({ job: job.id, message: job.message });
  } catch (e) {
    if (e instanceof OpError) return Response.json({ error: e.message }, { status: 422 });
    console.error(e);
    return Response.json({ error: "영상을 시작하지 못했어요" }, { status: 500 });
  }
}

export async function GET(req: Request, ctx: RouteContext<"/api/veo/[ws]">) {
  const { ws } = await ctx.params;
  if (!(await wsAccess(ws, "edit"))) return Response.json({ error: "권한이 없어요" }, { status: 403 });
  const q = new URL(req.url).searchParams;
  // ?extendable=주소,주소 → 그중 '이어 붙이기'가 되는 Veo 영상 (만든 지 2일 안)
  if (q.has("extendable")) return Response.json({ urls: await extendable((q.get("extendable") ?? "").split(",").filter((u) => u.startsWith(`/uploads/${ws}/`))) });
  const j = getVeoJob(new URL(req.url).searchParams.get("job") ?? "", ws);
  if (!j) return Response.json({ error: "작업을 찾지 못했어요 (서버를 다시 띄우면 사라져요)" }, { status: 404 });
  return Response.json({ status: j.status, message: j.message, photo: j.photo ?? null });
}
