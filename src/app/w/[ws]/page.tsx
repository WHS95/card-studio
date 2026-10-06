import { Fragment } from "react";
import Link from "next/link";
import { requireWs } from "@/lib/auth";
import { listArchived, listIdeas, listPosts, listResearch } from "@/lib/store";
import { briefDone } from "@/lib/presets";
import { POST_STATUS, STATUS_LABEL, type PostStatus } from "@/lib/types";
import { templateOf } from "@/lib/templates";
import { createPostAction, postToolAction } from "../../actions";
import Top from "../../Top";

const dateOf = (start: string, day: number) => { const d = new Date(`${start}T00:00:00+09:00`); d.setDate(d.getDate() + day - 1); return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); };

/** 달력: 일차 × 시간대. 빈칸을 누르면 기획 게시물을 만들고 편집기로. ?view=grid 프로필 그리드 미리보기, ?s=상태 거르기 */
export default async function Calendar({ params, searchParams }: PageProps<"/w/[ws]">) {
  const { ws } = await params;
  const q = await searchParams;
  const { ws: w } = await requireWs(ws, "view");
  const [posts, ideas, research, archived] = await Promise.all([listPosts(w.id), listIdeas(w.id), listResearch(w.id), listArchived(w.id)]);
  const archive = q.view === "archive";
  // 시작하기 체크리스트 (다 하면 숨김)
  const steps: [string, boolean, string][] = [
    ["브리프", briefDone(w.brief), "brief"], ["기둥", !!w.pillars?.length, "brief"], ["자료 1개", research.length > 0, "research"],
    ["아이디어 3개", ideas.length >= 3, "ideas"], ["첫 초안", posts.some((p) => p.data), ""], ["첫 승인", posts.some((p) => p.status === "approved" || p.status === "posted"), ""],
    ["첫 게시", posts.some((p) => p.status === "posted"), ""],
  ];
  const left = steps.filter((x) => !x[1]).length;
  // 기둥 비중: 목표 vs 달력 (건너뜀 제외)
  const live = posts.filter((p) => p.status !== "skip");
  const mix = (w.pillars ?? []).map((p) => ({ name: p.name, target: p.share, now: live.length ? Math.round((live.filter((x) => x.category === p.name).length / live.length) * 100) : 0 }));
  const filter = POST_STATUS.includes(q.s as PostStatus) ? (q.s as PostStatus) : null;
  const grid = q.view === "grid";
  const counts = Object.fromEntries(POST_STATUS.map((s) => [s, posts.filter((p) => p.status === s).length]));
  const href = (o: { s?: string | null; view?: string | null }) => {
    const u = new URLSearchParams();
    const s = o.s === undefined ? filter : o.s, v = o.view === undefined ? (grid ? "grid" : null) : o.view;
    if (s) u.set("s", s); if (v) u.set("view", v);
    return `/w/${w.id}${u.size ? `?${u}` : ""}`;
  };
  return (
    <>
      <Top ws={w} tab="" />
      <main className="wrap">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>{w.name} · {w.days}일 × 하루 {w.slots.length}개</h1>
          <div className="row">
            <Link className={grid ? "btn" : "btn primary"} href={href({ view: null })}>달력</Link>
            <Link className={grid ? "btn primary" : "btn"} href={href({ view: "grid" })}>그리드 미리보기</Link>
            <Link className={archive ? "btn primary" : "btn"} href={`/w/${w.id}?view=archive`}>보관함 {archived.length}</Link>
            <a className="btn" href={`/api/ws/${w.id}/export`} title="서비스·게시물·아이디어·자료를 JSON 하나로 (백업)">내보내기</a>
          </div>
        </div>
        <div className="row">
          <Link className={`chip${filter ? "" : " on"}`} href={href({ s: null })}>전체 {posts.length}</Link>
          {POST_STATUS.map((s) => <Link key={s} className={`chip${filter === s ? " on" : ""}`} href={href({ s })}>{STATUS_LABEL[s]} {counts[s]}</Link>)}
        </div>
        {left > 0 && (
          <div className="block">
            <div className="bh"><strong>시작하기 · {steps.length - left}/{steps.length}</strong><a className="small" href="/guide">가이드 →</a></div>
            <div className="checklist">{steps.map(([label, done, to]) => <a key={label} data-done={done} href={to ? `/w/${w.id}/${to}` : "#cal"}>{done ? "✓" : "○"} {label}</a>)}</div>
          </div>
        )}
        {mix.length > 0 && live.length > 0 && (
          <details className="block"><summary className="small" style={{ fontWeight: 700, cursor: "pointer" }}>기둥 비중 · 목표(빨간 선) 대비 달력 {live.length}개</summary>
            <div className="mix" style={{ marginTop: 8 }}>{mix.map((m) => <Fragment key={m.name}><span>{m.name}</span><span className="bar2"><span style={{ width: `${m.now}%` }} /><i style={{ left: `${m.target}%` }} /></span><span>{m.now}% / {m.target}%</span></Fragment>)}</div>
          </details>
        )}
        {typeof q.error === "string" && <p className="err">{q.error}</p>}
        {!w.startDate && <p className="small muted" style={{ margin: 0 }}>설정에서 1일차 날짜를 정하면 칸마다 날짜가 붙어요.</p>}
        {archive ? (
          <div className="list">
            {archived.map((p) => (
              <div key={p.id} className="item">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3><Link href={`/w/${w.id}/p/${p.id}`}>{p.title || "제목 없음"}</Link></h3>
                  <span className="small muted">원래 D{p.day} {p.slot} · {STATUS_LABEL[p.status]} · {p.category} · 뺀 날 {p.archivedAt ? new Date(p.archivedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }) : ""}</span>
                </div>
                <form action={postToolAction} className="row">
                  <input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="op" value="restore" />
                  <button className="btn">달력으로 되살리기</button><span className="small muted">원래 칸이 비어 있으면 그 칸, 아니면 비어 있는 첫 칸</span>
                </form>
              </div>
            ))}
            {!archived.length && <p className="hint">보관함이 비었어요. 편집기 아래 &apos;게시물 관리&apos;에서 뺄 수 있어요.</p>}
          </div>
        ) : grid ? <Grid ws={w.id} posts={posts.filter((p) => p.data && p.status !== "skip" && (!filter || p.status === filter))} /> : (
          <div id="cal" className="cal" style={{ ["--slots" as string]: w.slots.length }}>
            <div className="calrow small" style={{ fontWeight: 800 }}><span>일차</span>{w.slots.map((s) => <span key={s}>{s}</span>)}</div>
            {Array.from({ length: w.days }, (_, i) => i + 1).map((d) => (
              <div key={d} className="calrow">
                <span className="calday">D{d}{w.startDate && <em>{dateOf(w.startDate, d).slice(5).replace("-", "/")}</em>}</span>
                {w.slots.map((s) => {
                  const p = posts.find((x) => x.day === d && x.slot === s);
                  if (!p) return (
                    <form key={s} action={createPostAction}><input type="hidden" name="ws" value={w.id} /><input type="hidden" name="day" value={d} /><input type="hidden" name="slot" value={s} />
                      <button className="cell empty" style={{ width: "100%" }}>+ 만들기</button></form>
                  );
                  return (
                    <Link key={s} href={`/w/${w.id}/p/${p.id}`} className="cell" data-s={p.status} style={filter && p.status !== filter ? { opacity: 0.25 } : undefined}>
                      <span className="c">{p.category} · {templateOf(p.template).name}{p.data?.photos.some((x) => x.kind === "video") ? " · 영상" : ""}</span>
                      <span className="t">{p.title || "제목 없음"}</span>
                      <span className="s">{STATUS_LABEL[p.status]}{p.data ? ` · ${p.data.slides.length}장` : ""}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

/** 인스타 프로필처럼: 가장 늦은 게시물이 왼쪽 위, 표지를 3:4로 잘라서 */
function Grid({ ws, posts }: { ws: string; posts: Awaited<ReturnType<typeof listPosts>> }) {
  const list = [...posts].reverse().slice(0, 30);
  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>프로필 그리드는 4:5 표지를 3:4로 잘라 보여 줘요(좌우 약 34px). 가장 늦은 게시물이 왼쪽 위 · 최대 30개 · 건너뜀 제외</p>
      <div className="grid3">
        {list.map((p) => (
          <Link key={p.id} href={`/w/${ws}/p/${p.id}`} title={p.title}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/posts/${p.id}/slide/1?png=1&v=${encodeURIComponent(p.updatedAt)}`} alt={p.title} loading="lazy" />
            <span>D{p.day} {p.slot} · {STATUS_LABEL[p.status]}</span>
          </Link>
        ))}
        {!list.length && <div className="empty">내용이 있는 게시물이 아직 없어요</div>}
      </div>
    </>
  );
}
