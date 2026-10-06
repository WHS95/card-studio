"use client";

import { useActionState } from "react";
import { addAiIdeasAction, aiIdeasAction } from "../../../actions";

/** AI 아이디어 제안: 받아 보고 고른 것만 더한다. 키가 없으면 MCP 안내 */
export default function AiIdeas({ ws, enabled }: { ws: string; enabled: boolean }) {
  const [st, ask, pending] = useActionState(aiIdeasAction, undefined);
  if (!enabled) return <p className="hint">AI 제안: <code>.env.local</code>에 ANTHROPIC_API_KEY를 넣으면 여기서 바로 써요. 키 없이도 Claude Code(MCP)에서 &quot;이 서비스 아이디어 10개 만들어 줘&quot;라고 하면 이 보관함에 들어와요.</p>;
  return (
    <div className="col" style={{ gap: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
      <form action={ask} className="row">
        <input type="hidden" name="ws" value={ws} />
        <input name="hint" className="input" style={{ flex: 1, minWidth: 160 }} placeholder="AI에게 덧붙일 요청 (선택)" maxLength={300} />
        <select name="count" className="input" style={{ width: "auto" }} defaultValue="5" aria-label="개수">{[3, 5, 10].map((n) => <option key={n} value={n}>{n}개</option>)}</select>
        <button className="btn" disabled={pending}>{pending ? "AI가 생각하는 중" : "AI 아이디어 받기"}</button>
      </form>
      {st?.error && <p className="err">{st.error}</p>}
      {st?.ok && (
        <form action={addAiIdeasAction} className="list">
          <input type="hidden" name="ws" value={ws} />
          {st.ok.map((x, i) => (
            <label key={i} className="item" style={{ flexDirection: "row", gap: 8 }}>
              <input type="checkbox" name="pick" value={JSON.stringify(x)} defaultChecked />
              <span className="col"><b className="small">{x.title}</b><span className="small muted">{x.pillar || "기둥 없음"} · {x.angle}</span></span>
            </label>
          ))}
          <button className="btn primary" style={{ alignSelf: "flex-start" }}>고른 것 더하기</button>
        </form>
      )}
    </div>
  );
}
