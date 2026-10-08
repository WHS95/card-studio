import { redirect } from "next/navigation";
import { getActor, roleIn } from "@/lib/auth";
import { getClient } from "@/lib/tokens";
import { listWorkspaces } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/types";
import { oauthConsentAction } from "../../actions";
import Icon from "../../ui/Icon";

/** OAuth 동의: Claude·ChatGPT 커넥터가 '연결'을 누르면 여기로 온다. 로그인 → 앱·계정·권한 확인 → 허락/거절 */
export default async function Authorize({ searchParams }: PageProps<"/oauth/authorize">) {
  const q = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v ?? ""])) as Record<string, string>;
  const client = q.client_id ? await getClient(q.client_id) : null;
  const bad = !client ? "이 스튜디오에 등록한 앱이 아니에요. 그 앱에서 연결을 처음부터 다시 해 주세요." : !client.redirectUris.includes(q.redirect_uri) ? "돌아갈 주소가 등록한 주소와 달라요. 그 앱에서 연결을 처음부터 다시 해 주세요." : q.response_type !== "code" ? "response_type 은 code 만 받아요." : q.code_challenge_method !== "S256" || !q.code_challenge ? "PKCE(S256)로 요청해 주세요." : "";
  if (bad) return <main className="w-auth"><div className="w-auth-card w-wide"><div className="w-brand"><Icon name="spark" size={22} /><b>카드뉴스 스튜디오</b></div><h1>연결할 수 없어요</h1><p className="err">{bad}</p></div></main>;
  const actor = await getActor();
  if (!actor) {
    const here = `/oauth/authorize?${new URLSearchParams(q)}`;
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }
  const mine = (await listWorkspaces()).map((w) => ({ w, role: roleIn(actor, w) })).filter((x) => x.role);
  const host = (() => { try { return new URL(q.redirect_uri).host; } catch { return q.redirect_uri; } })();
  const who = actor.kind === "user" ? `${actor.name} (${actor.email})` : "운영자";
  return (
    <main className="w-auth">
      <div className="w-auth-card w-wide">
        <div className="w-brand"><Icon name="spark" size={22} /><b>카드뉴스 스튜디오</b></div>
        <h1>{client!.name} 연결을 허락할까요?</h1>
        <p className="w-lead"><b>{client!.name}</b> 앱이 <b>{who}</b> 권한으로 이 스튜디오를 써요.</p>
        <ul className="w-ul">
          {mine.map(({ w, role }) => <li key={w.id}>{w.name} · {ROLE_LABEL[role!]}</li>)}
          {!mine.length && <li>아직 속한 서비스가 없어요</li>}
        </ul>
        <p className="small w-sub">내가 속한 서비스의 브리프·아이디어·자료·게시물을 내 역할 안에서 읽고 만들고 고쳐요. 승인은 검수 권한이 있을 때만 해요. AI 사용료는 그 앱(내 Claude·ChatGPT 구독)에서 나가요.</p>
        <p className="small w-sub">삭제와 인스타 업로드는 하지 않아요. 언제든 &apos;AI 앱 연결&apos;에서 끊을 수 있어요. 돌아갈 주소: {host}</p>
        <form action={oauthConsentAction} className="row w-end">
          {["client_id", "redirect_uri", "state", "code_challenge", "resource"].map((k) => <input key={k} type="hidden" name={k} value={q[k] ?? ""} />)}
          <button className="btn" name="decision" value="deny">거절</button>
          <button className="btn primary" name="decision" value="allow">허락</button>
        </form>
      </div>
    </main>
  );
}
