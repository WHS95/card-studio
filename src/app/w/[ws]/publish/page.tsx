import Link from "next/link";
import { can, requireWs } from "@/lib/auth";
import { listPosts } from "@/lib/store";
import { fullCaption } from "@/lib/exporter";
import { ServiceShell } from "../../../ui/Shell";
import { PostedForm, CopyCaption, UnpostForm } from "./Forms";

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
      <div className="col"><h1>발행</h1><span className="small muted">승인된 게시물을 내려받아 인스타에 직접 올리고, 올린 게시물 링크를 붙이면 &apos;게시&apos;가 돼요. 스튜디오는 자동으로 올리지 않아요.</span></div>
      <section className="sect"><h2>올릴 차례 · 승인 {ready.length}</h2>
        {ready.map((p) => (
          <div key={p.id} className="pick" style={{ cursor: "default", flexWrap: "wrap", border: "1.5px solid var(--ink)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/posts/${p.id}/slide/1?png=1&v=${encodeURIComponent(p.updatedAt)}`} alt="" style={{ width: 54, height: 68, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line2)" }} loading="lazy" />
            <span className="col" style={{ flex: "1 1 200px", gap: 2 }}><Link href={`/w/${w.id}/p/${p.id}`} style={{ fontWeight: 800 }}>{p.title || "제목 없음"}</Link><span className="small muted">D{p.day} {p.slot}{p.review ? ` · 승인 ${p.review.by} ${new Date(p.review.at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" })} · 체크 ${p.review.checks.length}/${p.review.checks.length}` : ""}</span></span>
            <a className="btn" href={`/api/posts/${p.id}/zip`}>전체 ZIP</a>
            <CopyCaption text={fullCaption(p)} />
            {canApprove && <PostedForm id={p.id} />}
          </div>
        ))}
        {!ready.length && <p className="small muted" style={{ margin: 0 }}>승인된 게시물이 없어요. 6 검수에서 승인하면 여기로 와요.</p>}
        <p className="small muted" style={{ margin: 0 }}>ZIP = 장별 PNG(영상 장은 MP4) + caption.txt · 링크는 https://www.instagram.com/p/… 또는 /reel/… 만</p>
      </section>
      {ready.length > 0 && <section className="sect"><h2>릴스로 만들기</h2>
        <form action={`/api/posts/${ready[0].id}/reel`} method="get" className="row">
          <span className="small">첫 승인 게시물({ready[0].title})을 장마다</span><input name="secs" type="number" min={1} max={10} defaultValue={3} className="input" style={{ width: 80 }} /><span className="small">초씩 릴스 MP4로</span>
          <button className="btn">릴스 MP4 만들기</button>
        </form>
        <p className="small muted" style={{ margin: 0 }}>다른 게시물은 편집기의 내려받기에서 만들어요.</p>
      </section>}
      <section className="sect"><h2>게시됨 · {posted.length}</h2>
        {posted.map((p) => (
          <div key={p.id} className="check-row" style={{ cursor: "default", alignItems: "center", flexWrap: "wrap" }}>
            <Link href={`/w/${w.id}/p/${p.id}`} style={{ flex: 1, fontWeight: 700 }}>{p.title || "제목 없음"}</Link><span className="small muted">D{p.day} {p.slot}{p.metrics ? " · 성과 적음" : ""}</span>
            {p.postedUrl && <a className="small" href={p.postedUrl} target="_blank" rel="noreferrer">인스타에서 보기</a>}
            {canApprove && <UnpostForm id={p.id} />}
          </div>
        ))}
        <p className="small muted" style={{ margin: 0 }}>게시 {w.metricsDays ?? 7}일 뒤 8 성과 탭에 &apos;성과 적을 차례&apos;로 떠요.</p>
      </section>
    </ServiceShell>
  );
}
