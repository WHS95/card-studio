"use client";

import { useActionState } from "react";
import { saveWorkspaceAction } from "../../../actions";
import type { Theme } from "@/lib/types";

export default function ThemeForm({ ws, canEdit, defaultTemplate, theme, templates }: { ws: string; canEdit: boolean; defaultTemplate: string; theme: Theme; templates: { id: string; name: string; description: string; sample: boolean }[] }) {
  const [st, act, pending] = useActionState(saveWorkspaceAction, undefined);
  const color = (name: string, label: string, v: string, note: string) => (
    <label className="fld">{label} <em>{note}</em><span className="row"><input name={name} type="color" className="input" style={{ width: 54, padding: 2 }} defaultValue={v} disabled={!canEdit} /><span className="small muted">{v}</span></span></label>
  );
  return (
    <form action={act} className="panel">
      <input type="hidden" name="ws" value={ws} />
      <section className="sect"><h2>기본 틀</h2>
        <div className="cols3">
          {templates.map((t) => (
            <label key={t.id} className="pick" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.sample ? <img src={`/api/sample/${t.id}/1?ws=${ws}`} alt="" style={{ width: "100%", aspectRatio: t.id === "reel" ? "9 / 16" : "4 / 5", objectFit: "cover", borderRadius: 8, border: "1px solid var(--line2)" }} loading="lazy" />
                : <span className="wait" style={{ aspectRatio: "4 / 5" }}>{t.name} · 샘플 그림 없음</span>}
              <span className="row"><input type="radio" name="defaultTemplate" value={t.id} defaultChecked={t.id === defaultTemplate} disabled={!canEdit} /><b>{t.name}</b></span>
              <span className="small muted">{t.description}</span>
            </label>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>콘텐츠 규칙 &apos;정한 틀만 쓰기&apos;가 켜져 있으면 다른 틀은 편집기에서 경고가 떠요.</p>
      </section>
      <section className="sect"><h2>카드 색</h2>
        <div className="cols3">
          {color("dark", "어두운 바탕", theme.dark, "표지·어두운 장")}{color("light", "밝은 바탕", theme.light, "밝은 장·어두운 장 위 글자")}{color("ink", "글자", theme.ink, "밝은 장 위 글자")}
          {color("muted", "보조 글자", theme.muted, "작은 글")}{color("accent", "강조색", theme.accent, "==강조== 채움·버튼")}{color("onAccent", "강조색 위 글자", theme.onAccent, "채움 위 글자")}
        </div>
      </section>
      <section className="sect"><h2>워드마크</h2>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="fld" style={{ flex: 1, minWidth: 200 }}>글자 <em>24자까지</em><input name="wordmark" className="input" maxLength={24} defaultValue={theme.wordmark.text} disabled={!canEdit} /></label>
          {color("wmColor", "글자색", theme.wordmark.color, "")}{color("wmBg", "바탕", theme.wordmark.bg, "")}
        </div>
      </section>
      {canEdit ? <div className="row"><button className="btn primary" disabled={pending}>{pending ? "저장하는 중" : "저장"}</button>{st?.error ? <p className="err">{st.error}</p> : st?.ok ? <p className="ok">저장했어요 · 미리보기가 바뀌어요</p> : null}</div>
        : <p className="small muted" style={{ margin: 0 }}>색·틀은 소유자가 바꿔요.</p>}
    </form>
  );
}
