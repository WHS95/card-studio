"use client";

import { useActionState, useState } from "react";
import { setStatusAction } from "../../../actions";
import { copyText } from "@/lib/client/copy";

export function PostedForm({ id }: { id: string }) {
  const [st, act, pending] = useActionState(setStatusAction, undefined);
  return (
    <form action={act} className="row" style={{ flex: "1 1 360px" }}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="posted" />
      <input name="postedUrl" className="input" style={{ flex: 1, minWidth: 200 }} placeholder="https://www.instagram.com/p/…" aria-label="게시 링크" required />
      <button className="btn primary" disabled={pending}>게시로 표시</button>
      {st?.error && <p className="err" style={{ width: "100%" }}>{st.error}</p>}
    </form>
  );
}

export function UnpostForm({ id }: { id: string }) {
  const [st, act, pending] = useActionState(setStatusAction, undefined);
  return (
    <form action={act}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="approved" />
      <button className="btn" disabled={pending}>게시 취소</button>{st?.error && <span className="err">{st.error}</span>}</form>
  );
}

export function CopyCaption({ text }: { text: string }) {
  const [done, setDone] = useState("");
  return <button type="button" className="btn" onClick={async () => { setDone((await copyText(text)) ? "복사했어요" : "복사가 막혔어요"); setTimeout(() => setDone(""), 2000); }}>{done || "캡션 복사"}</button>;
}
