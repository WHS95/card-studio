"use client";

import { useActionState, useState } from "react";
import { patAction } from "../actions";
import { copyText } from "@/lib/client/copy";

type Row = { id: string; name: string; kind: "pat" | "oauth"; client: string | null; createdAt: string; lastUsedAt?: string };

/** AI 앱 연결: 내 Claude·ChatGPT 구독으로 이 스튜디오를 쓰게 (MCP 커넥터). 키 대신 내 계정으로 연결한다 */
export default function ConnectApps({ mcpUrl, rows }: { mcpUrl: string; local?: boolean; rows: Row[] }) {
  const [st, act, pending] = useActionState(patAction, undefined);
  const [copied, setCopied] = useState("");
  const copy = async (k: string, v: string) => { setCopied((await copyText(v)) ? k : "fail"); setTimeout(() => setCopied(""), 1500); };
  const tok = st?.token ?? "<개인 토큰>";
  // Claude Desktop: 로컬 MCP 다리(mcp-remote)로 이 주소에 붙는다 — 공백 문제를 피하려고 헤더 값은 환경 변수로
  const desktop = (t: string) => JSON.stringify({ mcpServers: { "card-studio": { command: "npx", args: ["-y", "mcp-remote", mcpUrl, "--allow-http", "--header", "Authorization:${CARD_STUDIO_AUTH}"], env: { CARD_STUDIO_AUTH: `Bearer ${t}` } } } }, null, 2);
  return (
    <div className="panel">
      <div className="block">
        <div className="bh"><strong>AI 앱 연결 — 내 Claude·ChatGPT 구독으로 쓰기</strong></div>
        <p className="small" style={{ margin: 0 }}>API 키 없이, 이미 쓰는 <b>Claude(Pro·Max)</b>나 <b>ChatGPT</b> 구독의 앱(Claude Code · Claude Desktop · Codex)에서 &quot;이 서비스 아이디어 10개 넣어 줘&quot;, &quot;자료 조사해서 초안 써 줘&quot;처럼 시키면 이 스튜디오에 바로 들어와요. AI 사용료는 그 구독에서 나가고, 내 역할 안에서만 일해요.</p>
        <label className="fld">연결 주소 (MCP)
          <span className="row"><input className="input" readOnly value={mcpUrl} style={{ flex: 1 }} /><button type="button" className="btn" onClick={() => copy("url", mcpUrl)}>{copied === "url" ? "복사했어요" : "복사"}</button></span>
        </label>
        <p className="small" style={{ margin: 0 }}><b>이 컴퓨터에서 바로 되는 것</b> — 개인 토큰을 하나 만든 뒤, 쓰는 앱에 맞는 설정을 복사해 넣어요. 토큰은 만들 때 한 번만 보여요.</p>
        <form action={act} className="row">
          <input name="name" className="input" placeholder="이름 (예: 내 맥북 Claude)" maxLength={40} style={{ flex: 1, minWidth: 200 }} />
          <button className="btn primary" disabled={pending}>개인 토큰 만들기</button>
        </form>
        {st?.token && <div className="block" role="status"><strong className="small">토큰 — 지금 한 번만 보여요 (아래 설정에 이미 들어가 있어요)</strong><code style={{ userSelect: "all", wordBreak: "break-all" }}>{st.token}</code></div>}
        {[
          { k: "cc", title: "Claude Code (Claude Pro·Max 구독)", note: "터미널에서 한 번 실행하면 어느 폴더에서든 'card-studio' 도구가 보여요.", text: `claude mcp add --scope user --transport http card-studio ${mcpUrl} --header "Authorization: Bearer ${tok}"` },
          { k: "cd", title: "Claude Desktop (Claude 구독)", note: "설정 › 개발자 › 설정 편집(claude_desktop_config.json)의 mcpServers 에 넣고 Claude Desktop 을 다시 켜요. Node.js(npx)가 필요해요.", text: desktop(tok) },
          { k: "cx", title: "Codex CLI (ChatGPT 계정으로 로그인)", note: "토큰을 환경 변수로 두고 한 번 등록해요. ChatGPT 로그인한 Codex 에서 'card-studio' 도구를 써요.", text: `export CARD_STUDIO_TOKEN=${tok}\ncodex mcp add card-studio --url ${mcpUrl} --bearer-token-env-var CARD_STUDIO_TOKEN` },
        ].map((x) => (
          <details key={x.k} open={x.k === "cc"}><summary>{x.title}</summary>
            <p className="small muted" style={{ margin: "6px 0" }}>{x.note}</p>
            <pre className="snippet">{x.text}</pre>
            <button type="button" className="btn" onClick={() => copy(x.k, x.text)}>{copied === x.k ? "복사했어요" : "복사"}</button>
          </details>
        ))}
        <details><summary>배포했을 때: claude.ai · ChatGPT 웹 (OAuth 커넥터)</summary>
          <ol className="guide-steps small">
            <li>이 스튜디오를 https 주소로 배포하면, 위 연결 주소가 그 주소로 바뀌어요.</li>
            <li>Claude: 설정 › 커넥터 › 사용자 지정 커넥터 추가 › URL › 연결 → 이 스튜디오 로그인·동의 (Pro·Max 는 여러 개, 무료는 1개)</li>
            <li>ChatGPT: 개발자 모드 › 앱 만들기 › MCP URL · OAuth → 로그인·동의 (요금제마다 쓰기 허용이 달라요)</li>
          </ol>
          <span className="small muted">지금처럼 이 컴퓨터(127.0.0.1)에서만 돌 때는 웹 앱이 닿지 못해요.</span>
        </details>
        {copied === "fail" && <p className="err">이 브라우저에서는 복사가 막혀 있어요. 글을 길게 눌러(또는 드래그해) 직접 복사해 주세요.</p>}
        {st?.error && <p className="err">{st.error}</p>}
        {st?.ok && <p className="ok">{st.ok}</p>}
      </div>
      <div className="block">
        <strong>연결된 앱 · 토큰 {rows.length}</strong>
        {rows.map((r) => (
          <form key={r.id} action={act} className="row" style={{ justifyContent: "space-between" }}>
            <input type="hidden" name="op" value="revoke" /><input type="hidden" name="id" value={r.id} />
            <span className="small"><b>{r.kind === "oauth" ? r.client ?? r.name : r.name}</b> · {r.kind === "oauth" ? "OAuth 연결" : "개인 토큰"} · 만든 날 {new Date(r.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}{r.lastUsedAt ? ` · 마지막 사용 ${new Date(r.lastUsedAt).toLocaleString("ko-KR")}` : ""}</span>
            <button className="btn" disabled={pending}>끊기</button>
          </form>
        ))}
        {!rows.length && <span className="small muted">아직 연결이 없어요</span>}
      </div>
    </div>
  );
}
