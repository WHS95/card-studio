import Link from "next/link";
import { can, requireWs } from "@/lib/auth";
import { insights } from "@/lib/ops";
import { suggestionAction } from "../../../actions";
import { ServiceShell } from "../../../ui/Shell";

/** 8단계 성과: 성과 적을 차례(게시 metricsDays 일 뒤) · 다음 기획 제안(성과 적은 게시물 7편부터, 적용은 사람이) · 기둥별 · 저장률 상위 */
export default async function Insights({ params, searchParams }: PageProps<"/w/[ws]/insights">) {
  const { ws } = await params;
  const q = await searchParams;
  const { ws: w, role } = await requireWs(ws, "view");
  const ins = await insights(w.id);
  const days = w.metricsDays ?? 7;
  const canEdit = can(role, "edit"), canManage = can(role, "manage");
  return (
    <ServiceShell ws={w} step="insights" ctx="8단계 성과 (성과 적기·다음 기획 제안)">
      <div className="col"><h1>성과 · 게시 {ins.posted} · 기록 {ins.measured}</h1><span className="small muted">저장률 = 저장 ÷ 도달 · 참여율 = (좋아요+댓글+저장+공유) ÷ 도달 · 비교는 기둥 단위. 인스타 연결이 없어서 숫자는 사람이 인사이트를 보고 옮겨 적어요.</span></div>
      {typeof q.error === "string" && <p className="err">{q.error}</p>}
      <section className="sect">
        <h2>성과 적을 차례 {ins.due.length}<span className="sp small muted">게시하고 {days}일 지난 게시물 · 날짜는 서비스 설정에서</span></h2>
        {ins.due.map((d) => (
          <div key={d.id} className="check-row" style={{ cursor: "default", alignItems: "center" }}>
            <b style={{ flex: 1 }}>D{d.day} {d.slot} · {d.title || "제목 없음"}</b><span className="small muted">게시 {d.daysAgo}일 전</span>
            <Link className="btn" href={`/w/${w.id}/p/${d.id}#metrics`}>성과 적기</Link>
          </div>
        ))}
        {!ins.due.length && <p className="small muted" style={{ margin: 0 }}>지금 적을 게시물이 없어요.</p>}
      </section>
      <section className="sect">
        <h2>다음 기획 제안<span className="sp small muted">성과 적은 게시물 {Math.min(ins.measured, ins.suggestFrom)}/{ins.suggestFrom} · 적용은 사람이</span></h2>
        <div className="meter" aria-hidden><span style={{ width: `${Math.min(100, (ins.measured / ins.suggestFrom) * 100)}%`, background: "var(--ink)" }} /></div>
        {ins.measured < ins.suggestFrom && <p className="small muted" style={{ margin: 0 }}>{ins.suggestFrom - ins.measured}편 더 적으면 기둥 비중·후속편 제안이 떠요.</p>}
        <div className="cols2">
          {ins.suggestions.map((sg) => (
            <form key={sg.key} action={suggestionAction} className="sect" style={{ border: "1.5px solid var(--ink)" }}>
              <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="key" value={sg.key} />
              <span className="small muted" style={{ fontWeight: 700 }}>{sg.kind === "share" ? "기둥 비중" : "후속편"}</span>
              <b style={{ fontSize: 16 }}>{sg.kind === "share" ? `${sg.from} ${sg.fromShare}% → ${sg.fromShare - sg.delta}% · ${sg.to} ${sg.toShare}% → ${sg.toShare + sg.delta}%` : `'${sg.title}' 후속편`}</b>
              <p className="small" style={{ margin: 0, lineHeight: 1.6 }}>{sg.why}</p>
              {canEdit && <div className="row">
                <button className="btn primary" name="op" value="apply" disabled={sg.kind === "share" && !canManage} title={sg.kind === "share" && !canManage ? "기둥 비중은 소유자가 바꿔요" : undefined}>{sg.kind === "share" ? "비중 바꾸기" : "주제로 넣기 (검수 대기)"}</button>
                <button className="btn" name="op" value="dismiss">넘기기</button>
              </div>}
            </form>
          ))}
        </div>
      </section>
      {ins.measured ? <>
        <section className="sect"><h2>기둥별</h2>
          <table className="plain"><thead><tr><th>기둥</th><th>게시물</th><th>평균 도달</th><th>저장률</th><th>참여율</th><th>팔로우</th><th>비중</th></tr></thead>
            <tbody>{ins.byPillar.map((r) => <tr key={r.name}><td><b>{r.name}</b></td><td>{r.posts}</td><td>{r.reach.toLocaleString()}</td><td>{r.saveRate}%</td><td>{r.engagement}%</td><td>{r.follows}</td><td>{r.share ?? "-"}{r.share !== null ? "%" : ""}</td></tr>)}</tbody></table>
        </section>
        <section className="sect"><h2>저장률 높은 게시물</h2>
          <table className="plain"><thead><tr><th>게시물</th><th>기둥</th><th>도달</th><th>저장률</th><th>참여율</th></tr></thead>
            <tbody>{ins.top.map((p) => <tr key={p.id}><td><Link href={`/w/${w.id}/p/${p.id}`}>D{p.day} {p.slot} · {p.title || "제목 없음"}</Link></td><td>{p.category}</td><td>{p.reach.toLocaleString()}</td><td>{p.saveRate}%</td><td>{p.engagement}%</td></tr>)}</tbody></table>
        </section>
      </> : <p className="hint">아직 기록된 성과가 없어요. 게시된 게시물 편집기 아래 &apos;게시 성과&apos;에 숫자를 적어 주세요.</p>}
    </ServiceShell>
  );
}
