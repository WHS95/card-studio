"use client";

import { useActionState } from "react";
import Link from "next/link";
import { memberAction } from "../../../actions";

type Row = { userId: string; role: string; email: string; name: string };

export default function Members({ ws, rows, roles, full, planName, limit }: { ws: string; rows: Row[]; roles: { v: string; l: string }[]; full: boolean; planName: string; limit?: number }) {
  const [st, act, pending] = useActionState(memberAction, undefined);
  const hidden = <input type="hidden" name="ws" value={ws} />;
  const opts = roles.map((r) => <option key={r.v} value={r.v}>{r.l}</option>);
  return (
    <>
      <section className="sect">
        <h2>사람 더하기</h2>
        <form action={act} className="mem-add">
          {hidden}<input type="hidden" name="op" value="add" />
          <label className="fld mem-email">이메일<input name="email" type="email" className="input" required maxLength={120} autoComplete="off" /></label>
          <label className="fld mem-name">이름<input name="name" className="input" maxLength={30} autoComplete="off" /></label>
          <label className="fld">역할<select name="role" className="input" defaultValue="editor">{opts}</select></label>
          <button className="btn primary" disabled={pending || full}>더하기</button>
        </form>
        {full && <p className="small muted" style={{ margin: 0 }}>{planName} 요금제 인원이 다 찼어요. 요금제를 바꾸면 더 더할 수 있어요. <Link href="/plans">요금제 보기</Link></p>}
        {st?.temp && (
          <div className="mem-temp" role="status">
            <b>임시 비밀번호 · 지금 한 번만 보여요</b>
            <p className="small muted" style={{ margin: 0 }}>{st.temp.email} · 메일로 보내지 않으니 직접 전해 주세요</p>
            <code>{st.temp.password}</code>
          </div>
        )}
        {st?.error && <p className="err" role="alert">{st.error}</p>}
        {st?.ok && <p className="ok" role="status">{st.ok}</p>}
      </section>
      <section className="sect">
        <h2>함께 쓰는 사람 {rows.length}{limit ? `/${limit}` : ""} · {planName}</h2>
        <div className="mem-list">
          {rows.map((r) => (
            <div key={r.userId} className="mem-row">
              <b>{r.name || "(이름 없음)"}</b><span className="small muted mem-mail">{r.email}</span>
              <span className="mem-acts">
                <form action={act}>{hidden}<input type="hidden" name="op" value="role" /><input type="hidden" name="user" value={r.userId} />
                  <select name="role" className="input mem-role" defaultValue={r.role} aria-label={`${r.name || r.email} 역할`} disabled={pending} onChange={(e) => e.currentTarget.form?.requestSubmit()}>{opts}</select>
                  <noscript><button className="btn">바꾸기</button></noscript>
                </form>
                <form action={act}>{hidden}<input type="hidden" name="op" value="reset" /><input type="hidden" name="user" value={r.userId} /><input type="hidden" name="email" value={r.email} /><button className="btn" disabled={pending}>임시 비밀번호 다시 만들기</button></form>
                <form action={act}>{hidden}<input type="hidden" name="op" value="remove" /><input type="hidden" name="user" value={r.userId} /><button className="btn" disabled={pending}>빼기</button></form>
              </span>
            </div>
          ))}
          {!rows.length && <p className="small muted mem-empty">지금은 운영자만 써요. 위에서 이메일로 사람을 더할 수 있어요.</p>}
        </div>
        <p className="small muted" style={{ margin: 0 }}>소유자 = 모든 일 · 편집자 = 기획·글·사진 · 검수자 = 보기·승인·게시 표시. 게시물·주제 승인은 소유자·검수자가 하고, 주제 보류는 편집자·검수자도 할 수 있어요.</p>
      </section>
    </>
  );
}
