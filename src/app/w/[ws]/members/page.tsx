import { requireWs } from "@/lib/auth";
import { listUsers } from "@/lib/store";
import { planOf } from "@/lib/plans";
import { ROLE_LABEL } from "@/lib/types";
import { ServiceShell } from "../../../ui/Shell";
import Members from "./Members";

/** 함께 쓰기 (소유자): 멤버 더하기·역할·빼기·비밀번호 초기화 */
export default async function MembersPage({ params }: PageProps<"/w/[ws]/members">) {
  const { ws } = await params;
  const { ws: w } = await requireWs(ws, "manage");
  const members = w.members ?? [];
  const users = await listUsers(members.map((m) => m.userId));
  const plan = planOf(w.plan);
  const rows = members.map((m) => { const u = users.find((x) => x.id === m.userId); return { userId: m.userId, role: m.role, email: u?.email ?? "(없는 계정)", name: u?.name ?? "" }; });
  return (
    <ServiceShell ws={w} step="" ctx="함께 쓰기">
      <div className="pghead"><h1>함께 쓰기</h1><p>이 서비스를 같이 쓰는 사람과 역할. 소유자만 보여요.</p></div>
      <Members ws={w.id} rows={rows} roles={Object.entries(ROLE_LABEL).map(([v, l]) => ({ v, l }))} full={members.length >= plan.members} planName={plan.name} limit={plan.members} />
      <p className="small muted" style={{ margin: 0 }}>처음 더하는 이메일이면 계정이 만들어지고 임시 비밀번호가 한 번 보여요. 받은 사람은 &apos;내 계정&apos;에서 비밀번호를 바꿔요. 환경 변수 운영자는 늘 모든 권한이에요. 지금은 이 Mac(127.0.0.1)에서만 열려서, 다른 사람이 쓰려면 배포가 필요해요.</p>
    </ServiceShell>
  );
}
