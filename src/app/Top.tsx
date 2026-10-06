import Link from "next/link";
import { getActor, roleIn } from "@/lib/auth";
import { ROLE_LABEL, type Workspace } from "@/lib/types";
import { logoutAction } from "./actions";

const TABS = [
  ["", "달력"],
  ["ideas", "아이디어"],
  ["research", "자료 조사"],
  ["insights", "성과"],
  ["brief", "브리프"],
  ["members", "함께 쓰기"],
  ["settings", "설정"],
] as const;
const OWNER_ONLY = new Set(["members", "settings"]);

/** 위 막대: 서비스 안이면 탭(소유자만 함께 쓰기·설정), 오른쪽에 템플릿·가이드·내 계정 */
export default async function Top({ ws, tab }: { ws?: Workspace; tab?: (typeof TABS)[number][0] | "post" }) {
  const actor = await getActor();
  const role = actor && ws ? roleIn(actor, ws) : null;
  return (
    <header className="top">
      <Link href="/"><b>카드뉴스 스튜디오</b></Link>
      {ws && <>
        <span aria-hidden>/</span>
        <strong className="ws-name">{ws.name}</strong>
        <nav className="tabs" aria-label="서비스 메뉴">
          {TABS.filter(([k]) => !OWNER_ONLY.has(k) || role === "owner").map(([k, label]) => <Link key={k} href={`/w/${ws.id}${k ? `/${k}` : ""}`} aria-current={tab === k ? "page" : undefined}>{label}</Link>)}
        </nav>
      </>}
      <span className="sp row">
        <Link href="/templates" className="small">템플릿</Link>
        <Link href="/guide" className="small">가이드</Link>
        <Link href="/plans" className="small">요금제</Link>
        {actor?.kind === "admin" && <Link href="/integrations" className="small">AI 연동</Link>}
        {actor && <Link href="/account" className="small" title={actor.kind === "user" ? actor.email : "환경 변수 운영자"}>{actor.name}{role ? ` · ${ROLE_LABEL[role]}` : ""}</Link>}
        <form action={logoutAction}><button className="btn" style={{ minHeight: 32 }}>로그아웃</button></form>
      </span>
    </header>
  );
}
