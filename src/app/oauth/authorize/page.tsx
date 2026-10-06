import { redirect } from "next/navigation";
import { getActor, roleIn } from "@/lib/auth";
import { getClient } from "@/lib/tokens";
import { listWorkspaces } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/types";
import { oauthConsentAction } from "../../actions";

/** OAuth 동의: Claude·ChatGPT 커넥터가 '연결'을 누르면 여기로 온다. 로그인 → 앱·계정·권한 확인 → 허락/거절 */
export default async function Authorize({ searchParams }: PageProps<"/oauth/authorize">) {
  const q = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v ?? ""])) as Record<string, string>;
  const client = q.client_id ? await getClient(q.client_id) : null;
  const bad = !client ? "등록되지 않은 앱이에요" : !client.redirectUris.includes(q.redirect_uri) ? "돌아갈 주소가 등록과 달라요" : q.response_type !== "code" ? "response_type=code 만 돼요" : q.code_challenge_method !== "S256" || !q.code_challenge ? "PKCE(S256)가 필요해요" : "";
  if (bad) return <main className="wrap" style={{ maxWidth: 520, paddingTop: 80 }}><h1 style={{ margin: 0 }}>연결할 수 없어요</h1><p className="err">{bad}</p></main>;
  const actor = await getActor();
  if (!actor) {
    const here = `/oauth/authorize?${new URLSearchParams(q)}`;
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }
  const mine = (await listWorkspaces()).map((w) => ({ w, role: roleIn(actor, w) })).filter((x) => x.role);
  const host = (() => { try { return new URL(q.redirect_uri).host; } catch { return q.redirect_uri; } })();
  return (
    <main className="wrap" style={{ maxWidth: 560, paddingTop: 64 }}>
      <b style={{ letterSpacing: 3 }}>카드뉴스 스튜디오</b>
      <h1 style={{ margin: 0 }}>{client!.name} 연결</h1>
      <div className="block">
        <p style={{ margin: 0 }}><b>{client!.name}</b>({host})이 <b>{actor.kind === "user" ? actor.email : "운영자"}</b> 계정으로 이 스튜디오를 쓰려고 해요.</p>
        <ul className="guide-list">
          <li>내가 속한 서비스의 브리프·아이디어·자료·게시물을 읽고, 내 역할 안에서 만들고 고쳐요.</li>
          <li>지우기·인스타 올리기는 못 해요. 승인은 검수 권한이 있을 때만이에요.</li>
          <li>AI 사용료는 그 앱(내 Claude·ChatGPT 구독)에서 나가요.</li>
        </ul>
        <div className="tagrow">{mine.map(({ w, role }) => <span key={w.id} className="tag">{w.name} · {ROLE_LABEL[role!]}</span>)}{!mine.length && <span className="small muted">아직 속한 서비스가 없어요</span>}</div>
      </div>
      <form action={oauthConsentAction} className="row">
        {["client_id", "redirect_uri", "state", "code_challenge", "resource"].map((k) => <input key={k} type="hidden" name={k} value={q[k] ?? ""} />)}
        <button className="btn primary" name="decision" value="allow">허락하고 연결</button>
        <button className="btn" name="decision" value="deny">거절</button>
      </form>
      <p className="small muted" style={{ margin: 0 }}>연결은 &apos;내 계정 &gt; AI 앱 연결&apos;에서 언제든 끊을 수 있어요.</p>
    </main>
  );
}
