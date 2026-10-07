"use client";

import { useActionState, useState } from "react";
import { setStatusAction } from "../../../actions";
import { copyText } from "@/lib/client/copy";

export function PostedForm({ id }: { id: string }) {
  const [st, act, pending] = useActionState(setStatusAction, undefined);
  return (
    <form action={act} className="mk-posted">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="posted" />
      <label className="mk-link">게시 링크<input name="postedUrl" className="input" placeholder="https://www.instagram.com/p/…" required /></label>
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

/** 승인된 게시물 하나를 골라 장마다 n초씩 릴스 MP4 (GET /api/posts/[id]/reel?secs=) */
export function ReelForm({ posts }: { posts: { id: string; label: string }[] }) {
  const [id, setId] = useState(posts[0]?.id ?? "");
  return (
    <form action={`/api/posts/${id}/reel`} method="get" className="row">
      <select className="input mk-reel-pick" value={id} onChange={(e) => setId(e.target.value)} aria-label="릴스로 만들 게시물">
        {posts.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <label className="row" style={{ gap: 6, fontSize: 13 }}>장마다<input name="secs" type="number" min={1} max={10} defaultValue={3} className="input" style={{ width: 70 }} />초</label>
      <button className="btn">릴스 MP4 만들기</button>
    </form>
  );
}
