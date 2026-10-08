"use client";

import { postToolAction } from "../../../../actions";
import ConfirmButton from "../../../../ui/ConfirmButton";

/** 게시물 관리: 다른 칸으로 옮기기 · 복제(고른 칸에 새 초안) · 보관함으로 빼기 · 지우기 — server action 폼 (ops.ts 규칙 그대로) */
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
          <button className="btn" name="op" value="archive" title="지우지 않아요. 칸이 비고, 보관함에서 되살릴 수 있어요">보관함으로 빼기</button>
          <ConfirmButton name="op" value="remove" ask="이 게시물을 지울까요? 글·장·캡션이 모두 사라지고 되돌릴 수 없어요. 나중에 다시 쓸 수도 있다면 '보관함으로 빼기'를 골라 주세요.">지우기</ConfirmButton>
        </form>
      )}
      <p className="ed-note">옮기기·복제는 저장한 내용으로 해요{!posted ? " · 보관함은 나중에 되살릴 수 있고, 지우기는 되돌릴 수 없어요" : " · 게시한 게시물은 게시 취소 뒤에 지울 수 있어요"}</p>
    </div>
  );
}
