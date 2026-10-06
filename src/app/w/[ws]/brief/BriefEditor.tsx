"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Preset } from "@/lib/presets";
import type { Brief, Pillar } from "@/lib/types";
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

export default function BriefEditor({ ws, brief: b0, pillars: p0, presets, goals, templates, isNew }: {
  ws: string; brief: Brief; pillars: Pillar[]; presets: Preset[]; goals: string[]; templates: { id: string; name: string }[]; isNew: boolean;
}) {
  const [b, setB] = useState(b0);
  const [pillars, setPillars] = useState(p0);
  const [ver, setVer] = useState(0); // 업종 묶음을 넣으면 목록 칸을 다시 그린다
  const [st, act, pending] = useActionState(saveBriefAction, undefined);
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
    <form action={act} className="panel">
      <input type="hidden" name="ws" value={ws} />
      <input type="hidden" name="body" value={JSON.stringify({ brief: b, pillars })} />

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

      <div className="bar">
        <button className="btn primary" disabled={pending || (pillars.length > 0 && total !== 100)}>{pending ? "저장하는 중" : "저장"}</button>
        {st?.error ? <p className="err">{st.error}</p> : st?.ok ? <span className="ok">저장했어요 · <Link href={`/w/${ws}/ideas`}>아이디어 모으러 가기 →</Link></span> : isNew ? <Link className="btn" href={`/w/${ws}`}>나중에 하기</Link> : null}
      </div>
    </form>
  );
}
