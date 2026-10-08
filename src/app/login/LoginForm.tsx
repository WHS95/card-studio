"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import Icon from "../ui/Icon";

// 아이디·비밀번호 칸은 자동 완성 확장이 autocomplete·data-* 속성을 바꿔 놓는 일이 잦아 그 차이만 경고하지 않는다
export default function LoginForm({ next = "", oauth }: { next?: string; oauth?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="w-auth-card">
      <input type="hidden" name="next" value={next} />
      <div className="w-brand"><Icon name="spark" size={24} /><b>카드뉴스 스튜디오</b></div>
      <h1>로그인</h1>
      {oauth && <p className="hint">AI 앱(Claude·ChatGPT)을 연결하려면 먼저 로그인해 주세요.</p>}
      <label className="fld">아이디 또는 이메일<input name="id" className="input" placeholder="운영자 아이디 또는 계정 이메일" autoComplete="username" required suppressHydrationWarning /></label>
      <label className="fld">비밀번호<input name="password" type="password" className="input" autoComplete="current-password" required suppressHydrationWarning /></label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn primary" disabled={pending}>로그인</button>
      <p className="small w-sub">계정은 서비스 소유자가 &apos;함께 쓰기&apos;에서 만들어 줘요. 이 Mac(127.0.0.1)에서만 열려요.</p>
    </form>
  );
}
