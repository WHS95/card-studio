import Link from "next/link";
import { can, requireAuth, roleIn } from "@/lib/auth";
import { listWorkspaces } from "@/lib/store";
import { TEMPLATES } from "@/lib/templates";
import { formatOf, sizeOf, type Field } from "@/lib/fields";
import { videoOf } from "@/lib/video";
import { startFromTemplateAction } from "../actions";
import { WideShell } from "../ui/Shell";
import ThemePick from "./ThemePick";

const controls = (fields: Field[]) => fields.filter((f) => f.type === "choice" || f.type === "toggle").map((f) => f.label);
const hasVideo = (t: (typeof TEMPLATES)[number]) => formatOf(t) === "reel" || t.kinds.some((k) => k.fields.some((f) => f.type === "photo" && f.video));
const FILTERS = [
  { k: "", label: "전체", ok: () => true },
  { k: "feed", label: "피드", ok: (t: (typeof TEMPLATES)[number]) => formatOf(t) === "feed" },
  { k: "reel", label: "릴스", ok: (t: (typeof TEMPLATES)[number]) => formatOf(t) === "reel" },
  { k: "video", label: "영상 장 있음", ok: hasVideo },
] as const;

/** 템플릿 갤러리: 형태별 샘플(서비스 테마로 그림)·영상 샘플·장 종류와 조절 항목 → 바로 만들기 */
export default async function Templates({ searchParams }: PageProps<"/templates">) {
  const actor = await requireAuth();
  const q = await searchParams;
  const all = (await listWorkspaces()).filter((x) => can(roleIn(actor, x), "edit"));
  // 미리보기 테마: 기본은 흑백, 서비스를 고르면 그 서비스 색 (시작할 서비스도 그것)
  const w = all.find((x) => x.id === q.ws) ?? null;
  const fk = FILTERS.find((x) => x.k === q.f)?.k ?? "";
  // 샘플이 있는 템플릿을 앞에 (시안 순서: 뉴스형 · 매거진 · 포스터형 …)
  const shown = TEMPLATES.filter(FILTERS.find((x) => x.k === fk)!.ok).sort((a, b) => Number(!!b.sample) - Number(!!a.sample));
  const href = (f: string) => { const p = new URLSearchParams(); if (w) p.set("ws", w.id); if (f) p.set("f", f); return `/templates${p.size ? `?${p}` : ""}`; };
  return (
    <WideShell active="templates">
      <div className="w-pagehead">
        <h1>템플릿</h1>
        <p className="small muted">테마에서 서비스를 고르면 그 색·워드마크로 샘플을 그려요. 사진은 추상 샘플 그림이에요. 실제 게시물에는 직접 찍은 사진이나 출처를 밝힌 무료 사진을 넣어 주세요.</p>
      </div>
      {typeof q.error === "string" && <p className="err">{q.error}</p>}
      <div className="row">
        <ThemePick list={all.map((x) => ({ id: x.id, name: x.name }))} value={w?.id ?? ""} f={fk} />
        {FILTERS.map((x) => {
          const n = x.k === "video" ? null : TEMPLATES.filter(x.ok).length;
          return <Link key={x.k} className={`chip${fk === x.k ? " on" : ""}`} href={href(x.k)} aria-current={fk === x.k ? "page" : undefined}>{x.label}{n !== null ? ` ${n}` : ""}</Link>;
        })}
      </div>
      {shown.map((t) => {
        const sample = t.sample?.() ?? null;
        const sz = sizeOf(t), reel = formatOf(t) === "reel";
        const qs = w ? `?ws=${w.id}` : "";
        const vids = sample ? sample.slides.map((_, i) => i).filter((i) => !!videoOf(t.id, sample, i)) : [];
        return (
          <article key={t.id} className="sect w-tpl" id={t.id}>
            <div className="w-tpl-head">
              <b className="w-tpl-name">{t.name}</b>
              <span className="small muted">{sz.w}×{sz.h}{reel ? " · 릴스" : ""} · {t.maxSlides}장까지</span>
              {all.length > 0 && (
                <form action={startFromTemplateAction} className="row w-tpl-go">
                  <input type="hidden" name="template" value={t.id} />
                  {w ? <input type="hidden" name="ws" value={w.id} />
                    : all.length === 1 ? <input type="hidden" name="ws" value={all[0].id} />
                    : <select name="ws" className="input w-auto" defaultValue={all[0].id} aria-label="만들 서비스">{all.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
                  <button className="btn" name="mode" value="blank">빈 틀로 시작</button>
                  {sample && <button className="btn primary" name="mode" value="sample">샘플로 시작</button>}
                </form>
              )}
            </div>
            <p className="small muted w-m0">{t.description}{t.inspired ? ` · 본뜬 형태: ${t.inspired}` : ""}</p>
            {sample && (
              <div className="w-thumbs" data-fmt={reel ? "reel" : "feed"}>
                {sample.slides.map((s, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={`/api/sample/${t.id}/${i + 1}${qs}`} alt={`${t.name} 샘플 ${i + 1}장 · ${t.kinds.find((k) => k.kind === s.kind)?.label ?? ""}`} loading="lazy" />
                ))}
              </div>
            )}
            <div className="tagrow">{t.kinds.map((k) => <span key={k.kind} className="w-kind">{k.label}</span>)}</div>
            {vids.length > 0 && sample && (
              <details className="w-more-info"><summary className="small">영상 샘플 {vids.length}</summary>
                <div className="w-vids">{vids.map((i) => <video key={i} src={`/api/sample/${t.id}/${i + 1}${qs}${qs ? "&" : "?"}video=1`} controls playsInline preload="none" aria-label={`${t.name} ${i + 1}장 영상 샘플`} />)}</div>
              </details>
            )}
            <details className="w-more-info"><summary className="small">장 종류와 조절 항목</summary>
              <div className="w-table">
                <table className="plain">
                  <thead><tr><th>장 종류</th><th>칸</th><th>장마다 조절</th></tr></thead>
                  <tbody>{t.kinds.map((k) => (
                    <tr key={k.kind}>
                      <td><b>{k.label}</b>{k.fixed ? " (첫 장)" : ""}</td>
                      <td>{k.fields.filter((f) => f.type === "text" || f.type === "photo" || f.type === "items").map((f) => f.type === "photo" ? `${f.label}${f.video ? "(영상도)" : ""}` : f.label).join(" · ")}</td>
                      <td>{[...controls(k.fields), ...(k.fields.some((f) => f.type === "photo" && f.tune?.includes("h")) ? ["사진 높이"] : []), ...(k.fields.some((f) => f.type === "photo" && f.tune?.includes("y")) ? ["사진 위치"] : [])].join(" · ") || "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          </article>
        );
      })}
      <section className="sect" id="video">
        <h2>영상으로 만드는 세 가지</h2>
        <ol className="guide-steps">
          <li><b>릴스 자막형</b> — 9:16 한 편. 위 판(로고·자막) + 아래 영상, 또는 영상 가득 + 자막. 자막마다 시작 초를 적으면 그 시간에 바뀌어요 (90초까지).</li>
          <li><b>캐러셀 안 영상 장</b> — 영상을 넣을 수 있는 사진 칸에서 직접 올린 영상을 고르면 그 장은 MP4 가 돼요 (3~60초):
            <span className="muted"> {TEMPLATES.filter((t) => formatOf(t) === "feed").map((t) => `${t.name}(${t.kinds.filter((k) => k.fields.some((f) => f.type === "photo" && f.video)).map((k) => k.label).join("·")})`).join(" · ")}</span></li>
          <li><b>캐러셀 → 릴스</b> — 저장한 카드뉴스를 편집기의 &apos;릴스로 (MP4)&apos;로 받으면 장마다 3초씩 9:16 영상이 돼요. 영상 장은 원래 길이대로 들어가고 소리는 빠져요. 음악은 인스타에서 넣어요.</li>
        </ol>
      </section>
      {!all.length && <p className="hint">서비스를 만들면 여기서 바로 게시물을 시작할 수 있어요.</p>}
    </WideShell>
  );
}
