"use client";

import { useActionState } from "react";
import { saveWorkspaceAction } from "../../../actions";

type W = { id: string; name: string; handle: string; startDate: string | null; days: number; slots: string[]; categories: string[]; metricsDays: number; plan: string; members: number };

export default function WsSettings({ w, admin }: { w: W; admin: boolean }) {
  const [st, act, pending] = useActionState(saveWorkspaceAction, undefined);
  return (
    <form action={act} className="panel">
      <input type="hidden" name="ws" value={w.id} />
      <section className="sect"><h2>기본</h2>
        <div className="cols2">
          <label className="fld">서비스 이름<input name="name" className="input" defaultValue={w.name} maxLength={30} /></label>
          <label className="fld">인스타 계정<input name="handle" className="input" defaultValue={w.handle} maxLength={30} /></label>
        </div>
      </section>
      <section className="sect"><h2>달력</h2>
        <div className="cols3">
          <label className="fld">1일차<input name="startDate" type="date" className="input" defaultValue={w.startDate ?? ""} /></label>
          <label className="fld">일수 <em>1~90</em><input name="days" type="number" min={1} max={90} className="input" defaultValue={w.days} /></label>
          <label className="fld">시간대 <em>쉼표로 · 6개까지</em><input name="slots" className="input" defaultValue={w.slots.join(", ")} /></label>
        </div>
        <label className="fld">카테고리 <em>쉼표로 · 20개까지 · 기둥 이름이 앞에 와요</em><input name="categories" className="input" defaultValue={w.categories.join(", ")} /></label>
      </section>
      <section className="sect"><h2>성과</h2>
        <label className="fld">성과 적을 날 <em>1~30일 · 게시하고 이만큼 지나면 &apos;성과 적을 차례&apos;에 떠요</em><input name="metricsDays" type="number" min={1} max={30} className="input" style={{ width: 110 }} defaultValue={w.metricsDays} /></label>
      </section>
      <section className="sect"><h2>요금제 {admin ? <span className="sp small muted">결제 연결 전이라 운영자가 바꿔요</span> : <span className="sp small muted">운영자에게 요청</span>}</h2>
        <select name="plan" className="input" style={{ width: "auto" }} defaultValue={w.plan} disabled={!admin}><option value="free">무료</option><option value="pro">프로</option><option value="agency">에이전시</option></select>
      </section>
      <div className="row"><button className="btn primary" disabled={pending}>{pending ? "저장하는 중" : "저장"}</button>{st?.error ? <p className="err">{st.error}</p> : st?.ok ? <p className="ok">저장했어요</p> : null}</div>
    </form>
  );
}
