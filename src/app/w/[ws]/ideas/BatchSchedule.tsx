"use client";

import { useState } from "react";

/** 승인한 주제를 골라 고른 순서대로 빈 칸에 하루씩 */
export default function BatchSchedule({ ws, action, firstDay, items }: { ws: string; action: (fd: FormData) => Promise<void>; firstDay: number; items: { id: string; title: string; pillar: string; by: string }[] }) {
  const [order, setOrder] = useState<string[]>([]);
  const flip = (id: string) => setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  return (
    <form action={action} className="panel">
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="order" value={order.join(",")} />
      <strong>골라서 달력에 넣기 <span className="small muted" style={{ fontWeight: 500 }}>체크한 순서가 달력 순서예요</span></strong>
      {items.map((i) => {
        const n = order.indexOf(i.id);
        return (
          <label key={i.id} className="pick">
            <input type="checkbox" checked={n >= 0} onChange={() => flip(i.id)} />
            {n >= 0 && <span className="pill dark">{n + 1}</span>}
            <b style={{ flex: 1 }}>{i.title}</b><span className="small muted">{i.pillar || "기둥 없음"}{i.by ? ` · 승인 ${i.by}` : ""}</span>
          </label>
        );
      })}
      <div className="blackbar">
        <span style={{ flex: "1 1 240px" }}><b>{order.length}개 선택</b> · 고른 순서대로 하루씩</span>
        <label className="row small">시작 일차<input name="from" type="number" min={1} defaultValue={firstDay} className="input" style={{ width: 80, minHeight: 34 }} /></label>
        <button className="btn" disabled={!order.length}>달력에 차례로 넣기</button>
      </div>
    </form>
  );
}
