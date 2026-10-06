"use client";

import { useActionState } from "react";
import { METRIC_LABEL, type Metrics } from "@/lib/types";
import { metricsAction } from "../../../../actions";

/** 게시 성과 적기 (인스타 인사이트 숫자를 옮겨 적는다) */
export default function MetricsForm({ id, m }: { id: string; m?: Metrics }) {
  const [st, act, pending] = useActionState(metricsAction, undefined);
  const rate = m && m.reach ? `저장률 ${((m.saves / m.reach) * 100).toFixed(1)}% · 참여율 ${(((m.likes + m.comments + m.saves + m.shares) / m.reach) * 100).toFixed(1)}%` : "";
  return (
    <form action={act} className="block">
      <input type="hidden" name="id" value={id} />
      <div className="bh"><strong>게시 성과</strong><span className="small muted">{m ? `${new Date(m.at).toLocaleDateString("ko-KR")} 기록 · ${rate}` : "게시 2~3일 뒤 인사이트 숫자를 옮겨 적어요"}</span></div>
      <div className="metrics">
        {(Object.keys(METRIC_LABEL) as (keyof typeof METRIC_LABEL)[]).map((k) => (
          <label key={k} className="fld">{METRIC_LABEL[k]}<input name={k} type="number" min={0} className="input" defaultValue={m?.[k] ?? ""} inputMode="numeric" /></label>
        ))}
      </div>
      <div className="row">
        <button className="btn primary" disabled={pending}>{pending ? "저장하는 중" : "성과 저장"}</button>
        {st?.error ? <p className="err">{st.error}</p> : st?.ok ? <span className="ok">저장했어요</span> : null}
      </div>
    </form>
  );
}
