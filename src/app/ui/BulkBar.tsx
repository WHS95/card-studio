"use client";

import { useEffect, useSyncExternalStore } from "react";

export type BulkOp = { op: string; label: string; ask?: string; primary?: boolean };

// 묶음(group)마다 고른 것: 줄 체크박스(BulkCheck)와 막대(BulkBar)가 같은 저장소를 본다. 목록은 서버 화면 그대로 둔다.
type Snap = { order: string[]; total: number };
type G = { order: string[]; ids: Set<string>; subs: Set<() => void>; snap: Snap };
const EMPTY: Snap = { order: [], total: 0 };
const groups = new Map<string, G>();
const g = (k: string) => { let x = groups.get(k); if (!x) groups.set(k, (x = { order: [], ids: new Set(), subs: new Set(), snap: EMPTY })); return x; };
const emit = (x: G) => { x.snap = { order: x.order, total: x.ids.size }; x.subs.forEach((f) => f()); };
const set = (k: string, order: string[]) => { const x = g(k); x.order = order.filter((id) => x.ids.has(id)); emit(x); };
function useGroup(k: string) {
  return useSyncExternalStore((cb) => { const x = g(k); x.subs.add(cb); return () => { x.subs.delete(cb); }; }, () => g(k).snap, () => EMPTY);
}

/** 목록 줄의 체크박스 — 고른 순서대로 쌓이고, ordered 면 그 번호를 보여 준다 */
export function BulkCheck({ group, id, label, ordered = false }: { group: string; id: string; label: string; ordered?: boolean }) {
  const { order } = useGroup(group);
  useEffect(() => {
    const x = g(group); x.ids.add(id); emit(x);
    // 줄이 사라지면(지움·다른 탭으로 감) 고른 것에서도 뺀다
    return () => { x.ids.delete(id); x.order = x.order.filter((v) => v !== id); emit(x); };
  }, [group, id]);
  const n = order.indexOf(id);
  return (
    <label className="bulk-pick" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" className="bulk-check" checked={n >= 0} aria-label={`${label} 고르기`}
        onChange={(e) => set(group, e.target.checked ? [...g(group).order, id] : g(group).order.filter((v) => v !== id))} />
      {ordered && n >= 0 && <span className="bulk-n" aria-label={`${n + 1}번째`}>{n + 1}</span>}
    </label>
  );
}

/** 골라서 한꺼번에: 고른 id 를 고른 순서대로 order 로 보낸다. ask 의 {n} = 고른 수. extra = 버튼 앞에 둘 것(예: 고른 것 ZIP) */
export default function BulkBar({ group, action, hidden, ops, note, extra }: {
  group: string; action: (fd: FormData) => Promise<void>; hidden: Record<string, string>; ops: BulkOp[]; note?: string;
  extra?: (ids: string[]) => React.ReactNode;
}) {
  const { order, total } = useGroup(group);
  const allOn = order.length > 0 && order.length === total;
  return (
    <form action={action} className="bulk" aria-label="골라서 한꺼번에">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="order" value={order.join(",")} />
      <label className="bulk-all"><input type="checkbox" checked={allOn} disabled={!total} onChange={() => set(group, allOn ? [] : [...g(group).ids])} />전체</label>
      <span className="bulk-count">{order.length ? `${order.length}개 골랐어요` : note ?? "줄 앞을 체크해 골라요"}</span>
      <span className="bulk-ops">
        {extra?.(order)}
        {ops.map((o) => (
          <button key={o.op} name="op" value={o.op} className={o.primary ? "btn primary" : "btn"} disabled={!order.length}
            onClick={(e) => {
              if (o.ask && !confirm(o.ask.replace("{n}", String(order.length)))) { e.preventDefault(); return; }
              setTimeout(() => set(group, []), 0); // 보낸 뒤 고른 것을 비운다
            }}>{o.label}</button>
        ))}
      </span>
    </form>
  );
}
