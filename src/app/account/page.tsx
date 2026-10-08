import Link from "next/link";
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
      <div className="w-pagehead">
        <h1>내 계정</h1>
        <p className="small muted">{actor.kind === "user" ? `${actor.name} · ${actor.email}` : `${actor.name} · 운영자 (모든 서비스 · 모든 권한)`}</p>
      </div>
      <section className="sect">
        <h2>속한 서비스</h2>
        {mine.map(({ w, role }) => (
          <div key={w.id} className="w-line"><Link href={`/w/${w.id}`} className="w-line-main"><b>{w.name}</b></Link><span className="pill">{ROLE_LABEL[role!]}</span></div>
        ))}
        {!mine.length && <p className="small muted w-m0">아직 속한 서비스가 없어요.</p>}
        <p className="small muted w-m0">소유자는 모든 일을 해요. 편집자는 기획·글·사진을 맡고, 검수자는 보고 승인·게시 표시를 해요. 승인은 소유자·검수자만, 고치기는 소유자·편집자만 할 수 있어요.</p>
      </section>
      {actor.kind === "user" ? <PasswordForm /> : <p className="hint">운영자 아이디·비밀번호는 .env.local 의 STUDIO_ID · STUDIO_PASSWORD 예요. 바꾸면 기존 로그인이 풀려요.</p>}
      <p className="small muted w-m0">표시 이름과 AI 연결은 <Link href="/settings">설정</Link>, MCP 토큰은 <Link href="/connect">AI 앱 연결</Link>에 있어요.</p>
    </WideShell>
  );
}
