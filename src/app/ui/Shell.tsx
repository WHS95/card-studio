import Link from "next/link";
import { getActor, roleIn, can } from "@/lib/auth";
import { flowOf, type StepKey } from "@/lib/flow";
import { listActivity } from "@/lib/store";
import { aiReady, pickVia } from "@/lib/llm";
import { ROLE_LABEL, VIA_LABEL, type Workspace } from "@/lib/types";
import { logoutAction } from "../actions";
import Icon from "./Icon";
import AiPanel, { PanelToggle } from "./AiPanel";

// 0.6 화면 틀: 왼쪽 메뉴(넓게: 전체 화면 / 좁게: 서비스 안) · 서비스 안은 위 8단계 탭(상태 표시) + '지금 할 일' 한 줄 + 오른쪽 AI 패널.
// 흑백만 쓴다 (서비스 색은 카드 안에서만).

const NAV = [
  { k: "home", href: "/", label: "홈", icon: "home" },
  { k: "fav", href: "/?fav=1", label: "즐겨찾기", icon: "star" },
  { k: "templates", href: "/templates", label: "템플릿", icon: "tpl" },
  { k: "guide", href: "/guide", label: "가이드", icon: "book" },
  { k: "plans", href: "/plans", label: "요금제", icon: "card" },
] as const;
export type NavKey = (typeof NAV)[number]["k"] | "settings" | "connect" | "account" | "";

async function Me({ compact }: { compact?: boolean }) {
  const actor = await getActor();
  if (!actor) return null;
  const first = actor.name.slice(0, 1);
  return compact ? (
    <Link href="/account" className="me-dot" aria-label={`내 계정 · ${actor.name}`} title={actor.name}>{first}</Link>
  ) : (
    <div className="me">
      <Link href="/account" className="me-row"><span className="me-dot" aria-hidden>{first}</span><span>{actor.name}</span></Link>
      <form action={logoutAction}><button className="side-link" style={{ width: "100%" }}><Icon name="logout" />로그아웃</button></form>
    </div>
  );
}

/** 전체 화면 (홈·즐겨찾기·템플릿·가이드·요금제·설정·AI 앱 연결·내 계정) */
export async function WideShell({ active = "", children, narrow }: { active?: NavKey; children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="app">
      <aside className="side">
        <Link href="/" className="side-logo"><Icon name="spark" size={22} /><b>카드뉴스 스튜디오</b></Link>
        <nav aria-label="주 메뉴" className="side-nav">
          {NAV.map((n) => <Link key={n.k} href={n.href} className="side-link" aria-current={active === n.k ? "page" : undefined}><Icon name={n.icon} />{n.label}</Link>)}
        </nav>
        <div className="side-foot">
          <Link href="/connect" className="side-link" aria-current={active === "connect" ? "page" : undefined}><Icon name="plug" />AI 앱 연결</Link>
          <Link href="/settings" className="side-link" aria-current={active === "settings" ? "page" : undefined}><Icon name="key" />설정 · AI</Link>
          <Me />
        </div>
      </aside>
      <main className={narrow ? "page page-narrow" : "page"}>
        <nav className="mobile-nav" aria-label="주 메뉴">{NAV.map((n) => <Link key={n.k} href={n.href} className="chip">{n.label}</Link>)}<Link href="/settings" className="chip">설정</Link><Link href="/account" className="chip">내 계정</Link></nav>
        {children}
      </main>
    </div>
  );
}

function SideNarrow() {
  return (
    <aside className="side side-sm">
      <Link href="/" className="side-logo" aria-label="홈"><Icon name="spark" size={22} /></Link>
      <nav aria-label="주 메뉴" className="side-nav">
        {NAV.map((n) => <Link key={n.k} href={n.href} className="side-link" aria-label={n.label} title={n.label}><Icon name={n.icon} /></Link>)}
      </nav>
      <div className="side-foot">
        <Link href="/connect" className="side-link" aria-label="AI 앱 연결" title="AI 앱 연결"><Icon name="plug" /></Link>
        <Link href="/settings" className="side-link" aria-label="설정 · AI" title="설정 · AI"><Icon name="key" /></Link>
        <Me compact />
      </div>
    </aside>
  );
}

/** 서비스 안: 단계 탭 · 지금 할 일 · AI 패널. step 이 "" 이면 탭은 고르지 않은 상태(함께 쓰기·서비스 설정) */
export async function ServiceShell({ ws, step, ctx, children }: { ws: Workspace; step: StepKey | ""; ctx: string; children: React.ReactNode }) {
  const actor = await getActor();
  const role = actor ? roleIn(actor, ws) : null;
  const [flow, activity] = await Promise.all([flowOf(ws), listActivity(ws.id, 20)]);
  const ready = await aiReady(actor);
  const via = ready ? await pickVia("judge", actor) : null;
  const MARK = { done: "✓", doing: "○", todo: "●" } as const;
  const STATE = { done: "됨", doing: "진행 중", todo: "할 일" } as const;
  return (
    <div className="app">
      <SideNarrow />
      <div className="svc">
        <header className="svc-head">
          <div className="svc-name"><Link href="/" aria-label="모든 서비스" className="tool" style={{ minHeight: 28 }}><Icon name="grid" size={16} /></Link><Link href={`/w/${ws.id}/go`}><b>{ws.name}</b></Link><span className="small muted">{ws.handle}{role ? ` · ${ROLE_LABEL[role]}` : ""}</span></div>
          <nav aria-label="단계" className="steps">
            {flow.steps.map((s) => (
              <Link key={s.key} href={s.href} className="step" data-state={s.state} aria-current={s.key === step ? "page" : undefined} title={`${s.n}단계 · ${STATE[s.state]} · ${s.note}`}>
                <span className="mk" aria-hidden>{MARK[s.state]}</span>{s.label}{s.count ? <span className="ct">{s.count}</span> : null}
                <span className="sr">{STATE[s.state]}</span>
              </Link>
            ))}
          </nav>
          <div className="svc-tools">
            {can(role, "manage") && <Link href={`/w/${ws.id}/members`} className="tool"><Icon name="people" /><span>함께 쓰기</span></Link>}
            <a href={`/api/ws/${ws.id}/export`} className="tool" title="서비스 백업 (JSON: 브리프·기둥·게시물·주제·자료)"><Icon name="export" /><span>내보내기</span></a>
            {can(role, "manage") && <Link href={`/w/${ws.id}/settings`} className="tool" aria-label="서비스 설정" title="서비스 설정"><Icon name="gear" /></Link>}
            <PanelToggle />
          </div>
        </header>
        <div className="now">
          {flow.now ? <><b>지금 할 일</b><span>{flow.now.note}</span><Link href={flow.now.href}>{flow.now.label} →</Link></> : <><b>지금 할 일</b><span>막힌 단계가 없어요</span></>}
          <span className="sp small muted">8단계 중 됨 {flow.counts.done} · 진행 중 {flow.counts.doing} · 할 일 {flow.counts.todo}</span>
        </div>
        <div className="svc-body">
          <main className="svc-main">{children}</main>
          <AiPanel ws={ws.id} ctx={ctx} ready={ready} canChat={can(role, "view")} who={via ? `${VIA_LABEL[via.via]}${via.model ? ` · ${via.model}` : ""}` : "연결 안 됨"} admin={actor?.kind === "admin"}
            cards={activity.map((a) => ({ id: a.id, at: a.at, via: a.via, who: a.who, title: a.title, lines: a.lines }))} />
        </div>
      </div>
    </div>
  );
}
