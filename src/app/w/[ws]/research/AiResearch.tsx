"use client";

import { useActionState } from "react";
import { aiResearchAction } from "../../../actions";

export default function AiResearch({ ws, enabled }: { ws: string; enabled: boolean }) {
  const [st, act, pending] = useActionState(aiResearchAction, undefined);
  if (!enabled) return <p className="hint">AI 연결이 없어요. 운영자가 <a href="/settings">설정 · AI</a>에서 이 Mac 의 Claude Code·Codex 또는 API 키를 연결하면 여기서 바로 써요. 연결 없이도 내 Claude·ChatGPT(MCP)로 할 수 있어요.</p>;
  return (
    <form action={act} className="col" style={{ gap: 8 }}>
      <input type="hidden" name="ws" value={ws} />
      <label className="fld">주제<input name="topic" className="input" required maxLength={200} placeholder="예: 초보 러너 부상 예방 수칙" /></label>
      <button className="btn primary" style={{ alignSelf: "flex-start" }} disabled={pending}>{pending ? "찾는 중 (1분쯤)" : "웹에서 조사하기"}</button>
      {st?.error && <p className="err">{st.error}</p>}
      {st?.ok !== undefined && <p className="ok">자료 {st.ok}개를 더했어요. 출처를 열어 사실을 꼭 확인해 주세요.</p>}
      <p className="small muted" style={{ margin: 0 }}>AI가 찾은 내용은 틀릴 수 있어요. 게시 전에 출처를 직접 확인해요.</p>
    </form>
  );
}
