"use client";

import { postToolAction } from "../../../../actions";

/** 게시물 관리: 다른 칸으로 옮기기 · 복제(고른 칸에 새 초안) · 보관함으로 빼기 — server action 폼 (ops.ts 규칙 그대로) */
export default function Manage({ ws, id, posted, empty }: { ws: string; id: string; posted: boolean; empty: string[] }) {
  return (
    <div className="ed-manage">
      <form action={postToolAction} className="ed-row">
        <input type="hidden" name="ws" value={ws} />
        <input type="hidden" name="id" value={id} />
        <select name="spot" className="input ed-spot" aria-label="옮기거나 복제할 칸">
          <option value="">비어 있는 첫 칸</option>
          {empty.map((e) => { const [d, s] = e.split(" "); return <option key={e} value={e}>D{d} {s}</option>; })}
        </select>
        <button className="btn" name="op" value="move" disabled={!empty.length}>다른 칸으로 옮기기</button>
        <button className="btn" name="op" value="duplicate" disabled={!empty.length} title="고른 칸에 같은 내용으로 새 초안을 만들어요">복제</button>
      </form>
      {!posted && (
        <form action={postToolAction} className="ed-row">
          <input type="hidden" name="ws" value={ws} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="op" value="archive" />
          <button className="btn" title="지우지 않아요. 칸이 비고, 보관함에서 되살릴 수 있어요">보관함으로 빼기</button>
        </form>
      )}
      <p className="ed-note">옮기기·복제는 저장한 내용으로 해요{!posted ? " · 보관함으로 빼도 지워지지 않아요" : ""}</p>
    </div>
  );
}
