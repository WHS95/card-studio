import Link from "next/link";
import { can, requireWs } from "@/lib/auth";
import { listPosts } from "@/lib/store";
import { checklistOf } from "@/lib/ops";
import { checkPost } from "@/lib/check";
import { ruleWarnings } from "@/lib/rules";
import { DEFAULT_CHECKS } from "@/lib/types";
import { ServiceShell } from "../../../ui/Shell";
import Icon from "../../../ui/Icon";
import ApproveForm from "./ApproveForm";
import ReviewList, { type ReviewRow } from "./ReviewList";
import ConfirmButton from "../../../ui/ConfirmButton";
import { postToolAction } from "../../../actions";

/** 6단계 검수: 승인을 기다리는 초안 + 승인 전 확인(스튜디오가 확인한 것 · 사람이 체크할 것) · 승인된 것 · 골라서 ZIP 내려받기. ?s=draft|approved ?p=게시물 */
export default async function Review({ params, searchParams }: PageProps<"/w/[ws]/review">) {
  const { ws } = await params;
  const q = await searchParams;
  const { ws: w, role } = await requireWs(ws, "view");
  const all = (await listPosts(w.id)).filter((p) => p.data);
  const drafts = all.filter((p) => p.status === "draft"), oks = all.filter((p) => p.status === "approved");
  const tab: "draft" | "approved" = q.s === "approved" || (q.s !== "draft" && !drafts.length && oks.length) ? "approved" : "draft";
  const shown = tab === "draft" ? drafts : oks;
  const cur = shown.find((p) => p.id === q.p) ?? shown[0];
  const cl = cur && tab === "draft" ? await checklistOf(cur.id) : null;
  const rows: ReviewRow[] = shown.map((p) => ({
    id: p.id, title: p.title || "제목 없음", status: tab, thumb: `/api/posts/${p.id}/slide/1?png=1&v=${encodeURIComponent(p.updatedAt)}`,
    meta: `D${p.day} ${p.slot} · ${tab === "draft" ? "초안" : `승인${p.review ? ` ${p.review.by}` : ""}`} · ${p.data!.slides.length}장`,
    warn: ruleWarnings(w.brief?.rules, w.defaultTemplate, p.template, p.data).length,
  }));
  const safe = cur?.data ? await checkPost(cur.template, w.theme, cur.data).catch(() => null) : null;
  const out = safe?.filter((x) => !x.ok) ?? [];
  const added = cl ? cl.required.filter((c) => !(DEFAULT_CHECKS as readonly string[]).includes(c)) : [];
  return (
    <ServiceShell ws={w} step="review" ctx="6단계 검수 (승인 전 확인)">
      <div className="mk-head"><h1>검수</h1><p>승인을 기다리는 초안을 확인하고 승인해요. 고른 게시물은 ZIP으로 내려받아 인스타에 직접 올려요. 승인 뒤에 글을 고치면 다시 초안이 돼요.</p></div>
      <div className="row">
        <Link className={`chip mk-chip${tab === "draft" ? " on" : ""}`} href={`/w/${w.id}/review?s=draft`}>승인 대기 {drafts.length}</Link>
        <Link className={`chip mk-chip${tab === "approved" ? " on" : ""}`} href={`/w/${w.id}/review?s=approved`}>승인됨 {oks.length}</Link>
      </div>
      {typeof q.error === "string" && <p className="err">{q.error}</p>}
      {!shown.length ? <p className="hint">{tab === "draft" ? "승인을 기다리는 초안이 없어요. 5 제작에서 글을 채우면 여기로 와요." : "승인한 게시물이 여기 모여요."}</p> : (
        <div className="mk-review">
          <ReviewList key={tab} ws={w.id} rows={rows} cur={cur?.id} />
          {cur && cl && (
            <section className="mk-dialog" aria-labelledby="ap-t">
              <h2 id="ap-t">승인 전 확인 · D{cur.day} {cur.title || "제목 없음"}</h2>
              <p className="small muted" style={{ margin: 0 }}>모두 체크하면 승인할 수 있어요. 누가 언제 체크했는지 남아요.</p>
              <div className="row"><a className="btn" href={`/api/posts/${cur.id}/zip`}>이 게시물 ZIP</a><Link className="btn" href={`/w/${w.id}/p/${cur.id}`}>편집기에서 열기</Link>{can(role, "edit") && <form action={postToolAction}><input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={cur.id} /><input type="hidden" name="from" value="review" /><ConfirmButton name="op" value="remove" ask={`'${(cur.title || "제목 없음").slice(0, 30)}' 게시물을 지울까요? 글·장·캡션이 모두 사라지고 되돌릴 수 없어요.`}>지우기</ConfirmButton></form>}</div>
              <b className="mk-sub">스튜디오가 확인한 것</b>
              <div className="mk-auto"><Icon name={safe && !out.length ? "check" : "warn"} size={16} /><span>{!safe ? "인스타 마진을 계산하지 못했어요. 편집기에서 확인해 주세요" : out.length ? `인스타 마진: ${out.map((x) => `${x.n}장 밖 ${x.outside}px`).join(" · ")}` : `인스타 마진: ${safe.length}장 모두 안전 영역 안이에요`}</span></div>
              {cl.auto.map((a, i) => <div key={i} className="mk-auto"><Icon name={a.ok ? "check" : "warn"} size={16} /><span>{a.text}{"researchId" in a ? <> · <Link href={`/w/${w.id}/research?c=check`}>자료 열기</Link></> : null}</span></div>)}
              {can(role, "approve")
                ? <ApproveForm key={cur.id} id={cur.id} required={cl.required} added={added} editHref={`/w/${w.id}/p/${cur.id}`} />
                : <p className="small muted" style={{ margin: "8px 0 0" }}>승인은 소유자·검수자가 해요. <Link href={`/w/${w.id}/p/${cur.id}`}>편집기에서 고치기 →</Link></p>}
            </section>
          )}
          {cur && tab === "approved" && (
            <section className="mk-dialog" aria-labelledby="ok-t">
              <h2 id="ok-t">승인됨 · D{cur.day} {cur.title || "제목 없음"}</h2>
              <p className="small muted" style={{ margin: 0 }}>{cur.review ? `${cur.review.by} · ${new Date(cur.review.at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 승인 · 체크 ${cur.review.checks.length}개` : "승인 기록이 없어요"}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="mk-okprev" src={`/api/posts/${cur.id}/slide/1?png=1&v=${encodeURIComponent(cur.updatedAt)}`} alt="" />
              <div className="row"><a className="btn primary" href={`/api/posts/${cur.id}/zip`}>이 게시물 ZIP</a><Link className="btn" href={`/w/${w.id}/p/${cur.id}`}>편집기에서 게시 표시</Link>{can(role, "edit") && <form action={postToolAction}><input type="hidden" name="ws" value={w.id} /><input type="hidden" name="id" value={cur.id} /><input type="hidden" name="from" value="review" /><ConfirmButton name="op" value="remove" ask={`'${(cur.title || "제목 없음").slice(0, 30)}' 게시물을 지울까요? 글·장·캡션이 모두 사라지고 되돌릴 수 없어요.`}>지우기</ConfirmButton></form>}</div>
              <p className="small muted" style={{ margin: 0 }}>인스타에 올린 뒤 편집기에서 게시 링크를 붙이면 &apos;게시&apos;가 돼요.</p>
            </section>
          )}
        </div>
      )}
    </ServiceShell>
  );
}
