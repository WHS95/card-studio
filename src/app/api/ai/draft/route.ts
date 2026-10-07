import { wsAccess } from "@/lib/auth";
import { getPost } from "@/lib/store";
import { countAi, OpError } from "@/lib/ops";
import { countsAgainstPlan } from "@/lib/llm";
import { draftPostStream, type DraftEvent } from "@/lib/ai";
import type { PostData } from "@/lib/types";

// 편집기 AI 초안 — 장마다 써지는 모습을 흘려 보낸다 (NDJSON: 한 줄에 이벤트 하나, ai.ts DraftEvent).
// 저장하지 않는다: 편집기가 받아서 '저장 안 됨'으로 넣고, 사람이 확인한 뒤 저장한다. 연결을 끊으면(멈추기) AI 도 멈춘다.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { post?: string; template?: string; title?: string; category?: string; current?: PostData | null; extra?: string } | null;
  const post = b?.post ? await getPost(String(b.post)) : null;
  if (!b || !post) return new Response("bad", { status: 400 });
  const a = await wsAccess(post.workspace, "edit");
  if (!a) return new Response("이 일은 권한이 없어요", { status: 403 });
  try { if (await countsAgainstPlan("write", a.actor)) await countAi(a.ws.id, a.actor.kind === "admin"); }
  catch (e) { return new Response(e instanceof OpError ? e.message : "잠시 뒤 다시 해 주세요", { status: 429 }); }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctl) {
      const send = (e: DraftEvent) => { try { ctl.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch {} };
      try {
        await draftPostStream(a.ws, { template: String(b.template ?? post.template), title: String(b.title ?? post.title), category: String(b.category ?? post.category), note: post.note, current: b.current ?? null },
          String(b.extra ?? "").slice(0, 500), a.actor, send, req.signal);
      } catch (e) {
        send({ t: "error", message: e instanceof OpError ? e.message : (console.error(e), "AI 초안을 쓰지 못했어요. 잠시 뒤 다시 해 주세요") });
      }
      try { ctl.close(); } catch {}
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
