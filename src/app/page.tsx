import Link from "next/link";
import { can, requireAuth, roleIn } from "@/lib/auth";
import { getPrefs, listPosts, listWorkspaces } from "@/lib/store";
import { flowOf } from "@/lib/flow";
import { PRESETS } from "@/lib/presets";
import { PLANS, planOf } from "@/lib/plans";
import { createWorkspaceAction, favoriteAction } from "./actions";
import { WideShell } from "./ui/Shell";
import Icon from "./ui/Icon";
import NewService from "./NewService";

const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(/\.\s?/g, "/").replace(/\/\s*(?=\d{2}:)/, " ");

/** 홈 · 모든 서비스 (?fav=1 즐겨찾기). 카드: 단계 진행 띠 · 다음 할 일 · 즐겨찾기 별 · 더 보기. 누르면 할 일이 있는 단계로 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const actor = await requireAuth();
  const q = await searchParams;
  const fav = q.fav === "1";
  const prefs = await getPrefs(actor.kind === "admin" ? "admin" : actor.id);
  const every = await listWorkspaces();
  const all = every.filter((w) => roleIn(actor, w));
  const list = fav ? all.filter((w) => prefs.favorites.includes(w.id)) : all;
  const [flows, lastEdit] = await Promise.all([
    Promise.all(list.map((w) => flowOf(w))),
    Promise.all(list.map(async (w) => (await listPosts(w.id)).reduce((a, p) => (p.updatedAt > a ? p.updatedAt : a), ""))),
  ]);
  // 새 서비스 창의 '서비스 n개 중 m개' — ops.createWorkspace 와 같은 계산 (운영자는 한도 없음)
  let quota = "";
  if (actor.kind === "user") {
    const owned = every.filter((w) => w.members?.some((m) => m.userId === actor.id && m.role === "owner"));
    const limit = Math.max(PLANS.free.servicesPerOwner, ...owned.map((w) => planOf(w.plan).servicesPerOwner));
    quota = `지금 요금제로 서비스 ${limit}개 중 ${owned.length}개를 썼어요.`;
  }
  return (
    <WideShell active={fav ? "fav" : "home"}>
      <div className="w-home w-titlebar">
        <h1>{fav ? "즐겨찾기" : "모든 서비스"}</h1>
        <span className="w-titlebar-end"><NewService presets={PRESETS.map((p) => ({ id: p.id, name: p.name }))} action={createWorkspaceAction} open={q.new === "1"} quota={quota} /></span>
      </div>
      {typeof q.error === "string" && <p className="err">{q.error}</p>}
      {list.length > 0 && (
        <div className="w-cards">
          {list.map((w, i) => {
            const f = flows[i];
            const on = prefs.favorites.includes(w.id);
            const manage = can(roleIn(actor, w), "manage");
            return (
              <article key={w.id} className="w-card">
                <div className="w-hero">
                  <Link href={`/w/${w.id}/go`} className="w-hero-link" aria-hidden tabIndex={-1}>{(w.name.trim()[0] ?? "?").toUpperCase()}</Link>
                  <span className="w-hero-tools">
                    <form action={favoriteAction}><input type="hidden" name="ws" value={w.id} />
                      <button className="tool" aria-pressed={on} aria-label={on ? `${w.name} 즐겨찾기에서 빼기` : `${w.name} 즐겨찾기에 넣기`} title={on ? "즐겨찾기에서 빼기" : "즐겨찾기에 넣기"}><Icon name="star" /></button></form>
                    <details className="w-more">
                      <summary className="tool" aria-label={`${w.name} 더 보기`} title="더 보기">
                        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx="5" cy="10" r="1.2" /><circle cx="10" cy="10" r="1.2" /><circle cx="15" cy="10" r="1.2" /></svg>
                      </summary>
                      <div className="w-menu">
                        <Link href={`/w/${w.id}/go`}>할 일 단계로 열기</Link>
                        <Link href={`/w/${w.id}`}>제작 목록</Link>
                        {manage && <Link href={`/w/${w.id}/settings`}>서비스 설정</Link>}
                        {manage && <Link href={`/w/${w.id}/members`}>함께 쓰기</Link>}
                        {manage && <a href={`/api/ws/${w.id}/export`}>JSON으로 내려받기</a>}
                      </div>
                    </details>
                  </span>
                </div>
                <Link href={`/w/${w.id}/go`} className="w-card-name">{w.name}</Link>
                <p className="small muted clamp2 w-m0">{w.handle || "계정 없음"}{w.brief?.about ? ` · ${w.brief.about}` : ""}</p>
                <div className="prog" aria-label={`${f.steps.length}단계 중 ${f.counts.done}단계 마침`}>{f.steps.map((s) => <span key={s.key} data-s={s.state} title={`${s.label} · ${s.note}`} />)}</div>
                <p className="small w-m0"><b>다음 할 일</b> {f.now ? f.now.note : "막힌 단계가 없어요"}</p>
                {lastEdit[i] && <p className="small muted w-m0">{when(lastEdit[i])} 고침</p>}
              </article>
            );
          })}
        </div>
      )}
      {!list.length && <p className="hint">{fav ? "서비스 카드의 별을 누르면 여기 모여요." : "'새 서비스'를 눌러 첫 서비스를 만들어 보세요."}</p>}
      <p className="small muted w-m0">{fav ? "별을 누른 서비스만 모여요." : "카드를 누르면 할 일이 있는 단계로 열려요. 띠는 목적부터 제작까지 5단계이고, 진하게 칠한 곳이 마친 단계예요."}</p>
    </WideShell>
  );
}
