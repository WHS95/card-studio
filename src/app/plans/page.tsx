import { requireAuth, roleIn } from "@/lib/auth";
import { listWorkspaces } from "@/lib/store";
import { PLANS, planOf, thisMonth } from "@/lib/plans";
import { WideShell } from "../ui/Shell";

const n = (x: number) => x.toLocaleString("ko-KR");

/** 요금제: 서비스마다 하나. 결제는 아직 연결 전 — 운영자가 설정에서 바꾼다 */
export default async function Plans() {
  const actor = await requireAuth();
  const mine = (await listWorkspaces()).filter((w) => roleIn(actor, w));
  const used = new Set(mine.map((w) => planOf(w.plan).id));
  return (
    <WideShell active="plans">
      <div className="w-pagehead w-1100">
        <h1>요금제</h1>
        <p className="small muted">모든 요금제에서 템플릿 전부 · 영상 장 · 릴스 · 마진 계산 · MCP 를 써요.</p>
      </div>
      <div className="w-plans">
        {Object.values(PLANS).map((p) => (
          <article key={p.id} className="sect w-plan" data-on={used.has(p.id) || undefined}>
            <div className="row"><b className="w-plan-name">{p.name}</b>{used.has(p.id) && <span className="pill dark">쓰는 중</span>}</div>
            <span className="w-price">{p.price}</span>
            <ul className="w-ul">
              <li>함께 쓰는 사람 {n(p.members)}명</li>
              <li>AI 한 달 {n(p.aiPerMonth)}번</li>
              <li>AI 영상 한 달 {n(p.videoPerMonth)}편</li>
              <li>서비스 {n(p.servicesPerOwner)}개</li>
            </ul>
          </article>
        ))}
      </div>
      <section className="sect">
        <h2>이번 달 내 서비스 사용량</h2>
        {mine.map((w) => {
          const p = planOf(w.plan);
          const cur = w.usage?.month === thisMonth() ? w.usage : undefined;
          return <p key={w.id} className="w-m0 w-14">{w.name} · {p.name} · 사람 {w.members?.length ?? 0}/{p.members} · AI {cur?.ai ?? 0}/{p.aiPerMonth} · AI 영상 {cur?.video ?? 0}/{p.videoPerMonth}</p>;
        })}
        {!mine.length && <p className="small muted w-m0">아직 속한 서비스가 없어요.</p>}
        <p className="small muted w-m0">결제는 아직 연결하지 않았어요. 요금제는 운영자가 서비스 설정에서 바꿔요. 구독 연결(이 Mac 의 Claude Code·Codex)로 쓴 AI 는 횟수에 세지 않아요.</p>
      </section>
    </WideShell>
  );
}
