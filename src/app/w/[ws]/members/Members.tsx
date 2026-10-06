"use client";

import { useActionState } from "react";
import { memberAction } from "../../../actions";

type Row = { userId: string; role: string; email: string; name: string };

export default function Members({ ws, rows, roles, full, planName }: { ws: string; rows: Row[]; roles: { v: string; l: string }[]; full: boolean; planName: string }) {
  const [st, act, pending] = useActionState(memberAction, undefined);
  const hidden = <input type="hidden" name="ws" value={ws} />;
  return (
    <div className="panel">
      {st?.error && <p className="err">{st.error}</p>}
      {st?.ok && <p className="ok">{st.ok}</p>}
      {st?.temp && (
        <div className="block" role="status">
          <strong>임시 비밀번호 — 지금 한 번만 보여요</strong>
          <p className="small" style={{ margin: 0 }}>{st.temp.email}</p>
          <code style={{ fontSize: 18, fontWeight: 800, userSelect: "all" }}>{st.temp.password}</code>
        </div>
      )}
      <form action={act} className="block">
        {hidden}<input type="hidden" name="op" value="add" />
        <strong>사람 더하기</strong>
        <div className="row">
          <label className="fld" style={{ flex: 2, minWidth: 200 }}>이메일<input name="email" type="email" className="input" required maxLength={120} /></label>
          <label className="fld" style={{ flex: 1, minWidth: 120 }}>이름<input name="name" className="input" maxLength={30} /></label>
          <label className="fld">역할<select name="role" className="input" defaultValue="editor">{roles.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select></label>
          <button className="btn primary" disabled={pending || full}>더하기</button>
        </div>
        {full && <p className="small muted" style={{ margin: 0 }}>{planName} 요금제 인원이 다 찼어요. <a href="/plans">요금제 보기</a></p>}
      </form>
      <div className="list">
        {rows.map((r) => (
          <div key={r.userId} className="item">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span><b>{r.name}</b> <span className="small muted">{r.email}</span></span>
              <div className="row">
                <form action={act} className="row">{hidden}<input type="hidden" name="op" value="role" /><input type="hidden" name="user" value={r.userId} />
                  <select name="role" className="input" style={{ width: "auto" }} defaultValue={r.role} aria-label="역할">{roles.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select>
                  <button className="btn" disabled={pending}>바꾸기</button>
                </form>
                <form action={act}>{hidden}<input type="hidden" name="op" value="reset" /><input type="hidden" name="user" value={r.userId} /><input type="hidden" name="email" value={r.email} /><button className="btn" disabled={pending}>비밀번호 초기화</button></form>
                <form action={act}>{hidden}<input type="hidden" name="op" value="remove" /><input type="hidden" name="user" value={r.userId} /><button className="btn" disabled={pending}>빼기</button></form>
              </div>
            </div>
          </div>
        ))}
        {!rows.length && <p className="hint">아직 함께 쓰는 사람이 없어요 (운영자만).</p>}
      </div>
    </div>
  );
}
