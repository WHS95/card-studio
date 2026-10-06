import { requireAuth, roleIn } from "@/lib/auth";
import { listWorkspaces } from "@/lib/store";
import { PLANS, planOf, thisMonth } from "@/lib/plans";
import Top from "../Top";

/** 요금제: 서비스마다 하나. 결제는 아직 연결 전 — 운영자가 설정에서 바꾼다 */
export default async function Plans() {
  const actor = await requireAuth();
  const mine = (await listWorkspaces()).filter((w) => roleIn(actor, w));
  return (
    <>
      <Top />
      <main className="wrap" style={{ maxWidth: 960 }}>
        <h1 style={{ margin: 0 }}>요금제</h1>
        <p className="hint">결제는 아직 연결되지 않았어요. 요금제를 바꾸려면 운영자에게 요청해 주세요 (운영자는 서비스 설정에서 바꿔요).</p>
        <div className="cols3">
          {Object.values(PLANS).map((p) => (
            <div key={p.id} className="block">
              <strong>{p.name} · {p.price}</strong>
              <span className="small muted">{p.note}</span>
              <ul className="guide-list">
                <li>함께 쓰는 사람 {p.members}명</li>
                <li>AI(아이디어·자료 조사·초안) 한 달 {p.aiPerMonth}번</li>
                <li>계정 하나가 만드는 서비스 {p.servicesPerOwner}개</li>
                <li>템플릿 전부 · 영상 장 · 릴스 · 마진 계산 · MCP</li>
              </ul>
            </div>
          ))}
        </div>
        {mine.length > 0 && (
          <div className="block">
            <strong>내 서비스</strong>
            <table className="plain">
              <thead><tr><th>서비스</th><th>요금제</th><th>사람</th><th>이번 달 AI</th></tr></thead>
              <tbody>{mine.map((w) => { const p = planOf(w.plan); const ai = w.usage?.month === thisMonth() ? w.usage.ai : 0; return <tr key={w.id}><td>{w.name}</td><td>{p.name}</td><td>{w.members?.length ?? 0}/{p.members}</td><td>{ai}/{p.aiPerMonth}</td></tr>; })}</tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
