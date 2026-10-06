import Link from "next/link";
import { can, requireWs } from "@/lib/auth";
import { listIdeas, listPosts, listResearch } from "@/lib/store";
import { TEMPLATES, templateOf } from "@/lib/templates";
import { IDEA_LABEL, IDEA_STATUS, STATUS_LABEL, type IdeaStatus } from "@/lib/types";
import { aiEnabled } from "@/lib/ai";
import { createIdeaAction, scheduleIdeaAction, scheduleIdeasAction, updateIdeaAction } from "../../../actions";
import { ServiceShell } from "../../../ui/Shell";
import BatchSchedule from "./BatchSchedule";
import AiIdeas from "./AiIdeas";
import AskAi from "../../../AskAi";

/** 3단계 주제: 누가 냈든 검수 대기 → 소유자·검수자가 승인 → 승인한 것만 달력에 (여러 개를 고른 순서대로) */
export default async function Ideas({ params, searchParams }: PageProps<"/w/[ws]/ideas">) {
  const { ws } = await params;
  const q = await searchParams;
  const { ws: w, actor, role } = await requireWs(ws, "view");
  const [ideas, research, posts] = await Promise.all([listIdeas(w.id), listResearch(w.id), listPosts(w.id)]);
  const pillars = w.pillars ?? [];
  const n = (st: IdeaStatus) => ideas.filter((i) => i.status === st).length;
  const status = q.s === "all" ? null : IDEA_STATUS.includes(q.s as IdeaStatus) ? (q.s as IdeaStatus) : n("review") ? "review" : n("approved") ? "approved" : null;
  const canApprove = can(role, "approve"), canEdit = can(role, "edit");
  const pillar = typeof q.pillar === "string" ? q.pillar : null;
  const shown = ideas.filter((i) => (!status || i.status === status) && (pillar === null || i.pillar === pillar));
  const postOf = new Map(posts.map((p) => [p.id, p]));
  const taken = new Set(posts.map((p) => `${p.day} ${p.slot}`));
  const empty: string[] = [];
  for (let d = 1; d <= w.days && empty.length < 40; d++) for (const s of w.slots) if (!taken.has(`${d} ${s}`) && empty.length < 40) empty.push(`${d} ${s}`);
  const rTitle = new Map(research.map((r) => [r.id, r]));
  const used = new Set(ideas.map((i) => i.title));
  const href = (o: { s?: string | null; pillar?: string | null }) => {
    const u = new URLSearchParams();
    const s = o.s === undefined ? status : o.s, p = o.pillar === undefined ? pillar : o.pillar;
    u.set("s", s ?? "all"); if (p !== null && p !== undefined) u.set("pillar", p);
    return `/w/${w.id}/ideas${u.size ? `?${u}` : ""}`;
  };

  const firstEmpty = empty[0]?.split(" ")[0] ?? "1";
  return (
    <ServiceShell ws={w} step="ideas" ctx="3단계 주제 (검수 대기 → 승인 → 달력)">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="col"><h1>주제 {ideas.length}</h1><span className="small muted">새로 낸 주제는 누가 냈든 검수 대기에서 시작해요. 소유자·검수자가 승인한 주제만 달력에 넣을 수 있어요 · 빈 칸 {empty.length >= 40 ? "40+" : empty.length}개</span></div>
        </div>
        {typeof q.error === "string" && <p className="err">{q.error}</p>}
        {!pillars.length && <p className="hint">콘텐츠 기둥이 아직 없어요. <Link href={`/w/${w.id}/brief`}>1 목적</Link>에서 기둥을 정하면 기둥별로 모으고 예시 주제를 바로 꺼내 쓸 수 있어요.</p>}

        {canEdit && <details className="block">
          <summary style={{ fontWeight: 800, cursor: "pointer" }}>+ 새 주제 · 기둥별 예시 · AI 제안</summary>
          <div className="cols2" style={{ marginTop: 10 }}>
          <form action={createIdeaAction} className="panel">
            <input type="hidden" name="ws" value={w.id} />
            <label className="fld">제목<input name="title" className="input" required maxLength={80} placeholder="예: 초보가 꼭 챙길 준비물 5가지" /></label>
            <div className="row">
              <label className="fld" style={{ flex: 1, minWidth: 120 }}>기둥
                <select name="pillar" className="input" defaultValue={pillar ?? ""}><option value="">없음</option>{pillars.map((p) => <option key={p.name}>{p.name}</option>)}</select>
              </label>
              <label className="fld" style={{ flex: 1, minWidth: 120 }}>템플릿 <em>비우면 기둥 기본</em>
                <select name="template" className="input" defaultValue=""><option value="">기둥 기본</option>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </label>
            </div>
            <label className="fld">각도·메모 <em>어떤 이야기로, 누구에게</em><textarea name="angle" className="input" rows={2} maxLength={1000} /></label>
            {research.length > 0 && (
              <details><summary className="small">자료 연결 ({research.length})</summary>
                <div className="list" style={{ maxHeight: 180, overflowY: "auto", marginTop: 6 }}>
                  {research.slice(0, 50).map((r) => <label key={r.id} className="row small"><input type="checkbox" name="research" value={r.id} />{r.title}</label>)}
                </div>
              </details>
            )}
            <button className="btn primary" style={{ alignSelf: "flex-start" }}>검수 대기로 더하기</button>
          </form>
          <div className="panel">
            {pillars.map((p) => (
              <div key={p.name} className="col">
                <span className="small"><b>{p.name}</b> · {p.share}% · {templateOf(p.template).name} · 주제 {ideas.filter((i) => i.pillar === p.name && i.status !== "dropped").length}</span>
                <div className="tagrow">
                  {p.examples.filter((e) => e && !used.has(e)).map((e) => (
                    <form key={e} action={createIdeaAction}>
                      <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="title" value={e} /><input type="hidden" name="pillar" value={p.name} />
                      <button className="chip" title="주제로 더하기">+ {e}</button>
                    </form>
                  ))}
                  {!p.examples.some((e) => e && !used.has(e)) && <span className="small muted">예시를 다 꺼냈어요</span>}
                </div>
              </div>
            ))}
            <AiIdeas ws={w.id} enabled={await aiEnabled(actor)} />
            <AskAi prompt={`카드뉴스 스튜디오의 '${w.name}'(${w.id}) 서비스 브리프와 콘텐츠 기둥을 읽고(get_brief), 지금 주제(list_ideas)와 겹치지 않는 카드뉴스 주제 10개를 기둥별로 만들어 add_ideas 로 넣어 줘(검수 대기로 들어가요). 사실·숫자가 필요하면 먼저 웹에서 조사해 add_research 로 출처·신뢰도를 넣고 연결해 줘.`} />
          </div>
          </div>
        </details>}

        <div className="row">
          {(["review", "approved", "planned", "dropped"] as IdeaStatus[]).map((s) => <Link key={s} className={`chip${status === s ? " on" : ""}`} href={href({ s })}>{IDEA_LABEL[s]} {n(s)}</Link>)}
          <Link className={`chip${status ? "" : " on"}`} href={href({ s: null })}>전체</Link>
          <span className="small muted">·</span>
          <Link className={`chip${pillar === null ? " on" : ""}`} href={href({ pillar: null })}>모든 기둥</Link>
          {pillars.map((p) => <Link key={p.name} className={`chip${pillar === p.name ? " on" : ""}`} href={href({ pillar: p.name })}>{p.name}</Link>)}
        </div>

        {status === "approved" && canEdit && shown.length > 0 && (
          <BatchSchedule ws={w.id} action={scheduleIdeasAction} firstDay={Number(firstEmpty)} items={shown.map((i) => ({ id: i.id, title: i.title, pillar: i.pillar, by: i.approvedBy ?? "" }))} />
        )}

        <div className="list">
          {shown.map((i) => {
            const post = i.postId ? postOf.get(i.postId) : undefined;
            const unsure = i.research.filter((id) => rTitle.get(id)?.confidence === "check").length;
            return (
              <div key={i.id} className="item" data-s={i.status}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3>{i.title}</h3>
                  <div className="tagrow">
                    {i.pillar && <span className="tag dark">{i.pillar}</span>}
                    <span className="tag">{templateOf(i.template).name}</span>
                    <span className={`pill${i.status === "review" ? " dark" : ""}`}>{IDEA_LABEL[i.status]}</span>
                    <span className="tag">{i.by === "ai" ? "AI 제안" : i.by === "mcp" ? "MCP" : "직접"}</span>
                  </div>
                </div>
                {i.angle && <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{i.angle}</p>}
                <p className="small muted" style={{ margin: 0 }}>{i.research.length ? `자료 ${i.research.length}${unsure ? ` · 그중 확인 필요 ${unsure}` : ""}: ${i.research.map((id) => rTitle.get(id)?.title).filter(Boolean).join(" · ")}` : "자료 없음 · 숫자가 들어가면 자료를 먼저 연결해 주세요"}{i.approvedBy ? ` · 승인 ${i.approvedBy}` : ""}</p>
                <div className="row">
                  {i.status === "review" && (canApprove
                    ? <form action={updateIdeaAction}><input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={i.id} /><button name="status" value="approved" className="btn primary">승인</button></form>
                    : <span className="small muted">소유자·검수자가 승인하면 달력에 넣을 수 있어요</span>)}
                  {post ? <Link className="btn" href={`/w/${w.id}/p/${post.id}`}>D{post.day} {post.slot} · {STATUS_LABEL[post.status]} →</Link> : i.status === "approved" && canEdit && (
                    <form action={scheduleIdeaAction} className="row">
                      <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={i.id} />
                      <select name="spot" className="input" style={{ width: "auto" }} aria-label="넣을 칸">
                        <option value="">비어 있는 첫 칸</option>
                        {empty.map((e) => { const [d, s] = e.split(" "); return <option key={e} value={e}>D{d} {s}</option>; })}
                      </select>
                      <button className="btn" disabled={!empty.length}>이것만 달력에</button>
                    </form>
                  )}
                  {canEdit && !post && <form action={updateIdeaAction}>
                    <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={i.id} />
                    {i.status === "dropped" ? <button name="status" value="review" className="btn">검수 대기로 꺼내기</button>
                      : <>{i.status === "approved" && <button name="status" value="review" className="btn">승인 취소</button>}<button name="status" value="dropped" className="btn">보류</button></>}
                  </form>}
                </div>
                {canEdit && <details><summary>고치기</summary>
                  <form action={updateIdeaAction} className="panel" style={{ marginTop: 8 }}>
                    <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={i.id} /><input type="hidden" name="researchSet" value="1" />
                    <label className="fld">제목<input name="title" className="input" maxLength={80} defaultValue={i.title} /></label>
                    <div className="row">
                      <label className="fld" style={{ flex: 1 }}>기둥<select name="pillar" className="input" defaultValue={i.pillar}><option value="">없음</option>{pillars.map((p) => <option key={p.name}>{p.name}</option>)}</select></label>
                      <label className="fld" style={{ flex: 1 }}>템플릿<select name="template" className="input" defaultValue={i.template}>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                    </div>
                    <label className="fld">각도·메모<textarea name="angle" className="input" rows={3} maxLength={1000} defaultValue={i.angle} /></label>
                    {research.length > 0 && <div className="list" style={{ maxHeight: 160, overflowY: "auto" }}>
                      {research.slice(0, 80).map((r) => <label key={r.id} className="row small"><input type="checkbox" name="research" value={r.id} defaultChecked={i.research.includes(r.id)} />{r.title}</label>)}
                    </div>}
                    <button className="btn" style={{ alignSelf: "flex-start" }}>저장</button>
                  </form>
                </details>}
              </div>
            );
          })}
          {!shown.length && <p className="hint">{status === "review" ? "검수할 주제가 없어요." : status === "approved" ? "승인한 주제가 없어요." : "주제가 없어요. '+ 새 주제'에서 더하거나 기둥 예시를 눌러 꺼내 보세요."}</p>}
        </div>
    </ServiceShell>
  );
}
