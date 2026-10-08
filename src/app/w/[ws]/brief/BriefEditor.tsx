"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import type { Preset } from "@/lib/presets";
import { DEFAULT_CHECKS, CHECKS_MAX, NO_RULES, RULE_LABEL, type Brief, type ContentRules, type Pillar } from "@/lib/types";
import { saveBriefAction } from "../../../actions";

const join = (a: string[]) => a.join(", ");
const split = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

/** 문서형 한 줄: 작은 이름 + 바로 고치는 칸 */
function Dl({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="dl stg-dl"><span>{label}{hint && <em> · {hint}</em>}</span>{children}</label>;
}

/** 쉼표로 적는 목록 칸 (적는 동안은 글 그대로, 저장할 때 나눈다) */
function ListInput({ label, value, onChange, placeholder, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; hint?: string }) {
  const [text, setText] = useState(join(value));
  return (
    <Dl label={label} hint={hint}>
      <input className="stg-in" value={text} placeholder={placeholder} onChange={(e) => { setText(e.target.value); onChange(split(e.target.value)); }} />
    </Dl>
  );
}

/** 문서 카드 아래 '+ 항목 추가' */
function AddRow({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="stg-add" aria-label={label} onClick={onClick} disabled={disabled}><span aria-hidden>＋</span>항목 추가</button>;
}

type Extra = "industry" | "link" | "keywords" | "hashtags" | "references" | "cta";
const EXTRA_LABEL: Record<Extra, string> = { industry: "업종", keywords: "꼭 넣을 말", hashtags: "기본 해시태그", references: "참고·경쟁 계정", cta: "기본 행동 유도 (CTA)", link: "프로필 링크" };

export default function BriefEditor({ ws, brief: b0, pillars: p0, presets, goals, templates, defaultTemplateName, isNew, canEdit }: {
  ws: string; brief: Brief; pillars: Pillar[]; presets: Preset[]; goals: string[]; templates: { id: string; name: string }[]; defaultTemplateName: string; isNew: boolean; canEdit: boolean;
}) {
  const [b, setB] = useState(b0);
  const [pillars, setPillars] = useState(p0);
  const [ver, setVer] = useState(0); // 업종 묶음을 넣으면 목록 칸을 다시 그린다
  const [st, setSt] = useState<{ ok?: boolean; error?: string; at?: string } | undefined>(undefined);
  const [pending, start] = useTransition();
  const [newCheck, setNewCheck] = useState("");
  const [addingCheck, setAddingCheck] = useState(false);
  const [openP, setOpenP] = useState<number | null>(null);
  const [extraMenu, setExtraMenu] = useState(false);
  const [extra, setExtra] = useState<Extra[]>(() => (Object.keys(EXTRA_LABEL) as Extra[]).filter((k) => {
    const v = b0[k];
    return (Array.isArray(v) ? v.length > 0 : !!v) || (k === "industry" && isNew);
  }));
  const first = useRef(true);
  const rules: ContentRules = { ...NO_RULES, ...b.rules };
  const total = pillars.reduce((a, p) => a + p.share, 0);
  const sumErr = pillars.length > 0 && total !== 100 ? `기둥 비중 합이 ${total}%예요. 100%로 맞추면 저장돼요` : "";
  const checks = b.checklist ?? [];
  // 자동 저장: 고치고 0.9초 뒤 (기둥 비중 합이 100이 아니면 기다린다)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!canEdit) return;
    if (pillars.length && pillars.reduce((a, p) => a + p.share, 0) !== 100) return; // 합이 100 이 될 때까지 기다린다 (안내는 sumErr)
    const t = setTimeout(() => start(async () => {
      const fd = new FormData();
      fd.set("ws", ws); fd.set("body", JSON.stringify({ brief: b, pillars }));
      const r = await saveBriefAction(undefined, fd);
      setSt(r?.ok ? { ok: true, at: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) } : r);
    }), 900);
    return () => clearTimeout(t);
  }, [b, pillars, ws, canEdit]);
  const set = (patch: Partial<Brief>) => setB((x) => ({ ...x, ...patch }));
  const setP = (i: number, patch: Partial<Pillar>) => setPillars((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const applyPreset = (id: string) => {
    const pr = presets.find((p) => p.id === id);
    if (!pr) return set({ industry: id });
    if (pillars.length && !confirm(`'${pr.name}' 시작 묶음으로 기둥·말투·목표·해시태그를 바꿀까요? (지금 기둥은 사라져요)`)) return set({ industry: id });
    set({ industry: id, tone: pr.tone, goals: [...pr.goals], hashtags: [...pr.hashtags] });
    setPillars(pr.pillars.map((p) => ({ ...p, examples: [...p.examples] })));
    setExtra((x) => (x.includes("hashtags") ? x : [...x, "hashtags"]));
    setOpenP(null);
    setVer((v) => v + 1);
  };
  const even = () => setPillars((ps) => ps.map((p, i) => ({ ...p, share: Math.floor(100 / ps.length) + (i < 100 % ps.length ? 1 : 0) })));
  const hidden = (Object.keys(EXTRA_LABEL) as Extra[]).filter((k) => !extra.includes(k));
  const status = !canEdit ? "보기만 할 수 있어요" : pending ? "저장하는 중…" : st?.ok ? `${st.at}에 저장했어요` : "고치면 바로 저장돼요";
  const err = sumErr || st?.error;

  const extraRow = (k: Extra) => {
    switch (k) {
      case "industry": return (
        <Dl key={k} label="업종" hint="고르면 기둥·말투·해시태그 예시를 채워요">
          <select className="stg-in" value={presets.some((p) => p.id === b.industry) ? b.industry : ""} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">직접 적기 / 고르지 않음</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Dl>);
      case "link": return <Dl key={k} label="프로필 링크"><input className="stg-in" value={b.link} placeholder="https://" onChange={(e) => set({ link: e.target.value })} /></Dl>;
      case "keywords": return <ListInput key={k} label="꼭 넣을 말" value={b.keywords} onChange={(v) => set({ keywords: v })} placeholder="쉼표로 나눠서, 20개까지" />;
      case "hashtags": return <ListInput key={k} label="기본 해시태그" value={b.hashtags} onChange={(v) => set({ hashtags: v })} placeholder="#태그, #태그" hint="편집기에서 한 번에 넣어요 · 30개까지" />;
      case "references": return <ListInput key={k} label="참고·경쟁 계정" value={b.references} onChange={(v) => set({ references: v })} placeholder="@account, 10개까지" />;
      case "cta": return <Dl key={k} label="기본 행동 유도 (CTA)" hint={`${b.cta.length}/60`}><input className="stg-in" maxLength={60} value={b.cta} placeholder="예: 프로필 링크에서 이번 주 모임 보기" onChange={(e) => set({ cta: e.target.value })} /></Dl>;
    }
  };

  return (
    <>
      <div className="col">
        <h1>목적</h1>
        <span className="small muted" role="status" aria-live="polite">누구에게 무엇을 위해 만드는지 적어요. 항목을 누르면 바로 고칠 수 있어요 · {err && canEdit ? <span className="err">{err}</span> : status}</span>
      </div>
      {isNew && <p className="hint">새 서비스를 만들었어요. 브리프를 채우면 AI·MCP 가 이 내용으로 아이디어·초안·캡션을 써요. 나중에 채워도 돼요.</p>}

      <form className="stg-brief" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="stg-fs" disabled={!canEdit}>
          <section className="doc" key={`brief-${ver}`}>
            <h2>서비스 브리프</h2>
            <Dl label="한 줄 소개" hint={`${b.about.length}/300`}><textarea className="stg-in" rows={1} maxLength={300} value={b.about} placeholder="예: 주말마다 같이 걷는 사람을 이어 주는 걷기 모임 플랫폼" onChange={(e) => set({ about: e.target.value })} /></Dl>
            <Dl label="대상" hint={`${b.audience.length}/300`}><textarea className="stg-in" rows={1} maxLength={300} value={b.audience} placeholder="예: 운동은 하고 싶지만 혼자는 어려운 20~30대 직장인" onChange={(e) => set({ audience: e.target.value })} /></Dl>
            <div className="dl stg-dl"><span>목표</span>
              <div className="row">{[...new Set([...goals, ...b.goals])].map((g) => (
                <label key={g} className="chip"><input type="checkbox" checked={b.goals.includes(g)} onChange={(e) => set({ goals: e.target.checked ? [...b.goals, g] : b.goals.filter((x) => x !== g) })} />{g}</label>
              ))}</div>
            </div>
            <Dl label="말투" hint={`${b.tone.length}/200`}><textarea className="stg-in" rows={1} maxLength={200} value={b.tone} placeholder="예: 다정한 존댓말, 이모지 없이, 짧은 문장" onChange={(e) => set({ tone: e.target.value })} /></Dl>
            <ListInput label="쓰지 않는 말" value={b.banned} onChange={(v) => set({ banned: v })} placeholder="예: 최고, 무조건, 100%" hint="과장·금지 표현, 쉼표로" />
            {extra.map(extraRow)}
            {hidden.length > 0 && canEdit && <div className="stg-addwrap">
              <AddRow label="브리프 항목 추가" onClick={() => setExtraMenu((x) => !x)} />
              {extraMenu && <div className="row">{hidden.map((k) => <button key={k} type="button" className="chip" onClick={() => { setExtra((x) => [...x, k]); setExtraMenu(false); }}>+ {EXTRA_LABEL[k]}</button>)}</div>}
            </div>}
          </section>

          <section className="doc" key={`pillars-${ver}`}>
            <h2>콘텐츠 기둥</h2>
            <div className="dl stg-dl"><span>비중 <em>· 기둥을 누르면 고쳐요</em></span>
              {pillars.map((p, i) => (
                <div key={i} className="stg-pillar">
                  <button type="button" className="stg-prow" aria-expanded={openP === i} onClick={() => setOpenP(openP === i ? null : i)}>
                    <b className="stg-pname">{p.name || "이름 없음"}</b>
                    <span className="stg-bar" aria-hidden><span style={{ width: `${Math.max(0, Math.min(100, p.share))}%` }} /></span>
                    <span className="stg-pct">{p.share}%</span>
                    <span className="small muted stg-pdesc">{p.description}</span>
                  </button>
                  {openP === i && <div className="stg-pedit">
                    <div className="row">
                      <label className="fld" style={{ flex: 2, minWidth: 140 }}>이름<input className="input" maxLength={20} value={p.name} onChange={(e) => setP(i, { name: e.target.value })} /></label>
                      <label className="fld" style={{ width: 110 }}>비중 %<input className="input" type="number" min={0} max={100} value={p.share} onChange={(e) => setP(i, { share: Number(e.target.value) })} /></label>
                      <label className="fld" style={{ flex: 1, minWidth: 120 }}>기본 템플릿
                        <select className="input" value={p.template} onChange={(e) => setP(i, { template: e.target.value })}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                      </label>
                    </div>
                    <label className="fld">설명<input className="input" maxLength={200} value={p.description} onChange={(e) => setP(i, { description: e.target.value })} /></label>
                    <label className="fld">예시 주제 <em>한 줄에 하나, 5개까지 · 주제 화면에서 바로 꺼내 써요</em>
                      <textarea className="input" rows={2} value={p.examples.join("\n")} onChange={(e) => setP(i, { examples: e.target.value.split("\n").slice(0, 5) })} /></label>
                    <div className="row">
                      <button type="button" className="btn" onClick={() => setOpenP(null)}>닫기</button>
                      <button type="button" className="btn" aria-label={`${p.name} 기둥 빼기`} onClick={() => { setPillars((ps) => ps.filter((_, j) => j !== i)); setOpenP(null); }}>기둥 빼기</button>
                    </div>
                  </div>}
                </div>
              ))}
              {!pillars.length && <p className="small muted stg-p">업종을 고르거나 직접 더해서 기둥을 만들어요. 3~5개가 알맞아요.</p>}
              <p className="small muted stg-p stg-sum">
                <span className={sumErr ? "err" : undefined}>합 {total}%</span> · 기둥 이름 = 게시물 카테고리
                {pillars.length > 1 && canEdit && <button type="button" className="stg-link" onClick={even}>똑같이 나누기</button>}
              </p>
            </div>
            {canEdit && <AddRow label="기둥 추가" disabled={pillars.length >= 8} onClick={() => { setPillars((ps) => [...ps, { name: "", description: "", share: 0, template: templates[0].id, examples: [] }]); setOpenP(pillars.length); }} />}
          </section>

          <section className="doc">
            <h2>콘텐츠 규칙 · 어기면 편집기에서 알려 줘요 (저장은 돼요)</h2>
            <div className="dl stg-dl"><span>켜 둔 규칙 {Object.values(rules).filter(Boolean).length}</span>
              {(Object.keys(RULE_LABEL) as (keyof ContentRules)[]).map((k) => (
                <label key={k} className="stg-rule">
                  <input type="checkbox" role="switch" checked={rules[k]} onChange={(e) => set({ rules: { ...rules, [k]: e.target.checked } })} />
                  <span><b>{RULE_LABEL[k].label}</b><br /><span className="small muted">{k === "templateOnly" ? `기본 틀(${defaultTemplateName})과 다르면 알려 줘요 · 기본 틀은 4 템플릿 탭에서 바꿔요` : RULE_LABEL[k].note}</span></span>
                </label>
              ))}
            </div>
          </section>

          <section className="doc">
            <h2>승인 체크리스트 · 모두 체크하면 승인할 수 있어요</h2>
            <div className="dl stg-dl"><span>항목 {DEFAULT_CHECKS.length + checks.length} <em>· 기본 항목은 모든 서비스에 늘 들어가요 · {CHECKS_MAX}개까지 더할 수 있어요</em></span>
              <ul className="stg-ul">
                {DEFAULT_CHECKS.map((c) => <li key={c}>{c} <span className="small muted">· 기본</span></li>)}
                {checks.map((c, i) => (
                  <li key={i}>{c} <span className="small muted">· 이 서비스에서 더함</span>
                    {canEdit && <button type="button" className="stg-link" aria-label={`'${c}' 빼기`} onClick={() => set({ checklist: checks.filter((_, j) => j !== i) })}>빼기</button>}</li>
                ))}
              </ul>
              {addingCheck && <div className="row">
                <input className="input" style={{ flex: 1, minWidth: 200 }} maxLength={80} value={newCheck} autoFocus placeholder="예: 부상 주제면 '아프면 병원' 한 줄" onChange={(e) => setNewCheck(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newCheck.trim() && checks.length < CHECKS_MAX) { e.preventDefault(); set({ checklist: [...checks, newCheck.trim()] }); setNewCheck(""); } }} />
                <button type="button" className="btn" disabled={!newCheck.trim() || checks.length >= CHECKS_MAX} onClick={() => { set({ checklist: [...checks, newCheck.trim()] }); setNewCheck(""); }}>더하기</button>
              </div>}
              <p className="small muted stg-p">스튜디오가 확인할 수 있는 것(인스타 마진·규칙 경고·&apos;확인 필요&apos; 자료)은 승인 창 위에 보여 줘요.</p>
            </div>
            {canEdit && !addingCheck && <AddRow label="체크리스트 항목 추가" disabled={checks.length >= CHECKS_MAX} onClick={() => setAddingCheck(true)} />}
          </section>
        </fieldset>

        <div className="row">
          {isNew && <Link className="btn" href={`/w/${ws}`}>나중에 하기</Link>}
          <Link className="btn" href={`/w/${ws}/research`}>다음: 자료 조사 →</Link>
        </div>
      </form>
    </>
  );
}
