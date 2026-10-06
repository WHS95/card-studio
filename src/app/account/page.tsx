import { requireAuth, roleIn } from "@/lib/auth";
import { listWorkspaces } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/types";
import { WideShell } from "../ui/Shell";
import PasswordForm from "./PasswordForm";

/** 내 계정: 이름·이메일, 속한 서비스와 역할, 비밀번호 바꾸기 */
export default async function Account() {
  const actor = await requireAuth();
  const mine = (await listWorkspaces()).map((w) => ({ w, role: roleIn(actor, w) })).filter((x) => x.role);
  return (
    <WideShell active="account" narrow>
        <h1>내 계정</h1>
        <div className="block">
          <strong>{actor.name}</strong>
          <span className="small muted">{actor.kind === "user" ? actor.email : "환경 변수 운영자 (모든 서비스 · 모든 권한)"}</span>
          <div className="tagrow">{mine.map(({ w, role }) => <a key={w.id} className="chip" href={`/w/${w.id}`}>{w.name} · {ROLE_LABEL[role!]}</a>)}</div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>소유자 = 전부 · 편집자 = 기획·글·사진(승인 못 함) · 검수자 = 보기·승인·게시 표시(고치기 못 함). 표시 이름과 AI 는 <a href="/settings">설정</a>, MCP 토큰은 <a href="/connect">AI 앱 연결</a>에 있어요.</p>
        {actor.kind === "user" ? <PasswordForm /> : <p className="hint">운영자 아이디·비밀번호는 .env.local 의 STUDIO_ID · STUDIO_PASSWORD 예요. 바꾸면 기존 로그인이 풀려요.</p>}
      </WideShell>
  );
}
