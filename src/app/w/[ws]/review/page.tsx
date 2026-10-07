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

/** 6단계 검수: 승인을 기다리는 초안 + 승인 전 확인(스튜디오가 확인한 것 · 사람이 체크할 것). ?p=게시물 */
export default async function Review({ params, searchParams }: PageProps<"/w/[ws]/review">) {
  const { ws } = await params;
  const q = await searchParams;
  const { ws: w, role } = await requireWs(ws, "view");
  const drafts = (await listPosts(w.id)).filter((p) => p.status === "draft" && p.data);
  const cur = drafts.find((p) => p.id === q.p) ?? drafts[0];
  const cl = cur ? await checklistOf(cur.id) : null;
  const safe = cur?.data ? await checkPost(cur.template, w.theme, cur.data).catch(() => null) : null;
  const out = safe?.filter((x) => !x.ok) ?? [];
  const added = cl ? cl.required.filter((c) => !(DEFAULT_CHECKS as readonly string[]).includes(c)) : [];
  return (
    <ServiceShell ws={w} step="review" ctx="6단계 검수 (승인 전 확인)">
      <div className="mk-head"><h1>검수</h1><p>승인을 기다리는 초안이에요. 승인 뒤에 글을 고치면 다시 초안이 되고, 체크도 다시 해요.</p></div>
      {typeof q.error === "string" && <p className="err">{q.error}</p>}
      {!drafts.length ? <p className="hint">승인을 기다리는 초안이 없어요. 5 제작에서 글을 채우면 여기로 와요.</p> : (
        <div className="mk-review">
          <div className="mk-list">
            {drafts.map((p) => {
              const n = ruleWarnings(w.brief?.rules, w.defaultTemplate, p.template, p.data).length;
              return (
                <Link key={p.id} href={`/w/${w.id}/review?p=${p.id}`} className="mk-row mk-pick" aria-current={p.id === cur?.id ? "true" : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="mk-thumb mk-thumb-lg" src={`/api/posts/${p.id}/slide/1?png=1&v=${encodeURIComponent(p.updatedAt)}`} alt="" loading="lazy" />
                  <span className="mk-row-main"><b className="mk-row-title">{p.title || "제목 없음"}</b><span className="small muted">D{p.day} {p.slot} · 초안 · {p.data!.slides.length}장</span></span>
                  <span className="mk-flag"><Icon name={n ? "warn" : "check"} size={14} />{n ? `규칙 경고 ${n}` : "경고 없음"}</span>
                </Link>
              );
            })}
          </div>
          {cur && cl && (
            <section className="mk-dialog" aria-labelledby="ap-t">
              <h2 id="ap-t">승인 전 확인 · D{cur.day} {cur.title || "제목 없음"}</h2>
              <p className="small muted" style={{ margin: 0 }}>모두 체크해야 승인돼요. 누가 언제 체크했는지 남아요.</p>
              <b className="mk-sub">스튜디오가 확인한 것</b>
              <div className="mk-auto"><Icon name={safe && !out.length ? "check" : "warn"} size={16} /><span>{!safe ? "인스타 마진을 계산하지 못했어요 (편집기에서 확인)" : out.length ? `인스타 마진: ${out.map((x) => `${x.n}장 밖 ${x.outside}px`).join(" · ")}` : `인스타 마진: ${safe.length}장 모두 안전 영역 안`}</span></div>
              {cl.auto.map((a, i) => <div key={i} className="mk-auto"><Icon name={a.ok ? "check" : "warn"} size={16} /><span>{a.text}{"researchId" in a ? <> · <Link href={`/w/${w.id}/research?c=check`}>자료 열기</Link></> : null}</span></div>)}
              {can(role, "approve")
                ? <ApproveForm key={cur.id} id={cur.id} required={cl.required} added={added} editHref={`/w/${w.id}/p/${cur.id}`} />
                : <p className="small muted" style={{ margin: "8px 0 0" }}>승인은 소유자·검수자가 해요. <Link href={`/w/${w.id}/p/${cur.id}`}>편집기에서 고치기 →</Link></p>}
            </section>
          )}
        </div>
      )}
    </ServiceShell>
  );
}
