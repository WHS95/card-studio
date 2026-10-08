"use client";

import { useActionState } from "react";
import { aiResearchAction } from "../../../actions";

export default function AiResearch({ ws, enabled }: { ws: string; enabled: boolean }) {
  const [st, act, pending] = useActionState(aiResearchAction, undefined);
  if (!enabled) return <p className="hint">운영자가 <a href="/settings">설정 · AI</a>에서 이 Mac의 Claude Code·Codex나 API 키를 연결하면 여기서 바로 조사할 수 있어요. 지금은 내 Claude·ChatGPT(MCP)로 할 수 있어요.</p>;
  return (
    <form action={act} className="col" style={{ gap: 8 }}>
      <input type="hidden" name="ws" value={ws} />
      <label className="fld">주제<input name="topic" className="input" required maxLength={200} placeholder="예: 초보 러너 부상 예방 수칙" /></label>
      <button className="btn primary" style={{ alignSelf: "flex-start" }} disabled={pending}>{pending ? "찾는 중… 1분쯤 걸려요" : "웹에서 조사하기"}</button>
      {st?.error && <p className="err">{st.error}</p>}
      {st?.ok !== undefined && <p className="ok">자료 {st.ok}개를 더했어요. 출처를 열어 사실을 확인해 주세요.</p>}
    </form>
  );
}
