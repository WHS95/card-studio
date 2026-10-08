import Link from "next/link";
import { can, requireWs } from "@/lib/auth";
import { listPosts } from "@/lib/store";
import { fullCaption } from "@/lib/exporter";
import { ServiceShell } from "../../../ui/Shell";
import { PostedForm, CopyCaption, UnpostForm, ReelForm } from "./Forms";

/** 7단계 발행: 승인된 게시물을 내려받아 사람이 직접 인스타에 올리고, 링크를 붙이면 게시. 릴스로 만들기. 게시됨 목록 */
export default async function Publish({ params }: PageProps<"/w/[ws]/publish">) {
  const { ws } = await params;
  const { ws: w, role } = await requireWs(ws, "view");
  const posts = await listPosts(w.id);
  const ready = posts.filter((p) => p.status === "approved");
  const posted = posts.filter((p) => p.status === "posted").reverse();
  const canApprove = can(role, "approve");
  return (
    <ServiceShell ws={w} step="publish" ctx="7단계 발행">
      <div className="mk-head"><h1>발행</h1><p>승인된 게시물을 내려받아 인스타에 직접 올리고, 올린 게시물 링크를 붙이면 &apos;게시&apos;가 돼요. 스튜디오는 자동으로 올리지 않아요.</p></div>
      <section className="sect"><h2>올릴 차례 · 승인 {ready.length}</h2>
        {ready.map((p) => (
          <div key={p.id} className="mk-row mk-ready">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mk-thumb" src={`/api/posts/${p.id}/slide/1?png=1&v=${encodeURIComponent(p.updatedAt)}`} alt="" loading="lazy" />
            <span className="mk-row-main" style={{ flex: "1 1 200px" }}><Link href={`/w/${w.id}/p/${p.id}`} className="mk-row-title">{p.title || "제목 없음"}</Link><span className="small muted">D{p.day} {p.slot}{p.review ? ` · 승인 ${p.review.by} ${new Date(p.review.at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" }).replace(/\. ?/g, "/").replace(/\/$/, "")} · 체크 ${p.review.checks.length}/${p.review.checks.length}` : ""}</span></span>
            <a className="btn" href={`/api/posts/${p.id}/zip`}>전체 ZIP</a>
            <CopyCaption text={fullCaption(p)} />
            {canApprove && <PostedForm id={p.id} />}
          </div>
        ))}
        {!ready.length && <p className="small muted" style={{ margin: 0 }}>승인된 게시물이 없어요. 편집기의 &apos;검수&apos;에서 승인하면 여기로 와요.</p>}
        <p className="small muted" style={{ margin: 0 }}>ZIP = 장별 PNG(영상 장은 MP4) + caption.txt · 링크는 https://www.instagram.com/p/… 나 /reel/… 주소를 붙여요</p>
      </section>
      {ready.length > 0 && <section className="sect"><h2>릴스로 만들기</h2>
        <ReelForm posts={ready.map((p) => ({ id: p.id, label: `D${p.day} · ${p.title || "제목 없음"}` }))} />
      </section>}
      <section className="sect"><h2>게시됨 · {posted.length}</h2>
        {posted.map((p) => (
          <div key={p.id} className="mk-row mk-done">
            <Link href={`/w/${w.id}/p/${p.id}`} className="mk-row-title" style={{ flex: "1 1 160px" }}>{p.title || "제목 없음"}</Link>
            <span className="small muted">D{p.day} {p.slot}{p.metrics ? " · 성과 적음" : ""}</span>
            {p.postedUrl && <a className="small" href={p.postedUrl} target="_blank" rel="noreferrer">인스타에서 보기</a>}
            {canApprove && <UnpostForm id={p.id} />}
          </div>
        ))}
        <p className="small muted" style={{ margin: 0 }}>게시 {w.metricsDays ?? 7}일 뒤 8 성과 탭에 &apos;성과 적을 차례&apos;로 떠요.</p>
      </section>
    </ServiceShell>
  );
}
