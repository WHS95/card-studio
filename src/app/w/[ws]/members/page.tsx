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
        <h1>함께 쓰기 · {members.length}/{plan.members}명</h1>
        <p className="small muted" style={{ margin: 0 }}>
          역할: <b>{ROLE_LABEL.owner}</b> 전부(설정·함께 쓰기 포함) · <b>{ROLE_LABEL.editor}</b> 기획·글·사진 고치기(승인 못 함) · <b>{ROLE_LABEL.reviewer}</b> 보기·승인·게시 표시(고치기 못 함). 주제 승인은 소유자·검수자만, 주제 보류는 편집자·검수자 둘 다. 환경 변수 운영자는 늘 모든 권한이에요.
        </p>
        <Members ws={w.id} rows={rows} roles={Object.entries(ROLE_LABEL).map(([v, l]) => ({ v, l }))} full={members.length >= plan.members} planName={plan.name} />
        <p className="hint">처음 더하는 이메일이면 계정이 만들어지고 임시 비밀번호가 한 번 보여요. 메일 보내기 기능은 아직 없어서 직접 전해 주세요. 받은 사람은 &apos;내 계정&apos;에서 비밀번호를 바꿔요. 지금은 이 Mac(127.0.0.1)에서만 열려서, 다른 사람이 쓰려면 배포가 필요해요.</p>
    </ServiceShell>
  );
}
