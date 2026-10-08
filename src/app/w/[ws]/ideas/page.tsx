import Link from "next/link";
import { can, requireWs } from "@/lib/auth";
import { listIdeas, listPosts, listResearch } from "@/lib/store";
import { TEMPLATES, templateOf } from "@/lib/templates";
import { IDEA_LABEL, IDEA_STATUS, STATUS_LABEL, type IdeaStatus } from "@/lib/types";
import { aiEnabled } from "@/lib/ai";
import { bulkIdeasAction, createIdeaAction, removeIdeaAction, scheduleIdeaAction, updateIdeaAction } from "../../../actions";
import BulkBar, { BulkCheck, type BulkOp } from "../../../ui/BulkBar";
import ConfirmButton from "../../../ui/ConfirmButton";
import { ServiceShell } from "../../../ui/Shell";
import AiIdeas from "./AiIdeas";
import AskAi from "../../../AskAi";

/** 3단계 주제: 누가 냈든 검수 대기 → 소유자·검수자가 승인 → 승인한 것만 제작 목록에 (여러 개를 고른 순서대로 끝에) */
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
  const rTitle = new Map(research.map((r) => [r.id, r]));
  const used = new Set(ideas.map((i) => i.title));
  const href = (o: { s?: string | null; pillar?: string | null }) => {
    const u = new URLSearchParams();
    const s = o.s === undefined ? status : o.s, p = o.pillar === undefined ? pillar : o.pillar;
    u.set("s", s ?? "all"); if (p !== null && p !== undefined) u.set("pillar", p);
    return `/w/${w.id}/ideas${u.size ? `?${u}` : ""}`;
  };

  const byLabel = (b: string) => (b === "ai" ? "AI 제안" : b === "mcp" ? "MCP" : "직접");
  return (
    <ServiceShell ws={w} step="ideas" ctx="3단계 주제 (검수 대기 → 승인 → 제작)">
        <div className="stg-head">
          <div className="col stg-head-t"><h1>주제</h1><span className="small muted">새 주제는 누가 냈든 검수 대기에서 시작해요. 소유자·검수자가 승인하면 제작에 넣을 수 있어요.</span></div>
          {canEdit && <details className="stg-new" open={!ideas.length || undefined}>
            <summary className="btn primary">+ 새 주제</summary>
            <div className="cols2 stg-new-body">
              <form action={createIdeaAction} className="sect">
                <input type="hidden" name="ws" value={w.id} />
                <h2>새 주제 <span className="sp small muted">검수 대기로 들어가요</span></h2>
                <label className="fld">제목<input name="title" className="input" required maxLength={80} placeholder="예: 초보가 꼭 챙길 준비물 5가지" /></label>
                <div className="row">
                  <label className="fld" style={{ flex: 1, minWidth: 120 }}>기둥
                    <select name="pillar" className="input" defaultValue={pillar ?? ""}><option value="">없음</option>{pillars.map((p) => <option key={p.name}>{p.name}</option>)}</select>
                  </label>
                  <label className="fld" style={{ flex: 1, minWidth: 120 }}>템플릿 <em>비우면 기둥의 기본 틀</em>
                    <select name="template" className="input" defaultValue=""><option value="">기둥 기본 틀</option>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                  </label>
                </div>
                <label className="fld">이야기 방향·메모 <em>어떤 이야기로, 누구에게</em><textarea name="angle" className="input" rows={2} maxLength={1000} /></label>
                {research.length > 0 && (
                  <details><summary className="small">자료 연결 ({research.length})</summary>
                    <div className="list stg-scroll">
                      {research.slice(0, 50).map((r) => <label key={r.id} className="row small"><input type="checkbox" name="research" value={r.id} />{r.title}</label>)}
                    </div>
                  </details>
                )}
                <button className="btn primary" style={{ alignSelf: "flex-start" }}>검수 대기로 더하기</button>
              </form>
              <div className="sect">
                <h2>기둥별 예시 · AI 제안</h2>
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
        </div>
        {typeof q.error === "string" && <p className="err">{q.error}</p>}
        {!pillars.length && <p className="hint"><Link href={`/w/${w.id}/brief`}>1 목적</Link> 탭에서 콘텐츠 기둥을 정하면 주제를 기둥별로 모으고 예시 주제를 바로 꺼내 쓸 수 있어요.</p>}

        <div className="stg-filters">
          <div className="stg-chips" aria-label="상태">
            {(["review", "approved", "planned", "dropped"] as IdeaStatus[]).map((s) => <Link key={s} className={`chip${status === s ? " on" : ""}`} href={href({ s })}>{IDEA_LABEL[s]} {n(s)}</Link>)}
            <Link className={`chip${status ? "" : " on"}`} href={href({ s: null })}>전체 {ideas.length}</Link>
          </div>
          {pillars.length > 0 && <div className="stg-chips" aria-label="기둥">
            <Link className={`chip${pillar === null ? " on" : ""}`} href={href({ pillar: null })}>모든 기둥</Link>
            {pillars.map((p) => <Link key={p.name} className={`chip${pillar === p.name ? " on" : ""}`} href={href({ pillar: p.name })}>{p.name}</Link>)}
          </div>}
        </div>

        {typeof q.done === "string" && <p className="ok">{q.done}</p>}
        <div className="list stg-list">
          {shown.map((i) => {
            const post = i.postId ? postOf.get(i.postId) : undefined;
            const unsure = i.research.filter((id) => rTitle.get(id)?.confidence === "check").length;
            return (
              <article key={i.id} className="stg-card bulk-row" data-s={i.status}>
                <div className="stg-card-t">
                  {(canEdit || canApprove) && <BulkCheck group="ideas" id={i.id} label={i.title} ordered={i.status === "approved" && !i.postId && canEdit} />}
                  <b className="stg-title">{i.title}</b>
                  <span className="small muted">{[i.pillar || "기둥 없음", templateOf(i.template).name, byLabel(i.by)].map((x) => ` · ${x}`).join("")}</span>
                  {!status && <span className={`pill${i.status === "review" ? " dark" : ""}`}>{IDEA_LABEL[i.status]}</span>}
                </div>
                {i.angle && <p className="stg-text">{i.angle}</p>}
                <p className="small muted stg-p">{i.research.length ? `자료 ${i.research.length}${unsure ? ` · 그중 확인 필요 ${unsure}` : ""}: ${i.research.map((id) => rTitle.get(id)?.title).filter(Boolean).join(" · ")}` : "연결한 자료 없음 · 숫자를 쓰려면 자료를 먼저 연결해 주세요"}{i.approvedBy ? ` · 승인 ${i.approvedBy}` : ""}</p>
                <div className="stg-acts">
                  {i.status === "review" && (canApprove
                    ? <form action={updateIdeaAction}><input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={i.id} /><button name="status" value="approved" className="btn primary">승인</button></form>
                    : <span className="small muted">소유자·검수자의 승인을 기다려요</span>)}
                  {post ? <Link className="btn" href={`/w/${w.id}/p/${post.id}`}>D{post.day} {post.slot} · {STATUS_LABEL[post.status]} →</Link> : i.status === "approved" && canEdit && (
                    <form action={scheduleIdeaAction} className="row">
                      <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={i.id} />
                      <button className="btn">이 주제만 제작에 넣기</button>
                    </form>
                  )}
                  {!post && (canEdit || canApprove) && <form action={updateIdeaAction} className="row">
                    <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={i.id} />
                    {i.status === "approved" && canApprove && <button name="status" value="review" className="btn">승인 취소</button>}
                    {(i.status === "dropped" ? <button name="status" value="review" className="btn">검수 대기로 꺼내기</button> : <button name="status" value="dropped" className="btn">보류</button>)}
                  </form>}
                  {canEdit && <form action={removeIdeaAction}>
                    <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={i.id} /><input type="hidden" name="s" value={status ?? "all"} />
                    <ConfirmButton ask={`'${i.title.slice(0, 30)}' 주제를 지울까요?${post ? " 제작에 넣은 게시물은 그대로 남아요." : ""} 지우면 되돌릴 수 없어요.`}>지우기</ConfirmButton>
                  </form>}
                  {canEdit && <details className="stg-edit"><summary className="btn">고치기</summary>
                    <form action={updateIdeaAction} className="panel stg-edit-body">
                      <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={i.id} /><input type="hidden" name="researchSet" value="1" />
                      <label className="fld">제목<input name="title" className="input" maxLength={80} defaultValue={i.title} /></label>
                      <div className="row">
                        <label className="fld" style={{ flex: 1, minWidth: 120 }}>기둥<select name="pillar" className="input" defaultValue={i.pillar}><option value="">없음</option>{pillars.map((p) => <option key={p.name}>{p.name}</option>)}</select></label>
                        <label className="fld" style={{ flex: 1, minWidth: 120 }}>템플릿<select name="template" className="input" defaultValue={i.template}>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                      </div>
                      <label className="fld">이야기 방향·메모<textarea name="angle" className="input" rows={3} maxLength={1000} defaultValue={i.angle} /></label>
                      {research.length > 0 && <div className="fld">자료 연결<div className="list stg-scroll">
                        {research.slice(0, 80).map((r) => <label key={r.id} className="row small"><input type="checkbox" name="research" value={r.id} defaultChecked={i.research.includes(r.id)} />{r.title}</label>)}
                      </div></div>}
                      <button className="btn" style={{ alignSelf: "flex-start" }}>저장</button>
                    </form>
                  </details>}
                </div>
              </article>
            );
          })}
          {!shown.length && <p className="hint">{status === "review" ? "검수할 주제가 없어요. '+ 새 주제'에서 더할 수 있어요." : status === "approved" ? "승인한 주제가 없어요. 검수 대기에서 승인하면 여기에 모여요." : "주제가 없어요. '+ 새 주제'에서 더하거나 기둥 예시를 눌러 꺼내 보세요."}</p>}
        </div>
        {(canEdit || canApprove) && shown.length > 0 && (() => {
          // 탭마다 맞는 일만 (전체 탭은 모두 — 맞지 않는 주제는 서버가 그대로 둔다)
          const has = (s: IdeaStatus) => !status || status === s;
          const ops: BulkOp[] = [
            ...(has("approved") && canEdit ? [{ op: "schedule", label: "고른 순서대로 제작에 넣기", primary: true }] : []),
            ...(has("review") && canApprove ? [{ op: "approve", label: "승인", primary: !has("approved") }] : []),
            ...(has("approved") && canApprove ? [{ op: "unapprove", label: "승인 취소" }] : []),
            ...((has("review") || has("approved")) ? [{ op: "drop", label: "보류" }] : []),
            ...(has("dropped") ? [{ op: "restore", label: "검수 대기로 꺼내기" }] : []),
            ...(canEdit ? [{ op: "remove", label: "지우기", ask: "고른 주제 {n}개를 지울까요? 제작에 넣은 게시물은 그대로 남아요. 지우면 되돌릴 수 없어요." }] : []),
          ];
          return <BulkBar group="ideas" action={bulkIdeasAction} hidden={{ ws: w.id, back: href({}) }} ops={ops}
            note={status === "approved" ? "체크한 순서대로 제작 목록 끝에 붙어요" : undefined} />;
        })()}

    </ServiceShell>
  );
}
