import Link from "next/link";
import { requireWs } from "@/lib/auth";
import { listArchived, listPosts } from "@/lib/store";
import { nextEmptySlot } from "@/lib/ops";
import { ruleWarnings } from "@/lib/rules";
import { POST_STATUS, STATUS_LABEL, type PostStatus } from "@/lib/types";
import { templateOf } from "@/lib/templates";
import { createPostAction, postToolAction } from "../../actions";
import { ServiceShell } from "../../ui/Shell";
import Icon from "../../ui/Icon";

const dateOf = (start: string, day: number) => { const d = new Date(`${start}T00:00:00+09:00`); d.setDate(d.getDate() + day - 1); return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); };
/** 2026-10-01 → 10/1 */
const md = (iso: string) => { const [, m, d] = iso.slice(0, 10).split("-"); return `${Number(m)}/${Number(d)}`; };

/** 5단계 제작 · 달력: 일차 × 시간대. 빈칸을 누르면 기획 게시물을 만들고 편집기로. ?view=grid 그리드 · ?view=archive 보관함 · ?s=상태 거르기. ⚠ = 콘텐츠 규칙 경고 */
export default async function Calendar({ params, searchParams }: PageProps<"/w/[ws]">) {
  const { ws } = await params;
  const q = await searchParams;
  const { ws: w } = await requireWs(ws, "view");
  const [posts, archived] = await Promise.all([listPosts(w.id), listArchived(w.id)]);
  const archive = q.view === "archive";
  const grid = !archive && q.view === "grid";
  const warns = Object.fromEntries(posts.map((p) => [p.id, ruleWarnings(w.brief?.rules, w.defaultTemplate, p.template, p.data).length]));
  // 기둥 비중: 목표 vs 달력 (건너뜀 제외)
  const live = posts.filter((p) => p.status !== "skip");
  const mix = (w.pillars ?? []).map((p) => ({ name: p.name, target: p.share, now: live.length ? Math.round((live.filter((x) => x.category === p.name).length / live.length) * 100) : 0 }));
  const filter = POST_STATUS.includes(q.s as PostStatus) ? (q.s as PostStatus) : null;
  const counts = Object.fromEntries(POST_STATUS.map((s) => [s, posts.filter((p) => p.status === s).length]));
  const href = (o: { s?: string | null; view?: string | null }) => {
    const u = new URLSearchParams();
    const s = o.s === undefined ? filter : o.s, v = o.view === undefined ? (grid ? "grid" : null) : o.view;
    if (s) u.set("s", s); if (v) u.set("view", v);
    return `/w/${w.id}${u.size ? `?${u}` : ""}`;
  };
  const free = archive ? await nextEmptySlot(w.id).catch(() => null) : null;
  const tabs = (
    <div className="row">
      <Link className={`chip mk-chip${!grid && !archive ? " on" : ""}`} href={href({ view: null })}>달력</Link>
      <Link className={`chip mk-chip${grid ? " on" : ""}`} href={href({ view: "grid" })}>그리드</Link>
      <Link className={`chip mk-chip${archive ? " on" : ""}`} href={`/w/${w.id}?view=archive`}>보관함 {archived.length}</Link>
    </div>
  );
  const head = archive
    ? { t: "제작 · 보관함", s: "뺀 게시물은 지우지 않고 여기 모여요. 원래 칸이 비어 있으면 그 칸으로, 아니면 고른 칸으로 되살려요. 게시된 것은 뺄 수 없어요." }
    : grid
      ? { t: "제작 · 그리드", s: "프로필에서 보일 순서(새 글이 왼쪽 위). 표지는 3:4로 잘려 좌우 약 34px이 가려져요." }
      : { t: "제작", s: `일차 × 시간대(${w.slots.join(" · ")}). 빈칸을 누르면 기획 게시물, 칸을 누르면 편집기. ⚠ = 규칙 경고` };
  return (
    <ServiceShell ws={w} step="make" ctx={archive ? "제작 · 보관함" : grid ? "제작 · 그리드" : "제작 · 달력"}>
      <div className="mk-head"><h1>{head.t}</h1><p>{head.s}</p></div>
      <div className="mk-bar">
        {tabs}
        {!archive && <div className="row">
          <Link className={`chip mk-chip${filter ? "" : " on"}`} href={href({ s: null })}>전체 {posts.length}</Link>
          {POST_STATUS.map((s) => <Link key={s} className={`chip mk-chip${filter === s ? " on" : ""}`} href={href({ s })}>{STATUS_LABEL[s]} {counts[s]}</Link>)}
        </div>}
      </div>
      {typeof q.ok === "string" && <p className="ok">주제 {q.ok}개를 달력에 넣었어요. 칸을 눌러 글을 채워 주세요.</p>}
      {typeof q.error === "string" && <p className="err">{q.error}</p>}
      {!archive && !grid && mix.length > 0 && (
        <div className="mk-mix"><b>기둥 비중 (목표 대비)</b>{mix.map((m) => <span key={m.name}>{m.name} {m.now}/{m.target}%</span>)}</div>
      )}
      {archive ? (
        <>
          {archived.map((p) => (
            <form key={p.id} action={postToolAction} className="mk-row">
              <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="op" value="restore" />
              {p.data
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="mk-thumb" src={`/api/posts/${p.id}/slide/1?png=1&v=${encodeURIComponent(p.updatedAt)}`} alt="" loading="lazy" />
                : <span className="mk-thumb" aria-hidden />}
              <div className="mk-row-main">
                <Link href={`/w/${w.id}/p/${p.id}`} className="mk-row-title">{p.title || "제목 없음"}</Link>
                <span className="small muted">원래 D{p.day} {p.slot} · {STATUS_LABEL[p.status]}{p.archivedAt ? ` · ${md(new Date(p.archivedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }))} 보관함으로` : ""}</span>
              </div>
              <label className="mk-spot">칸
                <select name="spot" className="input" defaultValue="">
                  <option value="">원래 칸 (D{p.day} {p.slot})</option>
                  {free && <option value={`${free.day} ${free.slot}`}>비어 있는 첫 칸 (D{free.day} {free.slot})</option>}
                </select>
              </label>
              <button className="btn primary">되살리기</button>
            </form>
          ))}
          {!archived.length && <p className="hint">보관함이 비었어요. 편집기 아래 &apos;게시물 관리&apos;에서 뺄 수 있어요.</p>}
          <p className="small muted" style={{ margin: 0 }}>보류한 주제는 3 주제 탭의 &apos;보류&apos;에 있어요.</p>
        </>
      ) : grid ? <Grid ws={w.id} posts={posts.filter((p) => p.data && p.status !== "skip" && (!filter || p.status === filter))} /> : (
        <>
          <div id="cal" className="mk-cal">
            {Array.from({ length: w.days }, (_, i) => i + 1).map((d) => (
              <div key={d} className="mk-day">
                <span className="mk-dayhead">D{d}{w.startDate && <em> {md(dateOf(w.startDate, d))}</em>}</span>
                {w.slots.map((s) => {
                  const p = posts.find((x) => x.day === d && x.slot === s);
                  const slot = w.slots.length > 1 ? <em className="mk-slot">{s}</em> : null;
                  if (!p) return (
                    <form key={s} action={createPostAction}><input type="hidden" name="ws" value={w.id} /><input type="hidden" name="day" value={d} /><input type="hidden" name="slot" value={s} />
                      <button className="mk-cell mk-empty" aria-label={`D${d} ${s} 기획 만들기`}>{slot}+ 기획</button></form>
                  );
                  const n = warns[p.id];
                  return (
                    <Link key={s} href={`/w/${w.id}/p/${p.id}`} className="mk-cell" data-s={p.status} data-dim={filter && p.status !== filter ? "" : undefined}
                      title={`${p.category} · ${templateOf(p.template).name}${p.data ? ` · ${p.data.slides.length}장` : ""}${p.data?.photos.some((x) => x.kind === "video") ? " · 영상" : ""}${n ? ` · 규칙 경고 ${n}` : ""}`}>
                      <span className="mk-st">{STATUS_LABEL[p.status]}{n ? <span role="img" aria-label={`규칙 경고 ${n}`} className="mk-warn"><Icon name="warn" size={12} /></span> : null}{slot}</span>
                      <span className="mk-t">{p.title || "제목 없음"}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="small muted" style={{ margin: 0 }}>{w.startDate ? `1일차 = ${md(w.startDate)} · ${w.days}일 · 시간대·일수는 서비스 설정에서.` : `${w.days}일 · 서비스 설정에서 1일차 날짜를 정하면 칸마다 날짜가 붙어요. 시간대·일수도 서비스 설정에서.`}</p>
        </>
      )}
    </ServiceShell>
  );
}

/** 인스타 프로필처럼: 가장 늦은 게시물이 왼쪽 위, 표지를 3:4로 잘라서 */
function Grid({ ws, posts }: { ws: string; posts: Awaited<ReturnType<typeof listPosts>> }) {
  const list = [...posts].reverse().slice(0, 30);
  return (
    <>
      <div className="mk-grid">
        {list.map((p) => (
          <Link key={p.id} href={`/w/${ws}/p/${p.id}`} title={p.title}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/posts/${p.id}/slide/1?png=1&v=${encodeURIComponent(p.updatedAt)}`} alt={p.title} loading="lazy" />
            <span>D{p.day} {STATUS_LABEL[p.status]}</span>
          </Link>
        ))}
      </div>
      {list.length ? <p className="small muted" style={{ margin: 0 }}>최대 30개 · 건너뜀 제외</p> : <p className="hint">내용이 있는 게시물이 아직 없어요</p>}
    </>
  );
}
