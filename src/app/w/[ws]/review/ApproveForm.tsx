"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { setStatusAction } from "../../../actions";

/** 사람이 확인할 것: 모두 체크해야 '승인'이 켜진다 */
export default function ApproveForm({ id, required, editHref }: { id: string; required: string[]; editHref: string }) {
  const [got, setGot] = useState<string[]>([]);
  const [st, act, pending] = useActionState(setStatusAction, undefined);
  if (st?.ok) return <p className="ok">승인했어요. 7 발행 탭에서 내려받아 올려 주세요.</p>;
  return (
    <form action={act} className="col" style={{ gap: 0 }}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="approved" />
      <b className="small" style={{ margin: "10px 0 4px" }}>사람이 확인할 것 {got.length}/{required.length}</b>
      {required.map((c) => (
        <label key={c} className="check-row">
          <input type="checkbox" name="check" value={c} checked={got.includes(c)} onChange={(e) => setGot((g) => (e.target.checked ? [...g, c] : g.filter((x) => x !== c)))} />
          <span>{c}</span>
        </label>
      ))}
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
        <Link className="btn" href={editHref}>편집기에서 고치기</Link>
        <button className="btn primary" disabled={pending || got.length < required.length}>{pending ? "승인하는 중" : "승인"}</button>
      </div>
      {st?.error && <p className="err">{st.error}</p>}
    </form>
  );
}
