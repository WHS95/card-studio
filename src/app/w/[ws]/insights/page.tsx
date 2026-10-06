import Link from "next/link";
import { requireWs } from "@/lib/auth";
import { listPosts } from "@/lib/store";
import { insights } from "@/lib/ops";
import Top from "../../../Top";

type Row = Awaited<ReturnType<typeof insights>>["byPillar"][number];
const Table = ({ rows, label }: { rows: Row[]; label: string }) => (
  <table className="plain">
    <thead><tr><th>{label}</th><th>게시물</th><th>평균 도달</th><th>저장률</th><th>참여율</th><th>팔로우</th></tr></thead>
    <tbody>{rows.map((r) => <tr key={r.name}><td><b>{r.name}</b></td><td>{r.posts}</td><td>{r.reach.toLocaleString()}</td><td>{r.saveRate}%</td><td>{r.engagement}%</td><td>{r.follows}</td></tr>)}</tbody>
  </table>
);

/** 성과: 게시 뒤 적은 인사이트로 기둥·템플릿별 저장률·참여율, 잘된 게시물 */
export default async function Insights({ params }: PageProps<"/w/[ws]/insights">) {
  const { ws } = await params;
  const { ws: w } = await requireWs(ws, "view");
  const [ins, posts] = await Promise.all([insights(w.id), listPosts(w.id)]);
  const posted = posts.filter((p) => p.status === "posted");
  const missing = posted.filter((p) => !p.metrics);
  return (
    <>
      <Top ws={w} tab="insights" />
      <main className="wrap">
        <h1 style={{ margin: 0 }}>성과 · 게시 {posted.length} · 기록 {ins.measured}</h1>
        <p className="small muted" style={{ margin: 0 }}>인스타 인사이트 숫자를 게시물마다 옮겨 적으면 여기서 모아 봐요. 저장률 = 저장 ÷ 도달, 참여율 = (좋아요+댓글+저장+공유) ÷ 도달. 다음 기획에서 잘된 기둥·템플릿 비중을 늘려 보세요.</p>
        {missing.length > 0 && <div className="block"><strong className="small">성과를 아직 안 적은 게시물 {missing.length}</strong><div className="tagrow">{missing.slice(0, 20).map((p) => <Link key={p.id} className="chip" href={`/w/${w.id}/p/${p.id}`}>D{p.day} {p.slot} · {p.title || "제목 없음"}</Link>)}</div></div>}
        {ins.measured ? <>
          <div className="block"><strong>기둥별</strong><Table rows={ins.byPillar} label="기둥" /></div>
          <div className="block"><strong>템플릿별</strong><Table rows={ins.byTemplate} label="템플릿" /></div>
          <div className="block"><strong>저장률 높은 게시물</strong>
            <table className="plain"><thead><tr><th>게시물</th><th>기둥</th><th>도달</th><th>저장률</th><th>참여율</th></tr></thead>
              <tbody>{ins.top.map((p) => <tr key={p.id}><td><Link href={`/w/${w.id}/p/${p.id}`}>D{p.day} {p.slot} · {p.title || "제목 없음"}</Link></td><td>{p.category}</td><td>{p.reach.toLocaleString()}</td><td>{p.saveRate}%</td><td>{p.engagement}%</td></tr>)}</tbody></table>
          </div>
        </> : <p className="hint">아직 기록된 성과가 없어요. 게시된 게시물 편집기 아래 &apos;게시 성과&apos;에 숫자를 적어 주세요.</p>}
      </main>
    </>
  );
}
