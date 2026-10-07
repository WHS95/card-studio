"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { patAction } from "../actions";
import { copyText } from "@/lib/client/copy";

type Row = { id: string; name: string; kind: "pat" | "oauth"; client: string | null; createdAt: string; lastUsedAt?: string };
type Tab = "cc" | "cd" | "cx" | "web";

const md = (iso: string) => { const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Asia/Seoul" })); return `${d.getMonth() + 1}/${d.getDate()}`; };
const ago = (iso: string) => (Date.now() - new Date(iso).getTime() < 10 * 60_000 ? "방금" : md(iso));

/** AI 앱 연결: 내 Claude·ChatGPT 구독으로 이 스튜디오를 쓰게 (MCP 커넥터). 키 대신 내 계정으로 연결한다 */
export default function ConnectApps({ mcpUrl, local, rows }: { mcpUrl: string; local?: boolean; rows: Row[] }) {
  const [st, act, pending] = useActionState(patAction, undefined);
  const [copied, setCopied] = useState("");
  const [tab, setTab] = useState<Tab>("cc");
  const router = useRouter();
  // 토큰 만들기·끊기 뒤 목록을 다시 읽는다 (action 은 /account 를 다시 그리라고만 한다)
  useEffect(() => { if (st) router.refresh(); }, [st, router]);
  const copy = async (k: string, v: string) => { setCopied((await copyText(v)) ? k : "fail"); setTimeout(() => setCopied(""), 1500); };
  const tok = st?.token ?? "cs_pat_[토큰]";
  // Claude Desktop: 로컬 MCP 다리(mcp-remote)로 이 주소에 붙는다 — 공백 문제를 피하려고 헤더 값은 환경 변수로
  const desktop = JSON.stringify({ mcpServers: { "card-studio": { command: "npx", args: ["-y", "mcp-remote", mcpUrl, "--allow-http", "--header", "Authorization:${CARD_STUDIO_AUTH}"], env: { CARD_STUDIO_AUTH: `Bearer ${tok}` } } } }, null, 2);
  const TABS: { k: Tab; label: string; note: string; text?: string }[] = [
    { k: "cc", label: "Claude Code", note: "Claude Pro·Max 구독. 터미널에서 한 번 실행하면 어느 폴더에서든 'card-studio' 도구가 보여요.", text: `claude mcp add --scope user --transport http card-studio ${mcpUrl} \\\n  --header "Authorization: Bearer ${tok}"` },
    { k: "cd", label: "Claude Desktop", note: "Claude Desktop 은 claude_desktop_config.json(설정 › 개발자 › 설정 편집)의 mcpServers 에 이 블록을 넣고 다시 켜요. Node.js(npx)가 필요해요.", text: desktop },
    { k: "cx", label: "Codex", note: "ChatGPT 계정으로 로그인한 Codex CLI. 토큰을 환경 변수로 두고 한 번 등록해요.", text: `export CARD_STUDIO_TOKEN=${tok}\ncodex mcp add card-studio --url ${mcpUrl} --bearer-token-env-var CARD_STUDIO_TOKEN` },
    { k: "web", label: "Claude.ai · ChatGPT (배포 후)", note: "" },
  ];
  const cur = TABS.find((t) => t.k === tab)!;
  return (
    <>
      <section className="sect">
        <h2>연결 주소</h2>
        <div className="row"><input className="input w-grow" readOnly value={mcpUrl} aria-label="MCP 연결 주소" /><button type="button" className="btn" onClick={() => copy("url", mcpUrl)}>{copied === "url" ? "복사했어요" : "복사"}</button></div>
        <p className="small muted w-m0">{local ? "이 Mac 안에서만 닿아요. Claude.ai·ChatGPT 커넥터는 https 공개 주소가 생기면 써요." : "이 주소를 Claude.ai·ChatGPT 커넥터에 넣으면 이 스튜디오 로그인·동의 뒤 연결돼요."}</p>
      </section>
      <section className="sect">
        <h2>앱별 연결 방법</h2>
        <div className="row" role="tablist" aria-label="앱">
          {TABS.map((t) => <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} className={`chip${tab === t.k ? " on" : ""}`} onClick={() => setTab(t.k)}>{t.label}</button>)}
        </div>
        <div role="tabpanel" className="w-tabpanel">
          {cur.text ? (
            <>
              <p className="small muted w-m0">{cur.note}{!st?.token && " 아래에서 개인 토큰을 만들면 [토큰] 자리에 들어가요."}</p>
              <pre className="snippet w-pre">{cur.text}</pre>
              <div className="row"><button type="button" className="btn" onClick={() => copy(cur.k, cur.text!)}>{copied === cur.k ? "복사했어요" : "복사"}</button></div>
            </>
          ) : (
            <>
              <ol className="guide-steps small">
                <li>이 스튜디오를 https 주소로 배포하면, 위 연결 주소가 그 주소로 바뀌어요.</li>
                <li>Claude: 설정 › 커넥터 › 사용자 지정 커넥터 추가 › URL › 연결 → 이 스튜디오 로그인·동의 (Pro·Max 는 여러 개, 무료는 1개)</li>
                <li>ChatGPT: 개발자 모드 › 앱 만들기 › MCP URL · OAuth → 로그인·동의 (요금제마다 쓰기 허용이 달라요)</li>
              </ol>
              {local && <span className="small muted">지금처럼 이 컴퓨터(127.0.0.1)에서만 돌 때는 웹 앱이 닿지 못해요.</span>}
            </>
          )}
        </div>
      </section>
      <section className="sect">
        <h2>개인 토큰</h2>
        <form action={act} className="row">
          <input name="name" className="input w-grow" placeholder="이름 (예: Claude Desktop)" maxLength={40} aria-label="토큰 이름" />
          <button className="btn primary" disabled={pending}>토큰 만들기</button>
        </form>
        {st?.token && (
          <div className="w-once" role="status"><b>지금 한 번만 보여요</b>
            <div className="row"><code className="w-code">{st.token}</code><button type="button" className="btn" onClick={() => copy("tok", st.token!)}>{copied === "tok" ? "복사했어요" : "복사"}</button></div>
            <span className="small muted">위 앱별 설정에 이미 들어가 있어요.</span>
          </div>
        )}
        {rows.map((r) => (
          <form key={r.id} action={act} className="w-line">
            <input type="hidden" name="op" value="revoke" /><input type="hidden" name="id" value={r.id} />
            <b className="w-line-main">{r.kind === "oauth" ? `${r.client ?? r.name} (OAuth)` : r.name}</b>
            <span className="small muted" suppressHydrationWarning>만듦 {md(r.createdAt)}{r.lastUsedAt ? ` · 마지막 사용 ${ago(r.lastUsedAt)}` : " · 아직 안 씀"}</span>
            <button className="btn" disabled={pending}>연결 끊기</button>
          </form>
        ))}
        {!rows.length && <p className="small muted w-m0">아직 연결이 없어요</p>}
        {copied === "fail" && <p className="err">이 브라우저에서는 복사가 막혀 있어요. 글을 길게 눌러(또는 드래그해) 직접 복사해 주세요.</p>}
        {st?.error && <p className="err">{st.error}</p>}
        {st?.ok && <p className="ok">{st.ok}</p>}
        <p className="small muted w-m0">토큰은 내 권한으로 돌아요. 끊으면 그 앱은 바로 못 써요. 토큰은 10개까지.</p>
      </section>
    </>
  );
}
