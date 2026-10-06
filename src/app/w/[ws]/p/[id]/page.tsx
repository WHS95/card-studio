import { notFound } from "next/navigation";
import { can, requireWs } from "@/lib/auth";
import { getPost, listPosts } from "@/lib/store";
import { postToolAction } from "../../../../actions";
import MetricsForm from "./MetricsForm";
import Top from "../../../../Top";
import Editor from "./Editor";
import { aiEnabled } from "@/lib/ai";
import { veoEnabled } from "@/lib/veo";

/** 게시물 편집기: 칸 정의(템플릿)로 화면을 만든다 */
export default async function PostPage({ params, searchParams }: PageProps<"/w/[ws]/p/[id]">) {
  const { ws, id } = await params;
  const { ws: w, role } = await requireWs(ws, "view");
  const p = await getPost(id);
  if (!p || p.workspace !== w.id) notFound();
  const { error } = await searchParams;
  const taken = new Set((await listPosts(w.id)).map((x) => `${x.day} ${x.slot}`));
  const empty: string[] = [];
  for (let d = 1; d <= w.days && empty.length < 60; d++) for (const s of w.slots) if (!taken.has(`${d} ${s}`) && empty.length < 60) empty.push(`${d} ${s}`);
  const spots = <select name="spot" className="input" style={{ width: "auto" }} aria-label="칸"><option value="">비어 있는 첫 칸</option>{empty.map((e) => { const [d, s] = e.split(" "); return <option key={e} value={e}>D{d} {s}</option>; })}</select>;
  const hidden = <><input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={p.id} /></>;
  return (
    <>
      <Top ws={w} tab="post" />
      <main className="wrap">
        {typeof error === "string" && <p className="err">{error}</p>}
        {p.archivedAt && <p className="hint">보관함에 있는 게시물이에요. <a href={`/w/${w.id}?view=archive`}>보관함에서 되살리기 →</a></p>}
        <Editor key={p.id} ws={{ id: w.id, handle: w.handle, categories: w.categories, slots: w.slots, startDate: w.startDate, hashtags: w.brief?.hashtags ?? [], cta: w.brief?.cta ?? "", ai: aiEnabled(), veo: veoEnabled(), canEdit: can(role, "edit"), canApprove: can(role, "approve") }} post={p} />
        {p.status === "posted" && <MetricsForm id={p.id} m={p.metrics} />}
        {!p.archivedAt && (
          <details className="block">
            <summary className="small" style={{ fontWeight: 700, cursor: "pointer" }}>게시물 관리 · 옮기기 · 복제 · 보관함</summary>
            <div className="panel" style={{ marginTop: 10 }}>
              <form action={postToolAction} className="row">{hidden}<input type="hidden" name="op" value="move" />{spots}<button className="btn" disabled={!empty.length}>이 칸으로 옮기기</button></form>
              <form action={postToolAction} className="row">{hidden}<input type="hidden" name="op" value="duplicate" />{spots}<button className="btn" disabled={!empty.length}>복제해서 새 초안</button></form>
              {p.status !== "posted" && <form action={postToolAction} className="row">{hidden}<input type="hidden" name="op" value="archive" /><button className="btn">보관함으로 빼기</button><span className="small muted">칸이 비고, 보관함에서 되살릴 수 있어요 (지우지는 않아요)</span></form>}
              <p className="small muted" style={{ margin: 0 }}>저장 안 된 고침은 옮기기·복제에 들어가지 않아요. 먼저 저장해 주세요.</p>
            </div>
          </details>
        )}
      </main>
    </>
  );
}
