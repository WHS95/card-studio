import Link from "next/link";
import { can, requireAuth, roleIn } from "@/lib/auth";
import { listWorkspaces } from "@/lib/store";
import { TEMPLATES } from "@/lib/templates";
import { formatOf, sizeOf, type Field } from "@/lib/fields";
import { videoOf } from "@/lib/video";
import { startFromTemplateAction } from "../actions";
import { WideShell } from "../ui/Shell";

const controls = (fields: Field[]) => fields.filter((f) => f.type === "choice" || f.type === "toggle").map((f) => f.label);

/** 템플릿 갤러리: 형태별 샘플(서비스 테마로 그림)·영상 샘플·장 종류와 조절 항목 → 바로 만들기 */
export default async function Templates({ searchParams }: PageProps<"/templates">) {
  const actor = await requireAuth();
  const q = await searchParams;
  const all = (await listWorkspaces()).filter((x) => can(roleIn(actor, x), "edit"));
  // 미리보기 테마: 기본은 흑백, 서비스를 고르면 그 서비스 색
  const w = all.find((x) => x.id === q.ws) ?? null;
  const groups = [...new Set(TEMPLATES.map((t) => t.group ?? "카드뉴스"))];
  return (
    <WideShell active="templates">
        <h1 style={{ margin: 0 }}>템플릿 {TEMPLATES.length}</h1>
        <p className="small muted" style={{ margin: 0 }}>샘플은 기본 흑백으로 그리고, 서비스를 고르면 그 서비스의 테마 색·워드마크로 그려요. 사진은 추상 샘플 그림이에요 — 실제 게시물에는 직접 찍은 사진이나 출처를 밝힌 무료 사진을 쓰세요.</p>
        {typeof q.error === "string" && <p className="err">{q.error}</p>}
        <div className="row">
          <Link className={`chip${w ? "" : " on"}`} href="/templates">흑백 기본</Link>
          {all.map((x) => <Link key={x.id} className={`chip${x.id === w?.id ? " on" : ""}`} href={`/templates?ws=${x.id}`}>{x.name}</Link>)}
        </div>
        {groups.map((g) => (
          <section key={g} className="panel">
            <h2 style={{ margin: "8px 0 0" }}>{g}</h2>
            {TEMPLATES.filter((t) => (t.group ?? "카드뉴스") === g).map((t) => {
              const sample = t.sample?.() ?? null;
              const sz = sizeOf(t), reel = formatOf(t) === "reel";
              return (
                <div key={t.id} className="block" id={t.id}>
                  <div className="bh">
                    <strong>{t.name} <span className="tag">{sz.w}×{sz.h}{reel ? " 릴스" : ""}</span> <span className="tag">최대 {t.maxSlides}장</span></strong>
                    {all.length > 0 && <form action={startFromTemplateAction} className="row">
                      <input type="hidden" name="template" value={t.id} />
                      <select name="ws" className="input" style={{ width: "auto" }} defaultValue={w?.id ?? all[0].id} aria-label="만들 서비스">{all.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                      <button className="btn" name="mode" value="blank">빈 틀로 만들기</button>
                      {sample && <button className="btn primary" name="mode" value="sample">샘플로 시작</button>}
                    </form>}
                  </div>
                  <p className="small" style={{ margin: 0 }}>{t.description}{t.inspired ? ` · 본뜬 형태: ${t.inspired}` : ""}</p>
                  {sample && (
                    <div className="gallery" data-fmt={reel ? "reel" : "feed"}>
                      {sample.slides.map((s, i) => {
                        const vid = !!videoOf(t.id, sample, i);
                        const qs = w ? `?ws=${w.id}` : "";
                        return (
                          <figure key={i}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/sample/${t.id}/${i + 1}${qs}`} alt={`${t.name} 샘플 ${i + 1}장`} loading="lazy" />
                            <figcaption>{i + 1}. {t.kinds.find((k) => k.kind === s.kind)?.label}</figcaption>
                            {vid && <details><summary className="small">▶ 영상 샘플</summary><video src={`/api/sample/${t.id}/${i + 1}${qs}${qs ? "&" : "?"}video=1`} controls playsInline preload="none" /></details>}
                          </figure>
                        );
                      })}
                    </div>
                  )}
                  <table className="plain">
                    <thead><tr><th>장 종류</th><th>칸</th><th>장마다 조절</th></tr></thead>
                    <tbody>{t.kinds.map((k) => (
                      <tr key={k.kind}>
                        <td><b>{k.label}</b>{k.fixed ? " (첫 장)" : ""}</td>
                        <td>{k.fields.filter((f) => f.type === "text" || f.type === "photo" || f.type === "items").map((f) => f.type === "photo" ? `${f.label}${f.video ? "(영상 가능)" : ""}` : f.label).join(" · ")}</td>
                        <td>{[...controls(k.fields), ...(k.fields.some((f) => f.type === "photo" && f.tune?.includes("h")) ? ["사진 높이"] : []), ...(k.fields.some((f) => f.type === "photo" && f.tune?.includes("y")) ? ["사진 위치"] : [])].join(" · ") || "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              );
            })}
          </section>
        ))}
        <section className="block" id="video">
          <strong>영상으로 만드는 세 가지</strong>
          <ol className="guide-steps">
            <li><b>릴스 자막형</b> — 9:16 한 편. 위 판(로고·자막) + 아래 영상, 또는 영상 가득 + 자막. 자막마다 시작 초를 적으면 그 시간에 바뀌어요 (최대 90초).</li>
            <li><b>캐러셀 안 영상 장</b> — 영상 가능한 사진 칸에 직접 올린 영상을 고르면 그 장은 MP4 가 돼요 (3~60초):
              <span className="muted"> {TEMPLATES.filter((t) => formatOf(t) === "feed").map((t) => `${t.name}(${t.kinds.filter((k) => k.fields.some((f) => f.type === "photo" && f.video)).map((k) => k.label).join("·")})`).join(" · ")}</span></li>
            <li><b>캐러셀 → 릴스</b> — 저장한 카드뉴스를 편집기의 &apos;릴스로 (MP4)&apos;로 받으면 장마다 3초씩 9:16 영상이 돼요 (영상 장은 그 길이 그대로, 소리 없음 — 음악은 인스타에서).</li>
          </ol>
        </section>
        {!all.length && <p className="hint">서비스를 먼저 만들면 그 서비스에 바로 만들 수 있어요.</p>}
      </WideShell>
  );
}
