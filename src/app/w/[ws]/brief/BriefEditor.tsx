"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Preset } from "@/lib/presets";
import { DEFAULT_CHECKS, CHECKS_MAX, NO_RULES, RULE_LABEL, type Brief, type ContentRules, type Pillar } from "@/lib/types";
import { saveBriefAction } from "../../../actions";

const join = (a: string[]) => a.join(", ");
const split = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
export const SHADES = ["#111111", "#5f5f5f", "#9a9a9a", "#c9c9c9", "#3a3a3a", "#7c7c7c", "#b3b3b3", "#e0e0e0"];

/** 쉼표로 적는 목록 칸 (적는 동안은 글 그대로, 저장할 때 나눈다) */
function ListInput({ label, value, onChange, placeholder, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; hint?: string }) {
  const [text, setText] = useState(join(value));
  return (
    <label className="fld">{label}{hint && <em>{hint}</em>}
      <input className="input" value={text} placeholder={placeholder} onChange={(e) => { setText(e.target.value); onChange(split(e.target.value)); }} />
    </label>
  );
}

export default function BriefEditor({ ws, brief: b0, pillars: p0, presets, goals, templates, isNew, canEdit }: {
  ws: string; brief: Brief; pillars: Pillar[]; presets: Preset[]; goals: string[]; templates: { id: string; name: string }[]; isNew: boolean; canEdit: boolean;
}) {
  const [b, setB] = useState(b0);
  const [pillars, setPillars] = useState(p0);
  const [ver, setVer] = useState(0); // 업종 묶음을 넣으면 목록 칸을 다시 그린다
  const [st, setSt] = useState<{ ok?: boolean; error?: string; at?: string } | undefined>(undefined);
  const [pending, start] = useTransition();
  const [newCheck, setNewCheck] = useState("");
  const first = useRef(true);
  const rules: ContentRules = { ...NO_RULES, ...b.rules };
  const sum = pillars.reduce((a, p) => a + p.share, 0);
  const sumErr = pillars.length > 0 && sum !== 100 ? `기둥 비중 합이 ${sum}%예요. 100%가 되면 저장돼요` : "";
  const checks = b.checklist ?? [];
  // 자동 저장: 고치고 0.9초 뒤 (기둥 비중 합이 100이 아니면 기다린다)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!canEdit) return;
    if (pillars.length && pillars.reduce((a, p) => a + p.share, 0) !== 100) return; // 합이 100 이 될 때까지 기다린다 (안내는 아래 sumErr)
    const t = setTimeout(() => start(async () => {
      const fd = new FormData();
      fd.set("ws", ws); fd.set("body", JSON.stringify({ brief: b, pillars }));
      const r = await saveBriefAction(undefined, fd);
      setSt(r?.ok ? { ok: true, at: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) } : r);
    }), 900);
    return () => clearTimeout(t);
  }, [b, pillars, ws, canEdit]);
  const set = (patch: Partial<Brief>) => setB((x) => ({ ...x, ...patch }));
  const total = pillars.reduce((a, p) => a + p.share, 0);
  const setP = (i: number, patch: Partial<Pillar>) => setPillars((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const applyPreset = (id: string) => {
    const pr = presets.find((p) => p.id === id);
    if (!pr) return set({ industry: id });
    if (pillars.length && !confirm(`'${pr.name}' 시작 묶음으로 기둥·말투·목표·해시태그를 바꿀까요? (지금 기둥은 사라져요)`)) return set({ industry: id });
    set({ industry: id, tone: pr.tone, goals: [...pr.goals], hashtags: [...pr.hashtags] });
    setPillars(pr.pillars.map((p) => ({ ...p, examples: [...p.examples] })));
    setVer((v) => v + 1);
  };
  const even = () => setPillars((ps) => ps.map((p, i) => ({ ...p, share: Math.floor(100 / ps.length) + (i < 100 % ps.length ? 1 : 0) })));

  return (
    <form className="panel" onSubmit={(e) => e.preventDefault()}>
      <div className="row small" role="status" aria-live="polite" style={{ position: "sticky", top: 100, zIndex: 2, alignSelf: "flex-end", background: "#fff", padding: "4px 10px", borderRadius: 999, border: "1px solid var(--line2)" }}>
        {!canEdit ? <span className="muted">보기만 할 수 있어요</span> : pending ? "저장하는 중…" : sumErr ? <span className="err">{sumErr}</span> : st?.error ? <span className="err">{st.error}</span> : st?.ok ? `저장됨 · ${st.at}` : "고치면 자동 저장"}
      </div>

      <div className="block">
        <div className="bh"><strong>1. 어떤 서비스인가요</strong><span className="small muted">초안·캡션·자료 조사의 바탕이 돼요</span></div>
        <div className="row">
          <label className="fld" style={{ flex: 1, minWidth: 200 }}>업종 <em>고르면 기둥·말투·해시태그 예시를 채워요</em>
            <select className="input" value={presets.some((p) => p.id === b.industry) ? b.industry : ""} onChange={(e) => applyPreset(e.target.value)}>
              <option value="">직접 적기 / 고르지 않음</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="fld" style={{ flex: 2, minWidth: 240 }}>프로필 링크<input className="input" value={b.link} placeholder="https://" onChange={(e) => set({ link: e.target.value })} /></label>
        </div>
        <label className="fld">한 줄 소개 <em>{b.about.length}/300</em><textarea className="input" rows={2} maxLength={300} value={b.about} placeholder="예: 주말마다 같이 걷는 사람을 이어 주는 걷기 모임 플랫폼" onChange={(e) => set({ about: e.target.value })} /></label>
        <label className="fld">누구에게 <em>{b.audience.length}/300</em><textarea className="input" rows={2} maxLength={300} value={b.audience} placeholder="예: 운동은 하고 싶지만 혼자는 어려운 20~30대 직장인" onChange={(e) => set({ audience: e.target.value })} /></label>
        <div className="fld">목표
          <div className="row">{goals.map((g) => (
            <label key={g} className="chip"><input type="checkbox" checked={b.goals.includes(g)} onChange={(e) => set({ goals: e.target.checked ? [...b.goals, g] : b.goals.filter((x) => x !== g) })} />{g}</label>
          ))}</div>
        </div>
      </div>

      <div className="block" key={`voice-${ver}`}>
        <div className="bh"><strong>2. 말투와 말</strong></div>
        <label className="fld">말투 <em>{b.tone.length}/200</em><input className="input" maxLength={200} value={b.tone} placeholder="예: 다정한 존댓말, 이모지 없이, 짧은 문장" onChange={(e) => set({ tone: e.target.value })} /></label>
        <div className="cols2">
          <ListInput label="꼭 넣을 말" value={b.keywords} onChange={(v) => set({ keywords: v })} placeholder="쉼표로 (최대 20개)" />
          <ListInput label="쓰지 않을 말" value={b.banned} onChange={(v) => set({ banned: v })} placeholder="예: 최고, 무조건, 100%" hint="과장·금지 표현" />
          <ListInput label="기본 해시태그" value={b.hashtags} onChange={(v) => set({ hashtags: v })} placeholder="#태그, #태그" hint="편집기에서 한 번에 넣어요 (최대 30)" />
          <ListInput label="참고·경쟁 계정" value={b.references} onChange={(v) => set({ references: v })} placeholder="@account (최대 10)" />
        </div>
        <label className="fld">기본 행동 유도 (CTA) <em>{b.cta.length}/60</em><input className="input" maxLength={60} value={b.cta} placeholder="예: 프로필 링크에서 이번 주 모임 보기" onChange={(e) => set({ cta: e.target.value })} /></label>
      </div>

      <div className="block" key={`pillars-${ver}`}>
        <div className="bh">
          <strong>3. 콘텐츠 기둥 · 무엇을 꾸준히 다룰지</strong>
          <span className="row">
            <span className={total === 100 || !pillars.length ? "small" : "err"}>비중 합 {total}%</span>
            <button type="button" className="btn" onClick={even} disabled={!pillars.length}>똑같이 나누기</button>
          </span>
        </div>
        <p className="small muted" style={{ margin: 0 }}>기둥 이름은 달력 카테고리가 돼요. 아이디어를 기둥별로 모으고, 달력에서 실제 비중과 목표 비중을 비교해요. 3~5개를 권해요.</p>
        {pillars.length > 0 && <div className="meter" aria-label="기둥 비중">{pillars.map((p, i) => <span key={i} title={`${p.name} ${p.share}%`} style={{ width: `${p.share}%`, background: SHADES[i % SHADES.length] }} />)}</div>}
        {pillars.map((p, i) => (
          <div key={i} className="item">
            <div className="row">
              <span className="swatch" style={{ background: SHADES[i % SHADES.length] }} />
              <label className="fld" style={{ flex: 2, minWidth: 140 }}>이름<input className="input" maxLength={20} value={p.name} onChange={(e) => setP(i, { name: e.target.value })} /></label>
              <label className="fld" style={{ width: 110 }}>비중 %<input className="input" type="number" min={0} max={100} value={p.share} onChange={(e) => setP(i, { share: Number(e.target.value) })} /></label>
              <label className="fld" style={{ flex: 1, minWidth: 120 }}>기본 템플릿
                <select className="input" value={p.template} onChange={(e) => setP(i, { template: e.target.value })}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </label>
              <button type="button" className="btn" aria-label={`${p.name} 기둥 빼기`} onClick={() => setPillars((ps) => ps.filter((_, j) => j !== i))}>빼기</button>
            </div>
            <label className="fld">설명<input className="input" maxLength={200} value={p.description} onChange={(e) => setP(i, { description: e.target.value })} /></label>
            <label className="fld">예시 주제 <em>한 줄에 하나 (최대 5개) · 아이디어 화면에서 바로 꺼내 써요</em>
              <textarea className="input" rows={2} value={p.examples.join("\n")} onChange={(e) => setP(i, { examples: e.target.value.split("\n").slice(0, 5) })} /></label>
          </div>
        ))}
        <button type="button" className="btn" disabled={pillars.length >= 8} onClick={() => setPillars((ps) => [...ps, { name: "", description: "", share: 0, template: templates[0].id, examples: [] }])}>+ 기둥</button>
      </div>

      <div className="block">
        <div className="bh"><strong>4. 콘텐츠 규칙</strong><span className="small muted">어기면 편집기에 경고 · 저장은 돼요</span></div>
        {(Object.keys(RULE_LABEL) as (keyof ContentRules)[]).map((k) => (
          <label key={k} className="check-row">
            <input type="checkbox" role="switch" checked={rules[k]} onChange={(e) => set({ rules: { ...rules, [k]: e.target.checked } })} />
            <span><b>{RULE_LABEL[k].label}</b><br /><span className="small muted">{RULE_LABEL[k].note}{k === "templateOnly" ? " · 기본 틀은 4 템플릿 탭에서" : ""}</span></span>
          </label>
        ))}
      </div>

      <div className="block">
        <div className="bh"><strong>5. 승인 체크리스트</strong><span className="small muted">게시물을 승인할 때 모두 체크해야 해요</span></div>
        <span className="small" style={{ fontWeight: 700 }}>기본 {DEFAULT_CHECKS.length} <span className="muted" style={{ fontWeight: 500 }}>모든 서비스 공통 · 뺄 수 없어요</span></span>
        {DEFAULT_CHECKS.map((c) => <label key={c} className="check-row" style={{ cursor: "default" }}><input type="checkbox" checked disabled readOnly /><span>{c}</span></label>)}
        <span className="small" style={{ fontWeight: 700 }}>이 서비스가 더한 것 {checks.length} <span className="muted" style={{ fontWeight: 500 }}>{CHECKS_MAX}개까지</span></span>
        {checks.map((c, i) => (
          <div key={i} className="check-row" style={{ cursor: "default", alignItems: "center" }}><span style={{ flex: 1 }}>{c}</span>
            <button type="button" className="btn" style={{ minHeight: 32 }} onClick={() => set({ checklist: checks.filter((_, j) => j !== i) })}>빼기</button></div>
        ))}
        <div className="row">
          <input className="input" style={{ flex: 1, minWidth: 220 }} maxLength={80} value={newCheck} placeholder="예: 부상 주제면 '아프면 병원' 한 줄" onChange={(e) => setNewCheck(e.target.value)} />
          <button type="button" className="btn" disabled={!newCheck.trim() || checks.length >= CHECKS_MAX} onClick={() => { set({ checklist: [...checks, newCheck.trim()] }); setNewCheck(""); }}>더하기</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>스튜디오가 알 수 있는 것(인스타 마진·규칙 경고·&apos;확인 필요&apos; 자료)은 승인 창 위에 자동으로 보여 줘요.</p>
      </div>

      <div className="row">
        {isNew && <Link className="btn" href={`/w/${ws}`}>나중에 하기</Link>}
        <Link className="btn" href={`/w/${ws}/research`}>다음: 자료 조사 →</Link>
      </div>
    </form>
  );
}
