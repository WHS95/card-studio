"use client";

import { useActionState, useRef, startTransition } from "react";
import { saveWorkspaceAction } from "../../../actions";

type W = { id: string; name: string; handle: string; startDate: string | null; days: number; slots: string[]; categories: string[]; metricsDays: number; plan: string; members: number };

// 자동 저장: 칸을 떠나거나(blur) 고르면(select·date) 바뀐 게 있을 때만 저장한다.
// <form action> 으로 보내면 React 가 끝난 뒤 폼을 되돌려서, 저장 중에 다른 칸에 쓰던 글이 사라진다 → FormData 를 직접 넘긴다.
// 보내는 칸은 예전 그대로(이름·계정·달력·성과·요금제). 요금제는 운영자가 아니면 꺼져 있어 보내지 않는다.
export default function WsSettings({ w, admin }: { w: W; admin: boolean }) {
  const [st, act, pending] = useActionState(saveWorkspaceAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  const last = useRef<string | null>(null);
  const snap = (fd: FormData) => JSON.stringify([...fd.entries()].map(([k, v]) => [k, String(v)]));
  const save = (force = false) => {
    const f = form.current;
    if (!f) return;
    if (!f.checkValidity()) { f.reportValidity(); return; } // 범위 밖(일수 1~365 등)은 저장하지 않고 알려 준다
    const fd = new FormData(f);
    const s = snap(fd);
    if (!force && s === last.current) return;
    last.current = s;
    startTransition(() => act(fd));
  };
  return (
    <>
      <div className="pghead">
        <h1>서비스 설정</h1>
        <p>자동 저장돼요 · <span aria-live="polite">{pending ? "저장하는 중" : st?.error ? <span className="err" style={{ display: "inline" }}>저장 못 함: {st.error}</span> : "저장됨"}</span>. 카드 색·워드마크는 4 템플릿 탭, 브리프·규칙은 1 목적 탭에 있어요.</p>
      </div>
      <form ref={form} className="set-form" onSubmit={(e) => { e.preventDefault(); save(true); }}
        onFocus={() => { if (last.current === null && form.current) last.current = snap(new FormData(form.current)); }}
        onBlur={() => save()}
        onChange={(e) => { const t = e.target as unknown as HTMLInputElement; if (t.tagName === "SELECT" || t.type === "date") save(); }}>
        <input type="hidden" name="ws" value={w.id} />
        <section className="sect"><h2>기본</h2>
          <div className="set-g2">
            <label className="fld">이름<input name="name" className="input" defaultValue={w.name} maxLength={30} /></label>
            <label className="fld">인스타 계정<input name="handle" className="input" defaultValue={w.handle} maxLength={30} /></label>
          </div>
        </section>
        <section className="sect"><h2>올릴 차례</h2>
          <div className="set-g3">
            <label className="fld">1일차<input name="startDate" type="date" className="input" defaultValue={w.startDate ?? ""} /></label>
            <label className="fld"><span>일수 <em>1~365 · 모자라면 저절로 늘어나요</em></span><input name="days" type="number" min={1} max={365} className="input" defaultValue={w.days} /></label>
            <label className="fld"><span>시간대 <em>쉼표로 · 6개까지</em></span><input name="slots" className="input" defaultValue={w.slots.join(", ")} /></label>
          </div>
          <label className="fld"><span>카테고리 <em>기둥 이름이 먼저 · 20개까지</em></span><input name="categories" className="input" defaultValue={w.categories.join(", ")} /></label>
        </section>
        <section className="sect"><h2>성과</h2>
          <div className="fld">
            <label htmlFor="set-md">성과 적을 날 <em>1~30일</em></label>
            <div className="set-inline"><input id="set-md" name="metricsDays" type="number" min={1} max={30} className="input" style={{ width: 90 }} defaultValue={w.metricsDays} /><span>게시하고 이만큼 지나면 &apos;성과 적을 차례&apos;에 떠요</span></div>
          </div>
        </section>
        <section className="sect"><h2>요금제 · 운영자만</h2>
          <div className="set-inline">
            <select name="plan" className="input" style={{ width: "auto", minWidth: 90 }} defaultValue={w.plan} disabled={!admin} aria-label="요금제"><option value="free">무료</option><option value="pro">프로</option><option value="agency">에이전시</option></select>
            <span className="small muted">{admin ? "결제 연결 전이라 운영자가 바꿔요" : "운영자에게 요청해 주세요"}</span>
          </div>
        </section>
        <button type="submit" className="sr" tabIndex={-1}>저장</button>
      </form>
    </>
  );
}
