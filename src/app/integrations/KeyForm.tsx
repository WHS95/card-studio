"use client";

import { useActionState } from "react";
import { integrationAction } from "../actions";

type Props = { provider: "anthropic" | "gemini" | "openai"; name: string; use: string; get: string; placeholder: string; status: { connected: boolean; from: "env" | "screen" | null; tail: string; envName: string } };

export default function KeyForm({ provider, name, use, get, placeholder, status }: Props) {
  const [st, act, pending] = useActionState(integrationAction, undefined);
  return (
    <form action={act} className="block">
      <input type="hidden" name="provider" value={provider} />
      <div className="bh">
        <strong>{name}</strong>
        <span className={`tag${status.connected ? " dark" : ""}`}>{status.connected ? `연결됨 · …${status.tail}${status.from === "env" ? " (.env.local)" : ""}` : "연결 전"}</span>
      </div>
      <span className="small muted">{use}</span>
      <div className="row">
        <input name="key" type="password" className="input" style={{ flex: 1, minWidth: 220 }} placeholder={placeholder} autoComplete="off" disabled={status.from === "env"} />
        <button className="btn primary" name="op" value="save" disabled={pending || status.from === "env"}>저장</button>
        <button className="btn" name="op" value="test" disabled={pending || !status.connected} formNoValidate>연결 확인</button>
        {status.from === "screen" && <button className="btn" name="op" value="remove" disabled={pending} formNoValidate>지우기</button>}
      </div>
      <span className="small"><a href={get} target="_blank" rel="noreferrer">키 받기 →</a>{status.from === "env" ? ` · ${status.envName} 를 .env.local 에서 바꿔요` : ""}</span>
      {st?.error ? <p className="err">{st.error}</p> : st?.ok ? <p className="ok">{st.ok}</p> : null}
    </form>
  );
}
