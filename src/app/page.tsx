import Link from "next/link";
import { requireAuth, roleIn } from "@/lib/auth";
import { getPrefs, listWorkspaces } from "@/lib/store";
import { flowOf } from "@/lib/flow";
import { PRESETS } from "@/lib/presets";
import { createWorkspaceAction, favoriteAction } from "./actions";
import { WideShell } from "./ui/Shell";
import Icon from "./ui/Icon";
import NewService from "./NewService";

/** 홈 · 모든 서비스 (?fav=1 즐겨찾기). 카드: 8단계 진행 띠 · 다음 할 일 · 즐겨찾기 별. 누르면 할 일이 있는 단계로 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const actor = await requireAuth();
  const q = await searchParams;
  const fav = q.fav === "1";
  const prefs = await getPrefs(actor.kind === "admin" ? "admin" : actor.id);
  const all = (await listWorkspaces()).filter((w) => roleIn(actor, w));
  const list = fav ? all.filter((w) => prefs.favorites.includes(w.id)) : all;
  const flows = await Promise.all(list.map((w) => flowOf(w)));
  return (
    <WideShell active={fav ? "fav" : "home"}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{fav ? "즐겨찾기" : "모든 서비스"}</h1>
        <NewService presets={PRESETS.map((p) => ({ id: p.id, name: p.name }))} action={createWorkspaceAction} open={q.new === "1"} />
      </div>
      {typeof q.error === "string" && <p className="err">{q.error}</p>}
      <div className="svc-cards">
        {list.map((w, i) => {
          const f = flows[i];
          const on = prefs.favorites.includes(w.id);
          return (
            <article key={w.id} className="svc-card">
              <div className="hero" aria-hidden>{(w.name.trim()[0] ?? "?").toUpperCase()}</div>
              <form action={favoriteAction} className="fav"><input type="hidden" name="ws" value={w.id} />
                <button aria-pressed={on} aria-label={on ? `${w.name} 즐겨찾기 빼기` : `${w.name} 즐겨찾기`}><Icon name="star" /></button></form>
              <Link href={`/w/${w.id}/go`} style={{ fontSize: 17, fontWeight: 800, textDecoration: "none" }}>{w.name}</Link>
              <p className="small muted clamp2" style={{ margin: 0 }}>{w.handle || "계정 없음"}{w.brief?.about ? ` · ${w.brief.about}` : ""}</p>
              <div className="prog" aria-label={`8단계 중 됨 ${f.counts.done}`}>{f.steps.map((s) => <span key={s.key} data-s={s.state} title={`${s.label} · ${s.note}`} />)}</div>
              <p className="small" style={{ margin: 0 }}><b>다음 할 일</b> {f.now ? f.now.note : "막힌 단계가 없어요"}</p>
            </article>
          );
        })}
      </div>
      {!list.length && <p className="hint">{fav ? "서비스 카드의 별을 누르면 여기 모여요." : "아직 서비스가 없어요. '새 서비스'로 시작해 보세요."}</p>}
      <p className="small muted" style={{ margin: 0 }}>진행 띠 = 8단계(목적·자료 조사·주제·템플릿·제작·검수·발행·성과) · 진한 칸 = 됨 · 흐린 칸 = 진행 중</p>
    </WideShell>
  );
}
