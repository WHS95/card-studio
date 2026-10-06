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

/** 위 오른쪽 'AI 패널 열고 닫기' — 넓은 화면은 기본 열림, 좁은 화면은 아래 시트로 */
export function PanelToggle() {
  const [off, setOff] = useState(false);
  useEffect(() => {
    let v: string | null = null;
    try { v = localStorage.getItem(KEY); } catch { /* 저장소 없음 */ }
    const o = v ? v === "off" : window.matchMedia("(max-width: 900px)").matches;
    document.documentElement.dataset.ai = o ? "off" : "on";
    const id = requestAnimationFrame(() => setOff(o));
    return () => cancelAnimationFrame(id);
  }, []);
  const flip = () => {
    const o = !off;
    setOff(o);
    document.documentElement.dataset.ai = o ? "off" : "on";
    try { localStorage.setItem(KEY, o ? "off" : "on"); } catch { /* 저장소 없음 */ }
  };
  return <button type="button" className="tool" aria-label={off ? "AI 패널 열기" : "AI 패널 닫기"} aria-pressed={!off} onClick={flip}><Icon name="panel" /><span className="tool-ai">AI</span></button>;
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
      setTurns((x) => [...x, r?.ok ? { role: "assistant", text: r.ok.text || "(답이 비었어요)" } : { role: "assistant", text: r?.error ?? "잠시 뒤 다시 해 주세요", error: true }]);
      router.refresh();
    });
  };
  const time = (s: string) => new Date(s).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });

  return (
    <aside className="ai" aria-label="AI">
      <div className="ai-head">
        <Icon name="spark" size={16} /><b>AI</b><span className="small muted ai-who">{who}</span>
        {turns.length > 0 && <button type="button" className="linkbtn" onClick={() => setTurns([])}><Icon name="plus" size={14} />새 대화</button>}
      </div>
      <div className="ai-feed">
        {[...cards].reverse().map((c) => (
          <div key={c.id} className="ai-card">
            <div className="ai-card-top"><Icon name="spark" size={14} />{c.via === "ai" ? "AI 패널" : "MCP"} · {c.who}<span className="ai-state">{c.via === "ai" ? "반영됨" : "기록"}</span></div>
            <b>{c.title}</b>
            {c.lines.map((l, i) => <p key={i}>{l}</p>)}
            <span className="small muted">{time(c.at)}</span>
          </div>
        ))}
        {!cards.length && !turns.length && <p className="small muted" style={{ margin: 0 }}>AI 나 내 Claude·ChatGPT(MCP)가 이 서비스에서 한 일이 여기 카드로 쌓여요.</p>}
        {turns.map((t, i) => <div key={i} className={`bubble ${t.role === "user" ? "me" : ""}${t.error ? " err-b" : ""}`}>{t.text}</div>)}
        {pending && <div className="bubble">작업하는 중… (도구를 쓰면 몇십 초 걸려요)</div>}
        <div ref={end} />
      </div>
      {ready && canChat ? (
        <div className="ai-box">
          <label htmlFor="ai-in" className="small muted">AI에게 메시지 · ⌘Enter 보내기</label>
          <textarea id="ai-in" className="input" rows={2} value={text} placeholder="예: 승인된 주제 3개로 초안 써 줘" disabled={pending}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="small muted">한 일은 위 카드로 남아요 · 승인은 사람이</span>
            <button type="button" className="send" aria-label="보내기" disabled={pending || !text.trim()} onClick={send}><Icon name="send" /></button>
          </div>
        </div>
      ) : (
        <div className="ai-box">
          <b>AI가 연결되지 않았어요</b>
          <p className="small muted" style={{ margin: 0 }}>{admin ? "설정 · AI 에서 이 Mac 의 Claude Code·Codex(구독) 또는 API 키를 연결하면 여기서 대화로 작업해요." : "운영자가 API 키를 연결하면 여기서 대화로 작업해요."} 내 Claude·ChatGPT 에 이 스튜디오를 붙여(MCP) 작업한 기록도 위에 카드로 보여요.</p>
          <div className="row">{admin && <Link className="btn primary" href="/settings">설정에서 연결</Link>}<AskAi label="내 AI 구독으로 하기" prompt={`카드뉴스 스튜디오의 '${ws}' 서비스에서 ${ctx} 작업을 도와줘. get_flow 로 지금 할 일부터 봐 줘.`} /></div>
        </div>
      )}
    </aside>
  );
}
