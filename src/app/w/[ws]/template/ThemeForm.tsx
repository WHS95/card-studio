"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { saveWorkspaceAction } from "../../../actions";
import type { Theme } from "@/lib/types";

const HEX = /^#[0-9a-fA-F]{6}$/;
type Colors = { dark: string; light: string; ink: string; muted: string; accent: string; onAccent: string; wmColor: string; wmBg: string };

/** 색 칸: 네모(색 고르기) + #RRGGBB 글 칸. 둘이 같은 값을 본다 */
function ColorField({ label, note, value, onChange, disabled, compact }: { label: string; note?: string; value: string; onChange: (v: string) => void; disabled: boolean; compact?: boolean }) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setText(value); } // 네모로 고르면 글 칸도 따라간다
  return (
    <div className={`stg-color${compact ? " compact" : ""}`}>
      <span className="stg-color-l">{label}</span>
      <span className="row stg-color-in">
        <input type="color" className="stg-swatch" aria-label={`${label} 색 고르기`} value={HEX.test(value) ? value.toLowerCase() : "#000000"} disabled={disabled} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <input className="input stg-hex" aria-label={`${label} 색 값`} value={text} maxLength={7} disabled={disabled} spellCheck={false}
          onChange={(e) => { const v = e.target.value.trim(); setText(v); if (HEX.test(v)) onChange(v.toUpperCase()); }}
          onBlur={() => { if (!HEX.test(text)) setText(value); }} />
      </span>
      {note && <span className="small muted">{note}</span>}
    </div>
  );
}

export default function ThemeForm({ ws, v, canEdit, defaultTemplate, theme, templates, children }: {
  ws: string; v: string; canEdit: boolean; defaultTemplate: string; theme: Theme;
  templates: { id: string; name: string; description: string; sample: boolean }[]; children?: ReactNode;
}) {
  const [tpl, setTpl] = useState(defaultTemplate);
  const [c, setC] = useState<Colors>({ dark: theme.dark, light: theme.light, ink: theme.ink, muted: theme.muted, accent: theme.accent, onAccent: theme.onAccent, wmColor: theme.wordmark.color, wmBg: theme.wordmark.bg });
  const [wm, setWm] = useState(theme.wordmark.text);
  const [st, setSt] = useState<{ ok?: boolean; error?: string; at?: string } | undefined>(undefined);
  const [pending, start] = useTransition();
  const first = useRef(true);
  // 자동 저장: 바꾸고 0.8초 뒤 (색을 끄는 동안은 기다린다). 저장하면 아래 미리보기가 새 색으로 다시 그려진다
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!canEdit) return;
    const t = setTimeout(() => start(async () => {
      const fd = new FormData();
      fd.set("ws", ws); fd.set("defaultTemplate", tpl); fd.set("wordmark", wm);
      for (const [k, v] of Object.entries(c)) fd.set(k, v); // 칸에는 올바른 #RRGGBB 만 들어온다 (글 칸은 맞을 때만 반영)
      const r = await saveWorkspaceAction(undefined, fd);
      setSt(r?.ok ? { ok: true, at: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) } : (r ?? undefined));
    }), 800);
    return () => clearTimeout(t);
  }, [tpl, c, wm, ws, canEdit]);
  const setColor = (k: keyof Colors) => (val: string) => setC((x) => ({ ...x, [k]: val }));
  const status = !canEdit ? "색·틀은 소유자가 바꿔요" : pending ? "저장하는 중…" : st?.ok ? `저장됨 · ${st.at}` : "바꾸면 자동 저장";
  const cf = (k: keyof Colors, label: string, note?: string, compact?: boolean) => <ColorField label={label} note={note} value={c[k]} onChange={setColor(k)} disabled={!canEdit} compact={compact} />;

  return (
    <>
      <div className="col">
        <h1>템플릿</h1>
        <span className="small muted" role="status" aria-live="polite">이 서비스의 기본 틀과 카드 색. 바꾸면 미리보기가 바로 바뀌고 자동 저장돼요 · {st?.error && canEdit && !pending ? <span className="err">{st.error}</span> : status}</span>
      </div>
      <form className="panel" onSubmit={(e) => e.preventDefault()}>
        <section className="sect"><h2>기본 틀 <Link className="btn sp" href={`/templates?ws=${ws}`}>갤러리에서 더 보기</Link></h2>
          <div className="stg-tpls" role="radiogroup" aria-label="기본 틀">
            {templates.map((t) => (
              <label key={t.id} className="stg-tpl" title={t.description}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.sample ? <img src={`/api/sample/${t.id}/1?ws=${ws}&v=${v}`} alt="" loading="lazy" />
                  : <span className="wait">샘플 그림 없음</span>}
                <span className="row"><input type="radio" name="defaultTemplate" value={t.id} checked={tpl === t.id} disabled={!canEdit} onChange={() => setTpl(t.id)} />{t.name}</span>
              </label>
            ))}
          </div>
          <p className="small muted stg-p">콘텐츠 규칙 &apos;정한 틀만 쓰기&apos;가 켜져 있으면 다른 틀은 편집기에서 경고가 떠요. 기둥마다 기본 틀은 1 목적 탭에서.</p>
        </section>
        <section className="sect"><h2>카드 색</h2>
          <div className="stg-colors">
            {cf("dark", "어두운 바탕", "표지·어두운 장")}{cf("light", "밝은 바탕", "밝은 장·어두운 장 위 글자")}{cf("ink", "글자", "밝은 장 위 글자")}
            {cf("muted", "보조 글자", "작은 글")}{cf("accent", "강조색", "==강조== 채움 · 버튼")}{cf("onAccent", "강조색 위 글자", "채움 위 글자")}
          </div>
          <p className="small muted stg-p">강조색은 채움으로 써요(그 위 글자 = 강조색 위 글자). &apos;강조색 글자&apos;는 장마다 고를 수 있고, 강조색이 밝으면 밝은 바탕에선 채움으로 바뀌어요.</p>
        </section>
        <section className="sect"><h2>워드마크</h2>
          <div className="stg-wm">
            <label className="fld stg-wm-t">글자 <em>24자까지</em><input className="input" maxLength={24} value={wm} disabled={!canEdit} onChange={(e) => setWm(e.target.value)} /></label>
            {cf("wmColor", "글자색", undefined, true)}{cf("wmBg", "바탕", undefined, true)}
          </div>
        </section>
      </form>
      {children}
    </>
  );
}
