"use client";

import { useState } from "react";

/** 승인한 주제를 골라 고른 순서대로 빈 칸에 하루씩. 시작 칸 = 그 날 이후 첫 빈 칸 (서버 scheduleIdeas 의 from) */
export default function BatchSchedule({ ws, action, starts, items }: {
  ws: string; action: (fd: FormData) => Promise<void>;
  starts: { day: number; slot: string }[]; items: { id: string; title: string; pillar: string; by: string }[];
}) {
  const [order, setOrder] = useState<string[]>([]);
  const flip = (id: string) => setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  return (
    <form action={action} className="stg-batch">
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="order" value={order.join(",")} />
      <h2 className="stg-h2">골라서 달력에 넣기 <span className="small muted">체크한 순서가 달력 순서예요</span></h2>
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
        <span style={{ flex: "1 1 240px" }}><b>{order.length}개 선택</b> · 고른 순서대로 하루씩</span>
        <label className="row small">시작 칸
          <select name="from" className="input stg-bar-sel" defaultValue={starts[0]?.day ?? 1} disabled={!starts.length}>
            {starts.map((s, k) => <option key={s.day} value={s.day}>{k === 0 ? `비어 있는 첫 칸 (D${s.day} ${s.slot})` : `D${s.day} ${s.slot}부터`}</option>)}
          </select>
        </label>
        <button className="btn" disabled={!order.length || !starts.length}>달력에 차례로 넣기</button>
      </div>
    </form>
  );
}
