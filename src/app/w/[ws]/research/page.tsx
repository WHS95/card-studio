import { requireWs } from "@/lib/auth";
import { listIdeas, listResearch } from "@/lib/store";
import { aiEnabled } from "@/lib/ai";
import { addResearchAction, createIdeaAction, updateResearchAction } from "../../../actions";
import Top from "../../../Top";
import AiResearch from "./AiResearch";
import AskAi from "../../../AskAi";

/** 자료 조사: 출처 주소 + 요약 + 메모. 아이디어·게시물의 근거 */
export default async function ResearchPage({ params, searchParams }: PageProps<"/w/[ws]/research">) {
  const { ws } = await params;
  const q = await searchParams;
  const { ws: w } = await requireWs(ws, "view");
  const [all, ideas] = await Promise.all([listResearch(w.id), listIdeas(w.id)]);
  const term = typeof q.q === "string" ? q.q.trim() : "";
  const tag = typeof q.tag === "string" ? q.tag : "";
  const list = all.filter((r) => (!tag || r.tags.includes(tag)) && (!term || `${r.title} ${r.summary} ${r.memo} ${r.url}`.toLowerCase().includes(term.toLowerCase())));
  const tags = [...new Set(all.flatMap((r) => r.tags))].slice(0, 30);
  const usedBy = (id: string) => ideas.filter((i) => i.research.includes(id)).length;

  return (
    <>
      <Top ws={w} tab="research" />
      <main className="wrap">
        <h1 style={{ margin: 0 }}>자료 조사 {all.length}</h1>
        {typeof q.error === "string" && <p className="err">{q.error}</p>}
        <p className="small muted" style={{ margin: 0 }}>숫자·사실은 출처와 함께 모아 두고, 아이디어에 연결하면 게시물 메모에 출처가 붙어요. 사진 출처는 편집기에서 따로 적어요.</p>
        <div className="cols2">
          <form action={addResearchAction} className="block">
            <input type="hidden" name="ws" value={w.id} />
            <strong>자료 더하기</strong>
            <label className="fld">제목<input name="title" className="input" required maxLength={120} /></label>
            <label className="fld">출처 주소 <em>https://</em><input name="url" className="input" type="url" pattern="https://.*" maxLength={500} /></label>
            <label className="fld">요약 <em>카드에 쓸 핵심 사실</em><textarea name="summary" className="input" rows={3} maxLength={2000} /></label>
            <div className="row">
              <label className="fld" style={{ flex: 2 }}>메모<input name="memo" className="input" maxLength={500} /></label>
              <label className="fld" style={{ flex: 1 }}>태그 <em>쉼표로</em><input name="tags" className="input" defaultValue={tag} /></label>
            </div>
            <button className="btn primary" style={{ alignSelf: "flex-start" }}>더하기</button>
          </form>
          <div className="block">
            <strong>AI 자료 조사 (웹 검색)</strong>
            <AiResearch ws={w.id} enabled={aiEnabled()} />
            <AskAi prompt={`카드뉴스 스튜디오의 '${w.name}'(${w.id}) 서비스 브리프를 읽고(get_brief), 다음 주제를 웹에서 조사해 믿을 만한 출처 3~6개를 add_research 로 넣어 줘(제목·주소·카드에 쓸 핵심 사실 요약). 주제: `} />
          </div>
        </div>

        <form className="row" action={`/w/${w.id}/research`}>
          <input name="q" className="input" style={{ flex: 1, minWidth: 200 }} placeholder="찾기 (제목·요약·메모·주소)" defaultValue={term} />
          {tag && <input type="hidden" name="tag" value={tag} />}
          <button className="btn">찾기</button>
        </form>
        {tags.length > 0 && <div className="row">
          <a className={`chip${tag ? "" : " on"}`} href={`/w/${w.id}/research${term ? `?q=${encodeURIComponent(term)}` : ""}`}>모든 태그</a>
          {tags.map((t) => <a key={t} className={`chip${tag === t ? " on" : ""}`} href={`/w/${w.id}/research?tag=${encodeURIComponent(t)}${term ? `&q=${encodeURIComponent(term)}` : ""}`}>{t}</a>)}
        </div>}

        <div className="list">
          {list.map((r) => (
            <div key={r.id} className="item">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3>{r.title}</h3>
                <div className="tagrow">{r.tags.map((t) => <span key={t} className="tag">{t}</span>)}{r.by !== "user" && <span className="tag">{r.by === "ai" ? "AI 조사" : "MCP"}</span>}{usedBy(r.id) > 0 && <span className="tag dark">아이디어 {usedBy(r.id)}</span>}</div>
              </div>
              {r.url && <a className="small" href={r.url} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>{r.url}</a>}
              {r.summary && <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.summary}</p>}
              {r.memo && <p className="small muted" style={{ margin: 0 }}>메모: {r.memo}</p>}
              <div className="row">
                <form action={createIdeaAction}>
                  <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="title" value={r.title.slice(0, 80)} /><input type="hidden" name="research" value={r.id} /><input type="hidden" name="angle" value={r.summary.slice(0, 1000)} /><input type="hidden" name="from" value="research" />
                  <button className="btn">이 자료로 아이디어</button>
                </form>
                <details style={{ flex: 1 }}><summary>고치기</summary>
                  <form action={updateResearchAction} className="panel" style={{ marginTop: 8 }}>
                    <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={r.id} />
                    <label className="fld">제목<input name="title" className="input" maxLength={120} defaultValue={r.title} /></label>
                    <label className="fld">출처 주소<input name="url" className="input" maxLength={500} defaultValue={r.url} /></label>
                    <label className="fld">요약<textarea name="summary" className="input" rows={4} maxLength={2000} defaultValue={r.summary} /></label>
                    <div className="row">
                      <label className="fld" style={{ flex: 2 }}>메모<input name="memo" className="input" maxLength={500} defaultValue={r.memo} /></label>
                      <label className="fld" style={{ flex: 1 }}>태그<input name="tags" className="input" defaultValue={r.tags.join(", ")} /></label>
                    </div>
                    <div className="row">
                      <button className="btn">저장</button>
                      <button className="btn" name="op" value="remove" formNoValidate>지우기</button>
                    </div>
                  </form>
                </details>
              </div>
            </div>
          ))}
          {!list.length && <p className="hint">{all.length ? "찾는 자료가 없어요" : "아직 자료가 없어요. 직접 더하거나 AI·MCP로 조사해 보세요."}</p>}
        </div>
      </main>
    </>
  );
}
