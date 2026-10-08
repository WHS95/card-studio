"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "./Icon";
import AskAi from "../AskAi";
import { aiChatAction } from "../actions";

// 오른쪽 AI 패널: AI·MCP 가 한 일(작업 기록 카드) + 대화. 대화는 이 탭에만 남는다(새로 고침해도 sessionStorage).
// 연결이 없으면 설정 안내와 '내 AI 구독으로 하기'(MCP).

type Card = { id: string; at: string; via: "ai" | "mcp"; who: string; title: string; lines: string[] };
type Turn = { role: "user" | "assistant"; text: string; error?: boolean };
const KEY = "cs-ai-panel";

const EV = "cs-ai-toggle";
/** 패널 열고 닫기 (html[data-ai] + 이 브라우저에 기억). 버튼·시트 닫기가 같이 쓴다 */
function setAi(off: boolean) {
  document.documentElement.dataset.ai = off ? "off" : "on";
  try { localStorage.setItem(KEY, off ? "off" : "on"); } catch { /* 저장소 없음 */ }
  window.dispatchEvent(new CustomEvent(EV, { detail: off }));
}

/** 위 오른쪽 'AI 패널 열고 닫기' — 넓은 화면은 기본 열림, 좁은 화면(≤900px)은 오른쪽 아래 'AI' 버튼 + 아래 시트 */
export function PanelToggle() {
  const [off, setOff] = useState(false);
  useEffect(() => {
    let v: string | null = null;
    try { v = localStorage.getItem(KEY); } catch { /* 저장소 없음 */ }
    const o = v ? v === "off" : window.matchMedia("(max-width: 900px)").matches;
    document.documentElement.dataset.ai = o ? "off" : "on";
    const id = requestAnimationFrame(() => setOff(o));
    const on = (e: Event) => setOff(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(EV, on);
    return () => { cancelAnimationFrame(id); window.removeEventListener(EV, on); };
  }, []);
  return (
    <button type="button" className="tool ai-toggle" aria-label={off ? "AI 패널 열기" : "AI 패널 닫기"} title="AI 패널 열고 닫기" aria-pressed={!off} onClick={() => { setOff(!off); setAi(!off); }}>
      <Icon name="panel" className="ai-toggle-panel" /><Icon name="spark" className="ai-toggle-spark" /><span className="tool-ai">AI</span>
    </button>
  );
}

/** 위 고정 줄(서비스 이름·단계 탭·지금 할 일)의 높이 → --svc-top. AI 패널·편집기 미리보기의 sticky top 이 이 값을 쓴다 */
export function SvcTopWatch() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".svc-top");
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--svc-top", `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return null;
}

export default function AiPanel({ ws, ctx, ready, canChat, who, admin, cards }: { ws: string; ctx: string; ready: boolean; canChat: boolean; who: string; admin: boolean; cards: Card[] }) {
  const store = `cs-ai-chat:${ws}`;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let saved: Turn[] = [];
    try { saved = JSON.parse(sessionStorage.getItem(store) ?? "[]"); } catch { /* 없음 */ }
    const id = requestAnimationFrame(() => setTurns(saved));
    return () => cancelAnimationFrame(id);
  }, [store]);
  useEffect(() => { try { sessionStorage.setItem(store, JSON.stringify(turns.slice(-20))); } catch { /* 없음 */ } end.current?.scrollIntoView({ block: "nearest" }); }, [turns, store]);

  const send = () => {
    const t = text.trim();
    if (!t || pending) return;
    const next = [...turns, { role: "user" as const, text: t }];
    setTurns(next); setText("");
    start(async () => {
      const r = await aiChatAction({ ws, ctx, history: next.filter((x) => !x.error).map(({ role, text }) => ({ role, text })) });
      setTurns((x) => [...x, r?.ok ? { role: "assistant", text: r.ok.text || "(AI가 빈 답을 보냈어요. 다시 물어봐 주세요)" } : { role: "assistant", text: r?.error ?? "답을 받지 못했어요. 잠시 뒤 다시 보내 주세요", error: true }]);
      router.refresh();
    });
  };
  const time = (s: string) => new Date(s).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });

  return (
    <aside className="ai" aria-label="AI">
      <div className="ai-head">
        <span className="ai-grip" aria-hidden />
        <Icon name="spark" size={16} /><b>AI</b><span className="ai-who">{who}</span>
        <button type="button" className="linkbtn" onClick={() => setTurns([])} disabled={!turns.length}><Icon name="plus" size={14} />새 대화</button>
        <button type="button" className="tool ai-close" aria-label="AI 패널 닫기" onClick={() => setAi(true)}><Icon name="close" size={16} /></button>
      </div>
      <div className="ai-feed">
        {[...cards].reverse().map((c) => (
          <div key={c.id} className="ai-card">
            <div className="ai-card-top"><Icon name="spark" size={14} /><span className="ai-card-kind">{c.via === "ai" ? "AI 패널" : "MCP"} · {c.who}</span><span className="ai-state">{c.via === "ai" ? "반영됨" : "기록"}</span></div>
            <b>{c.title}</b>
            {c.lines.map((l, i) => <p key={i}>{l}</p>)}
            <span className="ai-time">{time(c.at)}</span>
          </div>
        ))}
        {!cards.length && !turns.length && <p className="small muted" style={{ margin: 0 }}>AI나 내 Claude·ChatGPT(MCP)가 이 서비스에서 한 일이 여기 카드로 쌓여요.</p>}
        {turns.map((t, i) => <div key={i} className={`bubble ${t.role === "user" ? "me" : ""}${t.error ? " err-b" : ""}`}>{t.text}</div>)}
        {pending && <div className="bubble">작업하는 중… (도구를 쓰면 몇십 초 걸려요)</div>}
        <div ref={end} />
      </div>
      {ready && canChat ? (
        <div className="ai-box">
          <label htmlFor="ai-in" className="ai-lab">AI에게 메시지 · ⌘Enter로 보내요</label>
          <textarea id="ai-in" className="input" rows={2} value={text} placeholder="예: 승인된 주제 3개로 초안 써 줘" disabled={pending}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
          <div className="ai-row">
            <span className="ai-lab">한 일은 위 카드로 남아요 · 승인은 사람이 해요</span>
            <button type="button" className="send" aria-label="보내기" disabled={pending || !text.trim()} onClick={send}><Icon name="send" /></button>
          </div>
        </div>
      ) : (
        <div className="ai-box ai-off">
          <b>AI 연결 전이에요</b>
          <p className="ai-lab">{admin ? "설정 · AI에서 Claude Code·Codex(구독)나 API 키를 연결하면 여기서 대화로 작업할 수 있어요." : "운영자가 API 키를 연결하면 여기서 대화로 작업할 수 있어요."} 내 Claude·ChatGPT에 이 스튜디오를 붙여(MCP) 작업한 기록도 위에 카드로 보여요.</p>
          <div className="ai-off-row">
            {admin && <Link className="btn primary" href="/settings">설정에서 연결하기</Link>}
            <details className="ai-ask">
              <summary className="btn">내 AI 구독으로 하기</summary>
              <AskAi label="이 요청으로 내 Claude·ChatGPT 열기" prompt={`카드뉴스 스튜디오의 '${ws}' 서비스에서 ${ctx} 작업을 도와줘. get_flow 로 지금 할 일부터 봐 줘.`} />
            </details>
          </div>
        </div>
      )}
    </aside>
  );
}
