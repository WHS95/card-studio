"use client";

import { useActionState, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { aiConfigAction } from "../actions";
import { AI_TIERS, AI_VIA, TIER_LABEL, VIA_LABEL, type AiConfig, type AiTier, type AiVia, type TierSetting } from "@/lib/types";
import Icon from "../ui/Icon";

type Status = Record<AiVia, { ok: boolean; note: string }>;
const VIA_NOTE: Record<AiVia, string> = {
  "claude-code": "설치·로그인된 Claude Code 를 실행해요. 키·결제 정보 없이. 운영자 본인만.",
  codex: "설치·로그인된 Codex CLI 를 실행해요. 키·결제 정보 없이. 운영자 본인만.",
  anthropic: "직접 발급받은 키로 호출해요. 쓴 만큼 요금. 함께 쓰는 계정도 이 키를 써요.",
  openai: "직접 발급받은 키로 호출해요. 쓴 만큼 요금. 함께 쓰는 계정도 이 키를 써요.",
};
const VIA_TITLE: Record<AiVia, string> = { "claude-code": "Claude 구독 · 이 Mac 의 Claude Code", codex: "ChatGPT 구독 · 이 Mac 의 Codex", anthropic: "Anthropic API 키", openai: "OpenAI API 키" };
const ICON: Record<AiTier, string> = { judge: "brain", write: "pen", polish: "brush" };

type PresetKind = "best" | "save" | "max";
const PRESETS: [PresetKind, string, string][] = [["best", "최적 (기본)", "판단은 강한 모델, 쓰기·다듬기는 빠른 모델"], ["save", "절약", "판단만 강하게, 나머지는 한 단계씩 낮춤"], ["max", "최대 품질", "모두 강하게 · 시간·사용량 더 듦"]];
const PLAN: Record<PresetKind, [number, string][]> = { best: [[1, "high"], [2, "medium"], [3, "low"]], save: [[1, "medium"], [3, "low"], [3, "low"]], max: [[0, "high"], [1, "high"], [2, "medium"]] };

/** AI 연결 + 작업별 모델 (운영자) */
export default function AiSettings({ cfg, status, models, cli }: { cfg: AiConfig; status: Status; models: Record<AiVia, { id: string; label: string }[]>; cli: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState<AiVia[]>(cfg.enabled);
  const [tiers, setTiers] = useState(cfg.tiers);
  const [st, act, pending] = useActionState(aiConfigAction, undefined);
  const [last, setLast] = useState<"save" | AiVia>("save"); // 결과를 어디에 보여 줄지 (누른 버튼 옆)
  const msg = (where: "save" | AiVia) => (last !== where ? null : pending ? <p className="small muted" style={{ margin: 0 }}>{where === "save" ? "저장하는 중" : "확인하는 중… (몇 초 걸려요)"}</p> : st?.error ? <p className="err">{st.error}</p> : st?.ok ? <p className="ok">{st.ok}</p> : null);
  const setT = (k: AiTier, p: Partial<TierSetting>) => setTiers((t) => ({ ...t, [k]: { ...t[k], ...p } }));
  const planOf = (kind: PresetKind): AiConfig["tiers"] => {
    const via = tiers.judge.via;
    const list = models[via];
    const m = (i: number) => list[Math.min(i, list.length - 1)]?.id ?? "";
    return Object.fromEntries(AI_TIERS.map((k, i) => [k, { via, model: list.length ? m(PLAN[kind][i][0]) : tiers[k].model, effort: PLAN[kind][i][1] }])) as AiConfig["tiers"];
  };
  // 지금 값이 어느 묶음과 같은지 (같은 게 있으면 그 카드를 진하게)
  const same = (a: AiConfig["tiers"]) => AI_TIERS.every((k) => a[k].via === tiers[k].via && a[k].model === tiers[k].model && a[k].effort === tiers[k].effort);
  const picked = PRESETS.find(([k]) => same(planOf(k)))?.[0];
  return (
    // form action 은 끝나면 폼을 처음 값으로 되돌려서(React) 직접 보낸다 — 고른 값이 그대로 보이게
    <form className="w-stack" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter); startTransition(() => act(fd)); }}>
      <section className="sect w-lg">
        <h2>AI 연결 · 여러 개 켜 둘 수 있어요</h2>
        <div className="w-vias">
          {AI_VIA.map((v) => {
            const sub = v === "claude-code" || v === "codex";
            const off = sub && !cli;
            return (
              <label key={v} className="w-via" data-off={off || undefined}>
                <span className="w-via-top"><input type="checkbox" name={`on.${v}`} checked={on.includes(v)} disabled={off} onChange={(e) => setOn((x) => (e.target.checked ? [...x, v] : x.filter((y) => y !== v)))} />
                  <b>{VIA_TITLE[v]}</b><span className="w-via-st">{status[v].ok ? <b><Icon name="check" size={14} /> {status[v].note}</b> : <span className="muted">{status[v].note}</span>}</span></span>
                <span className="small muted">{VIA_NOTE[v]}</span>
                {status[v].ok && <button className="btn w-btn-sm" name="op" value={`test:${v}`} onClick={() => setLast(v)} disabled={pending}>실제로 대화해서 확인</button>}
                {msg(v)}
              </label>
            );
          })}
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => router.refresh()}>
            <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M16 10 a6 6 0 1 1 -1.8 -4.3 M16 3.5 V6 H13.5" /></svg> 연결 다시 확인</button>
          <span className="small muted">모델 목록은 연결마다 불러와요 (Claude Code·Codex 가 알려 준 목록, API 는 키로 조회)</span>
        </div>
        <p className="w-note">구독 연결(Claude Code·Codex)은 운영자 본인이 이 Mac 에서 쓸 때만 켜져요. 스튜디오는 로그인 토큰을 받지 않고 프로그램을 실행만 해요. 함께 쓰는 계정·MCP 로 들어온 요청은 구독 연결을 쓰지 않아요(그쪽은 API 키 또는 각자 AI 구독). 배포한 서버에서는 구독 연결이 보이지 않아요. 구독으로 쓴 AI 는 요금제 횟수에 세지 않아요.</p>
      </section>
      <section className="sect w-lg">
        <h2>작업별 모델 배치</h2>
        <p className="small muted w-m0 w-lh">판단이 틀리면 뒤가 다 틀어지는 작업은 강한 모델로, 정해진 틀을 채우는 작업은 빠른 모델로. 등급마다 켜 둔 연결 중 하나와 그 모델을 골라요. 고른 연결을 못 쓰는 요청(예: 함께 쓰는 계정)은 켜 둔 API 키 연결로 바뀌어요.</p>
        <div className="w-presets">
          {PRESETS.map(([k, t, d]) => (
            <button key={k} type="button" className="w-preset" aria-pressed={picked === k} onClick={() => setTiers(planOf(k))}><b>{t}</b><span className="small muted">{d}</span></button>
          ))}
        </div>
        {AI_TIERS.map((k, i) => {
          const t = tiers[k];
          const list = models[t.via];
          return (
            <div key={k} className="w-tier">
              <div className="w-tier-head">
                <span className="pill dark">{"ABC"[i]}</span><Icon name={ICON[k]} />
                <div className="col" style={{ gap: 6 }}><b>{TIER_LABEL[k].name}</b><span className="small muted">{TIER_LABEL[k].note}</span><span className="tagrow">{TIER_LABEL[k].jobs.map((j) => <span key={j} className="w-job">{j}</span>)}</span></div>
              </div>
              <label className="fld">연결<select name={`${k}.via`} className="input" value={t.via} onChange={(e) => setT(k, { via: e.target.value as AiVia, model: models[e.target.value as AiVia][1]?.id ?? models[e.target.value as AiVia][0]?.id ?? "" })}>
                {AI_VIA.map((v) => <option key={v} value={v} disabled={!on.includes(v)}>{VIA_LABEL[v]}{on.includes(v) ? "" : " (꺼짐)"}</option>)}</select></label>
              <label className="fld"><span>모델 {!list.length && <em>{t.via === "codex" ? "비우면 Codex 기본" : "연결하면 목록을 불러와요"}</em>}</span>
                {list.length ? <select name={`${k}.model`} className="input" value={t.model} onChange={(e) => setT(k, { model: e.target.value })}>{!list.some((m) => m.id === t.model) && t.model && <option value={t.model}>{t.model}</option>}{list.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
                  : <input name={`${k}.model`} className="input" value={t.model} onChange={(e) => setT(k, { model: e.target.value })} placeholder="모델 이름" />}</label>
              <label className="fld">노력<select name={`${k}.effort`} className="input" value={t.effort} onChange={(e) => setT(k, { effort: e.target.value as TierSetting["effort"] })}><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option></select></label>
            </div>
          );
        })}
        <div className="row w-savebar"><button className="btn primary" name="op" value="save" disabled={pending} onClick={() => setLast("save")}>저장</button>{msg("save")}</div>
      </section>
    </form>
  );
}
