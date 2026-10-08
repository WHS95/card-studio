"use client";

import type { Field, SlideKind } from "@/lib/fields";
import type { PostData, SlideData } from "@/lib/types";
import Icon from "../../../../ui/Icon";

// 편집기 'AI 초안 쓰는 중' 조각들 (시안: 캔버스 '5 제작 · 편집기 · AI 초안 쓰는 중')
// 흐린 칸 → 글이 써짐 → 그 장 미리보기. 쓰는 동안은 고칠 수 없고, 멈추면 원래 글로 돌아간다.

type Rec = Record<string, unknown>;
export type Drafting = {
  total: number; // AI 가 정한 장 수 (아직 모르면 0)
  slides: SlideData[]; // 다 쓴 장
  partial: Rec | null; // 지금 쓰는 장 (덜 온 것)
  caption: string; // 쓰는 중인 캡션
  phase: "start" | "write" | "caption" | "fixing" | "polish";
  via: string; // 연결 이름 (Claude Code 등)
  before: { data: PostData; dirty: boolean }; // 멈추면 돌아갈 곳
};
export type DraftNote = { kind: "ok" | "stop" | "err"; text: string; sub?: string };

const VIA: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex", anthropic: "Anthropic API", openai: "OpenAI API" };
export const viaName = (v: string) => VIA[v] ?? v;

/** 장 수 (모르면 다 쓴 장 + 1) */
export const draftTotal = (d: Drafting) => Math.max(d.total, d.slides.length + (d.phase === "write" || d.phase === "start" ? 1 : 0));

export function Bar({ w = "100%" }: { w?: string }) {
  return <span className="ed-skel ed-bar" style={{ width: w }} />;
}

/** 위 진행 줄: AI 초안 쓰는 중 · 생성됨 n · 전체 N + 칸 막대 */
export function DraftBar({ d }: { d: Drafting }) {
  const total = draftTotal(d), done = d.slides.length;
  const label = d.phase === "start" ? "AI가 장 수를 정하고 있어요" : d.phase === "caption" ? "캡션을 쓰고 있어요" : d.phase === "fixing" ? "글자 수를 맞추고 있어요" : d.phase === "polish" ? "문구를 다듬고 있어요" : "AI 초안 쓰는 중";
  return (
    <div className="ed-draftbar" role="status" aria-live="polite">
      <Icon name="spark" size={16} />
      <b>{label}</b>
      <span className="ed-note">생성됨 {done} · 전체 {d.total || "…"}</span>
      <span className="ed-segs" aria-hidden>
        {Array.from({ length: Math.max(total, 1) }, (_, i) => <i key={i} data-s={i < done ? "done" : i === done && d.phase === "write" ? "cur" : "wait"} />)}
      </span>
      <span className="ed-note ed-draftbar-r">글이 다 써진 장부터 미리보기가 그려져요 · 저장은 다 끝난 뒤 사람이</span>
    </div>
  );
}

/** 장 목록의 흐린 칸 (쓰는 중 · 기다리는 중) */
export function SkelSlide({ n, cur, fmt }: { n: number; cur: boolean; fmt: string }) {
  return (
    <div className={`ed-slide ed-slide-wait${cur ? " is-cur" : ""}`} aria-label={`${n + 1}장 ${cur ? "쓰는 중" : "기다리는 중"}`}>
      <span className="ed-sthumb ed-skel" data-fmt={fmt} />
      <span className="ed-sinfo">
        <b>{n + 1}</b>
        {cur ? <span>쓰는 중…</span> : <Bar w="70%" />}
      </span>
    </div>
  );
}

/** 가운데: 지금 쓰는 장의 칸들 (읽기만, 마지막으로 바뀐 글 칸에 커서) */
export function TypingCard({ d, kindOf }: { d: Drafting; kindOf: (k: string) => SlideKind | undefined }) {
  const n = d.slides.length;
  const p = d.partial;
  const k = p && typeof p.kind === "string" ? kindOf(p.kind) : undefined;
  if (d.phase === "caption" || d.phase === "fixing" || d.phase === "polish") return (
    <section className="ed-card ed-fields ed-typing">
      <h2>{d.phase === "caption" ? "캡션 · 쓰는 중" : d.phase === "polish" ? "문구 다듬는 중" : "글자 수 맞추는 중"}</h2>
      {d.phase === "caption"
        ? <div className="ed-ro ed-ro-area">{d.caption ? <>{d.caption}<i className="ed-caret" /></> : <><Bar w="80%" /><Bar w="55%" /></>}</div>
        : <p className="ed-note">{d.phase === "polish" ? "문구 규칙(해요체·쉬운 말·강요·과장 없이)에서 고칠 곳이 있었어요. AI가 그 부분만 다듬고 있어요." : "검사에서 칸보다 긴 글이 있었어요. AI가 한 번 더 고치고 있어요."}</p>}
    </section>
  );
  const keys = p ? Object.keys(p) : [];
  const last = keys[keys.length - 1];
  const val = (f: Field, v: unknown, isLast: boolean): React.ReactNode => {
    if (f.type === "text") return typeof v === "string" ? <div className={`ed-ro${(f.lines ?? 1) > 1 ? " ed-ro-area" : ""}`}>{v}{isLast && <i className="ed-caret" />}</div> : null;
    if (f.type === "items") return Array.isArray(v) ? (
      <div className="ed-ro ed-ro-area">{(v as Rec[]).map((it, i) => <div key={i}>{i + 1}. {f.item.filter((x) => x.type === "text").map((x) => String(it?.[x.key] ?? "")).filter(Boolean).join(" · ")}{isLast && i === (v as Rec[]).length - 1 && <i className="ed-caret" />}</div>)}</div>
    ) : null;
    return null;
  };
  return (
    <section className="ed-card ed-fields ed-typing" aria-live="polite">
      <h2>{n + 1}장{k ? ` · ${k.label}` : ""} · 쓰는 중</h2>
      {!k ? <><Bar w="60%" /><Bar w="90%" /><Bar w="75%" /></> : k.fields.map((f) => {
        if (f.type === "photo") return <div key={f.key} className="fld"><span>{f.label}</span><p className="ed-note">지금 고른 사진을 그대로 둬요</p></div>;
        if (f.type !== "text" && f.type !== "items") return null;
        const shown = val(f, p![f.key], f.key === last);
        return (
          <div key={f.key} className="fld">
            <span>{f.label} <em>{shown ? (f.key === last ? "쓰는 중" : "✓") : "기다리는 중"}</em></span>
            {shown ?? <div className="ed-ro ed-ro-wait"><Bar w="92%" /><Bar w="64%" /></div>}
          </div>
        );
      })}
      <p className="ed-note">쓰는 동안은 고칠 수 없어요 · 다 쓰면 장마다 바로 고칠 수 있어요</p>
    </section>
  );
}

/** 아래 알림: 쓰는 중(검정) · 다 씀/멈춤(흰색) */
export function DraftToast({ d, note, onStop, onUndo, onRetry, onClose }: { d: Drafting | null; note: DraftNote | null; onStop: () => void; onUndo: () => void; onRetry: () => void; onClose: () => void }) {
  if (d) {
    const total = draftTotal(d);
    const text = d.phase === "start" ? "AI가 초안을 준비하고 있어요" : d.phase === "caption" ? "캡션을 쓰고 있어요" : d.phase === "fixing" ? "글자 수를 맞추고 있어요" : d.phase === "polish" ? "문구를 다듬고 있어요" : "AI가 초안을 쓰고 있어요";
    const sub = d.phase === "write" ? `${Math.min(d.slides.length + 1, total)}/${d.total || "…"}장` : d.phase === "caption" ? `${d.slides.length}/${d.slides.length}장 다 씀` : "";
    return (
      <div className="ed-toast" role="status" aria-live="polite">
        <span className="ed-spin" aria-hidden /><b>{text}</b>{sub && <span className="ed-toast-sub">{sub}{d.via ? ` · ${viaName(d.via)}` : ""}</span>}
        <button type="button" onClick={onStop}>멈추기</button>
      </div>
    );
  }
  if (!note) return null;
  return (
    <div className="ed-toast is-light" role="status" aria-live="polite">
      {note.kind === "err" ? <Icon name="warn" size={14} /> : <Icon name="check" size={14} />}
      <b>{note.text}</b>{note.sub && <span className="ed-toast-sub">{note.sub}</span>}
      {note.kind === "ok" && <button type="button" onClick={onUndo}>⌘Z 되돌리기</button>}
      {note.kind !== "ok" && <button type="button" onClick={onRetry}>다시 쓰기</button>}
      <button type="button" className="ed-toast-x" aria-label="알림 닫기" onClick={onClose}>×</button>
    </div>
  );
}
