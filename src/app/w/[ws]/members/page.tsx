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
      <div className="pghead"><h1>함께 쓰기</h1><p>이 서비스를 같이 쓰는 사람과 역할이에요. 이 화면은 소유자만 볼 수 있어요.</p></div>
      <Members ws={w.id} rows={rows} roles={Object.entries(ROLE_LABEL).map(([v, l]) => ({ v, l }))} full={members.length >= plan.members} planName={plan.name} limit={plan.members} />
      <p className="small muted" style={{ margin: 0 }}>처음 더하는 이메일이면 계정을 새로 만들고 임시 비밀번호를 한 번 보여 줘요. 받은 사람은 &apos;내 계정&apos;에서 비밀번호를 바꿀 수 있어요. 운영자는 늘 모든 권한을 가져요. 지금은 이 Mac(127.0.0.1)에서만 열려요. 다른 사람은 배포한 뒤에 들어올 수 있어요.</p>
    </ServiceShell>
  );
}
