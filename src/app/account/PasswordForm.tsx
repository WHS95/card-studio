"use client";

import { useActionState } from "react";
import { changePasswordAction } from "../actions";

export default function PasswordForm() {
  const [st, act, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={act} className="sect">
      <h2>비밀번호 바꾸기</h2>
      <label className="fld">지금 비밀번호<input name="current" type="password" className="input" autoComplete="current-password" required /></label>
      <label className="fld"><span>새 비밀번호 <em>10자 이상</em></span><input name="next" type="password" className="input" autoComplete="new-password" minLength={10} required /></label>
      <div className="row"><button className="btn primary" disabled={pending}>바꾸기</button>{st?.error ? <p className="err">{st.error}</p> : st?.ok ? <span className="ok" role="status">바꿨어요</span> : null}</div>
      <p className="small muted w-m0">바꾸면 다른 기기의 로그인이 풀려요.</p>
    </form>
  );
}
