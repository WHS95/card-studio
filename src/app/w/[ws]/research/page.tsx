import { can, requireWs } from "@/lib/auth";
import { CONFIDENCE, CONF_LABEL, type Confidence } from "@/lib/types";
import AutoSelect from "../../../ui/AutoSelect";
import { listIdeas, listResearch } from "@/lib/store";
import { aiEnabled } from "@/lib/ai";
import { addResearchAction, createIdeaAction, updateResearchAction } from "../../../actions";
import { ServiceShell } from "../../../ui/Shell";
import AiResearch from "./AiResearch";
import AskAi from "../../../AskAi";

/** 2단계 자료 조사: 출처 주소 + 요약 + 메모 + 신뢰도. 주제·게시물의 근거 */
export default async function ResearchPage({ params, searchParams }: PageProps<"/w/[ws]/research">) {
  const { ws } = await params;
  const q = await searchParams;
  const { ws: w, actor, role } = await requireWs(ws, "view");
  const [all, ideas] = await Promise.all([listResearch(w.id), listIdeas(w.id)]);
  const term = typeof q.q === "string" ? q.q.trim() : "";
  const tag = typeof q.tag === "string" ? q.tag : "";
  const conf = CONFIDENCE.includes(q.c as Confidence) ? (q.c as Confidence) : null;
  const list = all.filter((r) => (!conf || (r.confidence ?? "medium") === conf) && (!tag || r.tags.includes(tag)) && (!term || `${r.title} ${r.summary} ${r.memo} ${r.url}`.toLowerCase().includes(term.toLowerCase())));
  const tags = [...new Set(all.flatMap((r) => r.tags))].slice(0, 30);
  const usedBy = (id: string) => ideas.filter((i) => i.research.includes(id)).length;
  const canEdit = can(role, "edit");
  /** 거르기 주소: 신뢰도·태그·찾기를 서로 지키며 하나만 바꾼다 */
  const qs = (o: { c?: string | null; tag?: string | null }) => {
    const u = new URLSearchParams();
    const c = o.c === undefined ? conf : o.c, t = o.tag === undefined ? tag : o.tag;
    if (term) u.set("q", term); if (c) u.set("c", c); if (t) u.set("tag", t);
    return `/w/${w.id}/research${u.size ? `?${u}` : ""}`;
  };

  return (
    <ServiceShell ws={w} step="research" ctx="2단계 자료 조사">
        <div className="stg-head">
          <div className="col stg-head-t"><h1>자료 조사</h1><span className="small muted">숫자·사실은 출처와 함께. 높음 = 공식·학술 원문 확인 · 보통 = 2차 요약·블로그 · 확인 필요 = 원문 대조 전 (승인 체크에 표시돼요)</span></div>
          {canEdit && <details className="stg-new" open={!all.length || undefined}>
            <summary className="btn primary">+ 자료 더하기</summary>
            <div className="cols2 stg-new-body">
              <form action={addResearchAction} className="sect">
                <input type="hidden" name="ws" value={w.id} />
                <h2>직접 더하기</h2>
                <label className="fld">제목<input name="title" className="input" required maxLength={120} /></label>
                <label className="fld">출처 주소 <em>https://</em><input name="url" className="input" type="url" pattern="https://.*" maxLength={500} /></label>
                <label className="fld">요약 <em>카드에 쓸 핵심 사실</em><textarea name="summary" className="input" rows={3} maxLength={2000} /></label>
                <div className="row">
                  <label className="fld" style={{ flex: 2, minWidth: 140 }}>메모<input name="memo" className="input" maxLength={500} /></label>
                  <label className="fld" style={{ flex: 1, minWidth: 100 }}>태그 <em>쉼표로</em><input name="tags" className="input" defaultValue={tag} /></label>
                  <label className="fld">신뢰도<select name="confidence" className="input" defaultValue="medium">{CONFIDENCE.map((c) => <option key={c} value={c}>{CONF_LABEL[c]}</option>)}</select></label>
                </div>
                <button className="btn primary" style={{ alignSelf: "flex-start" }}>더하기</button>
              </form>
              <div className="sect">
                <h2>AI 자료 조사 <span className="sp small muted">웹 검색</span></h2>
                <AiResearch ws={w.id} enabled={await aiEnabled(actor)} />
                <p className="small muted" style={{ margin: 0 }}>AI 가 찾은 자료는 &apos;보통&apos;으로 들어가요. 원문을 직접 확인하면 &apos;높음&apos;으로 바꿔 주세요.</p>
                <AskAi prompt={`카드뉴스 스튜디오의 '${w.name}'(${w.id}) 서비스 브리프를 읽고(get_brief), 다음 주제를 웹에서 조사해 믿을 만한 출처 3~6개를 add_research 로 넣어 줘(제목·주소·카드에 쓸 핵심 사실 요약). 주제: `} />
              </div>
            </div>
          </details>}
        </div>
        {typeof q.error === "string" && <p className="err">{q.error}</p>}

        <div className="stg-filters">
          <div className="stg-chips stg-chips-search">
            <a className={`chip${conf ? "" : " on"}`} href={qs({ c: null })}>전체 {all.length}</a>
            {CONFIDENCE.map((c) => <a key={c} className={`chip${conf === c ? " on" : ""}`} href={qs({ c })}>{CONF_LABEL[c]} {all.filter((r) => (r.confidence ?? "medium") === c).length}</a>)}
            <form className="stg-search" action={`/w/${w.id}/research`} role="search">
              <input name="q" className="input" aria-label="자료 찾기" placeholder="찾기 (제목·요약·메모·주소)" defaultValue={term} />
              {tag && <input type="hidden" name="tag" value={tag} />}
              {conf && <input type="hidden" name="c" value={conf} />}
            </form>
          </div>
          {tags.length > 0 && <div className="stg-chips" aria-label="태그">
            <a className={`chip${tag ? "" : " on"}`} href={qs({ tag: null })}>모든 태그</a>
            {tags.map((t) => <a key={t} className={`chip${tag === t ? " on" : ""}`} href={qs({ tag: t })}>{t}</a>)}
          </div>}
        </div>

        <div className="list stg-list">
          {list.map((r) => {
            const used = usedBy(r.id);
            const meta = [r.memo && `메모: ${r.memo}`, ...r.tags.map((t) => `#${t}`), r.by !== "user" && (r.by === "ai" ? "AI 조사" : "MCP")].filter(Boolean).join(" · ");
            return (
              <article key={r.id} className="stg-card">
                <div className="stg-card-t">
                  <b className="stg-title">{r.title}</b>
                  <span className={`pill${r.confidence === "check" ? " dark" : ""}`}>{CONF_LABEL[r.confidence ?? "medium"]}</span>
                  <span className="small muted stg-right">아이디어 {used}</span>
                </div>
                {r.url && <a className="small stg-url" href={r.url} target="_blank" rel="noreferrer">{r.url}</a>}
                {r.summary && <p className="stg-text">{r.summary}</p>}
                {meta && <p className="small muted stg-p">{meta}</p>}
                <div className="stg-acts">
                  {canEdit && <form action={updateResearchAction} className="row">
                    <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="confidence" />
                    <span className="small" style={{ fontWeight: 700 }}>신뢰도</span><AutoSelect name="confidence" value={r.confidence ?? "medium"} label={`${r.title} 신뢰도`} options={CONFIDENCE.map((c) => ({ v: c, label: CONF_LABEL[c] }))} />
                    <noscript><button className="btn">바꾸기</button></noscript>
                  </form>}
                  <form action={createIdeaAction}>
                    <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="title" value={r.title.slice(0, 80)} /><input type="hidden" name="research" value={r.id} /><input type="hidden" name="angle" value={r.summary.slice(0, 1000)} /><input type="hidden" name="from" value="research" />
                    <button className="btn">이 자료로 주제</button>
                  </form>
                  {canEdit && <details className="stg-edit"><summary className="btn">고치기</summary>
                    <form action={updateResearchAction} className="panel stg-edit-body">
                      <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={r.id} />
                      <label className="fld">제목<input name="title" className="input" maxLength={120} defaultValue={r.title} /></label>
                      <label className="fld">출처 주소<input name="url" className="input" maxLength={500} defaultValue={r.url} /></label>
                      <label className="fld">요약<textarea name="summary" className="input" rows={4} maxLength={2000} defaultValue={r.summary} /></label>
                      <div className="row">
                        <label className="fld" style={{ flex: 2, minWidth: 140 }}>메모<input name="memo" className="input" maxLength={500} defaultValue={r.memo} /></label>
                        <label className="fld" style={{ flex: 1, minWidth: 100 }}>태그<input name="tags" className="input" defaultValue={r.tags.join(", ")} /></label>
                      </div>
                      <div className="row">
                        <button className="btn">저장</button>
                        <button className="btn" name="op" value="remove" formNoValidate>지우기</button>
                      </div>
                    </form>
                  </details>}
                </div>
              </article>
            );
          })}
          {!list.length && <p className="hint">{all.length ? "찾는 자료가 없어요" : "아직 자료가 없어요. 직접 더하거나 AI·MCP로 조사해 보세요."}</p>}
        </div>
    </ServiceShell>
  );
}
