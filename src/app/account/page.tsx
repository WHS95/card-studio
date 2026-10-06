import { requireAuth, roleIn } from "@/lib/auth";
import { listWorkspaces } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/types";
import Top from "../Top";
import PasswordForm from "./PasswordForm";
import ConnectApps from "./ConnectApps";
import { headers } from "next/headers";
import { baseUrl } from "@/lib/baseurl";
import { listTokens } from "@/lib/tokens";

/** 내 계정: 이름·이메일, 속한 서비스와 역할, 비밀번호 바꾸기 */
export default async function Account() {
  const actor = await requireAuth();
  const base = baseUrl(new Request("http://x", { headers: await headers() }));
  const rows = await listTokens(actor.kind === "admin" ? "admin" : actor.id);
  const mine = (await listWorkspaces()).map((w) => ({ w, role: roleIn(actor, w) })).filter((x) => x.role);
  return (
    <>
      <Top />
      <main className="wrap" style={{ maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>내 계정</h1>
        <div className="block">
          <strong>{actor.name}</strong>
          <span className="small muted">{actor.kind === "user" ? actor.email : "환경 변수 운영자 (모든 서비스 · 모든 권한)"}</span>
          <div className="tagrow">{mine.map(({ w, role }) => <a key={w.id} className="chip" href={`/w/${w.id}`}>{w.name} · {ROLE_LABEL[role!]}</a>)}</div>
        </div>
        <ConnectApps mcpUrl={`${base}/api/mcp`} local={/^http:\/\/(127\.0\.0\.1|localhost)/.test(base)} rows={rows} />
        {actor.kind === "user" ? <PasswordForm /> : <p className="hint">운영자 아이디·비밀번호는 .env.local 의 STUDIO_ID · STUDIO_PASSWORD 예요. 바꾸면 기존 로그인이 풀려요.</p>}
      </main>
    </>
  );
}
