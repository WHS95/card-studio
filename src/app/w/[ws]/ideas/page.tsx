import Link from "next/link";
import { requireWs } from "@/lib/auth";
import { listIdeas, listPosts, listResearch } from "@/lib/store";
import { TEMPLATES, templateOf } from "@/lib/templates";
import { IDEA_LABEL, IDEA_STATUS, STATUS_LABEL, type IdeaStatus } from "@/lib/types";
import { aiEnabled } from "@/lib/ai";
import { createIdeaAction, scheduleIdeaAction, updateIdeaAction } from "../../../actions";
import Top from "../../../Top";
import AiIdeas from "./AiIdeas";
import AskAi from "../../../AskAi";

/** 아이디어 보관함: 기둥별로 주제를 모으고, 달력 칸에 넣으면 기획 게시물이 된다 */
export default async function Ideas({ params, searchParams }: PageProps<"/w/[ws]/ideas">) {
  const { ws } = await params;
  const q = await searchParams;
  const { ws: w } = await requireWs(ws, "view");
  const [ideas, research, posts] = await Promise.all([listIdeas(w.id), listResearch(w.id), listPosts(w.id)]);
  const pillars = w.pillars ?? [];
  const status = IDEA_STATUS.includes(q.s as IdeaStatus) ? (q.s as IdeaStatus) : null;
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
    if (s) u.set("s", s); if (p !== null && p !== undefined) u.set("pillar", p);
    return `/w/${w.id}/ideas${u.size ? `?${u}` : ""}`;
  };

  return (
    <>
      <Top ws={w} tab="ideas" />
      <main className="wrap">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>아이디어 {ideas.length}</h1>
          <span className="small muted">빈 칸 {empty.length >= 40 ? "40+" : empty.length}개 · 아이디어를 달력에 넣으면 기획 게시물이 돼요</span>
        </div>
        {typeof q.error === "string" && <p className="err">{q.error}</p>}
        {!pillars.length && <p className="hint">콘텐츠 기둥이 아직 없어요. <Link href={`/w/${w.id}/brief`}>브리프</Link>에서 기둥을 정하면 기둥별로 모으고 예시 주제를 바로 꺼내 쓸 수 있어요.</p>}

        <div className="cols2">
          <form action={createIdeaAction} className="block">
            <input type="hidden" name="ws" value={w.id} />
            <strong>새 아이디어</strong>
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
            <button className="btn primary" style={{ alignSelf: "flex-start" }}>더하기</button>
          </form>

          <div className="block">
            <strong>기둥별 예시 주제</strong>
            {pillars.length ? pillars.map((p) => (
              <div key={p.name} className="col">
                <span className="small"><b>{p.name}</b> · {p.share}% · {templateOf(p.template).name} · 아이디어 {ideas.filter((i) => i.pillar === p.name && i.status !== "dropped").length}</span>
                <div className="tagrow">
                  {p.examples.filter((e) => e && !used.has(e)).map((e) => (
                    <form key={e} action={createIdeaAction}>
                      <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="title" value={e} /><input type="hidden" name="pillar" value={p.name} />
                      <button className="chip" title="아이디어로 더하기">+ {e}</button>
                    </form>
                  ))}
                  {!p.examples.some((e) => e && !used.has(e)) && <span className="small muted">예시를 다 꺼냈어요</span>}
                </div>
              </div>
            )) : <p className="small muted" style={{ margin: 0 }}>기둥이 없어요</p>}
            <AiIdeas ws={w.id} enabled={aiEnabled()} />
            <AskAi prompt={`카드뉴스 스튜디오의 '${w.name}'(${w.id}) 서비스 브리프와 콘텐츠 기둥을 읽고(get_brief), 지금 아이디어(list_ideas)와 겹치지 않는 카드뉴스 아이디어 10개를 기둥별로 만들어 add_ideas 로 넣어 줘. 사실·숫자가 필요하면 먼저 웹에서 조사해 add_research 로 출처를 넣고 연결해 줘.`} />
          </div>
        </div>

        <div className="row">
          <Link className={`chip${status ? "" : " on"}`} href={href({ s: null })}>전체</Link>
          {IDEA_STATUS.map((s) => <Link key={s} className={`chip${status === s ? " on" : ""}`} href={href({ s })}>{IDEA_LABEL[s]} {ideas.filter((i) => i.status === s).length}</Link>)}
          <span className="small muted">·</span>
          <Link className={`chip${pillar === null ? " on" : ""}`} href={href({ pillar: null })}>모든 기둥</Link>
          {pillars.map((p) => <Link key={p.name} className={`chip${pillar === p.name ? " on" : ""}`} href={href({ pillar: p.name })}>{p.name}</Link>)}
          <Link className={`chip${pillar === "" ? " on" : ""}`} href={href({ pillar: "" })}>기둥 없음</Link>
        </div>

        <div className="list">
          {shown.map((i) => {
            const post = i.postId ? postOf.get(i.postId) : undefined;
            return (
              <div key={i.id} className="item" data-s={i.status}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3>{i.title}</h3>
                  <div className="tagrow">
                    {i.pillar && <span className="tag dark">{i.pillar}</span>}
                    <span className="tag">{templateOf(i.template).name}</span>
                    <span className="tag">{IDEA_LABEL[i.status]}</span>
                    {i.by !== "user" && <span className="tag">{i.by === "ai" ? "AI 제안" : "MCP"}</span>}
                  </div>
                </div>
                {i.angle && <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{i.angle}</p>}
                {i.research.length > 0 && <p className="small muted" style={{ margin: 0 }}>자료: {i.research.map((id) => rTitle.get(id)?.title).filter(Boolean).join(" · ")}</p>}
                <div className="row">
                  {post ? <Link className="btn" href={`/w/${w.id}/p/${post.id}`}>D{post.day} {post.slot} · {STATUS_LABEL[post.status]} →</Link> : i.status !== "dropped" && (
                    <form action={scheduleIdeaAction} className="row">
                      <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={i.id} />
                      <select name="spot" className="input" style={{ width: "auto" }} aria-label="넣을 칸">
                        <option value="">비어 있는 첫 칸</option>
                        {empty.map((e) => { const [d, s] = e.split(" "); return <option key={e} value={e}>D{d} {s}</option>; })}
                      </select>
                      <button className="btn primary" disabled={!empty.length}>달력에 넣기</button>
                    </form>
                  )}
                  <form action={updateIdeaAction}>
                    <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={i.id} />
                    {i.status === "dropped" ? <button name="status" value={post ? "planned" : "idea"} className="btn">다시 꺼내기</button> : !post && <button name="status" value="dropped" className="btn">보류</button>}
                  </form>
                </div>
                <details><summary>고치기</summary>
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
                </details>
              </div>
            );
          })}
          {!shown.length && <p className="hint">아이디어가 없어요. 위에서 더하거나 기둥 예시를 눌러 꺼내 보세요.</p>}
        </div>
      </main>
    </>
  );
}
