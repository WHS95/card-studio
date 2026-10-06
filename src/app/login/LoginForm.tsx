"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

// 아이디·비밀번호 칸은 자동 완성 확장이 autocomplete·data-* 속성을 바꿔 놓는 일이 잦아 그 차이만 경고하지 않는다
export default function LoginForm({ next = "" }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input type="hidden" name="next" value={next} />
      <label className="fld">아이디 또는 이메일<input name="id" className="input" autoComplete="username" required suppressHydrationWarning /></label>
      <label className="fld">비밀번호<input name="password" type="password" className="input" autoComplete="current-password" required suppressHydrationWarning /></label>
      {state?.error && <p className="err">{state.error}</p>}
      <button className="btn primary" disabled={pending}>로그인</button>
    </form>
  );
}
