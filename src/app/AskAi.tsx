"use client";

import { useState } from "react";
import { copyText } from "@/lib/client/copy";

/**
 * 내 Claude·ChatGPT 구독으로 하기: 이 스튜디오가 연결된(커넥터) AI 앱을 이 요청이 채워진 채로 연다.
 * 연결 전이면 '내 계정 > AI 앱 연결'에서 먼저 연결한다. 요청 글은 복사도 된다.
 */
export default function AskAi({ prompt, label = "내 AI 구독으로 하기" }: { prompt: string; label?: string }) {
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const q = encodeURIComponent(prompt);
  return (
    <div className="col" style={{ gap: 6 }}>
      <span className="small" style={{ fontWeight: 700 }}>{label}</span>
      <div className="row">
        <a className="btn" href={`https://claude.ai/new?q=${q}`} target="_blank" rel="noreferrer">Claude 에서</a>
        <a className="btn" href={`https://chatgpt.com/?q=${q}`} target="_blank" rel="noreferrer">ChatGPT 에서</a>
        <button type="button" className="btn" onClick={async () => { setCopied((await copyText(prompt)) ? "ok" : "fail"); setTimeout(() => setCopied(""), 2500); }}>{copied === "ok" ? "복사했어요" : copied === "fail" ? "복사가 막혔어요" : "요청 복사"}</button>
      </div>
      {copied === "fail" && <textarea className="input" rows={3} readOnly value={prompt} onFocus={(e) => e.currentTarget.select()} aria-label="직접 선택해 복사" />}
      <span className="small muted">그 앱에 이 스튜디오를 커넥터로 연결해 두어야 해요 — <a href="/connect">AI 앱 연결</a></span>
    </div>
  );
}
