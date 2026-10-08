"use client";

import { useState } from "react";

/** 승인한 주제를 골라 고른 순서대로 제작 목록 끝에 붙인다 (자리는 서버가: 모자라면 일수를 늘린다) */
export default function BatchSchedule({ ws, action, items }: {
  ws: string; action: (fd: FormData) => Promise<void>;
  items: { id: string; title: string; pillar: string; by: string }[];
}) {
  const [order, setOrder] = useState<string[]>([]);
  const flip = (id: string) => setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  return (
    <form action={action} className="stg-batch">
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="order" value={order.join(",")} />
      <h2 className="stg-h2">골라서 제작에 넣기 <span className="small muted">체크한 순서대로 제작 목록 끝에 붙어요</span></h2>
      {items.map((i) => {
        const n = order.indexOf(i.id);
        return (
          <label key={i.id} className="pick">
            <input type="checkbox" checked={n >= 0} onChange={() => flip(i.id)} />
            {n >= 0 && <span className="stg-num" aria-label={`${n + 1}번째`}>{n + 1}</span>}
            <b className="stg-pick-t">{i.title}</b><span className="small muted">{i.pillar || "기둥 없음"}{i.by ? ` · 승인 ${i.by}` : ""}</span>
          </label>
        );
      })}
      <div className="blackbar">
        <span style={{ flex: "1 1 240px" }}><b>{order.length}개 골랐어요</b></span>
        <button className="btn" disabled={!order.length}>고른 순서대로 제작에 넣기</button>
      </div>
    </form>
  );
}
