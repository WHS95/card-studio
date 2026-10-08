import { can, requireWs } from "@/lib/auth";
import { TEMPLATES } from "@/lib/templates";
import { ServiceShell } from "../../../ui/Shell";
import ThemeForm from "./ThemeForm";

/** 4단계 템플릿: 이 서비스의 기본 틀 · 카드 색 · 워드마크 (미리보기는 저장된 테마로) */
export default async function TemplatePage({ params }: PageProps<"/w/[ws]/template">) {
  const { ws } = await params;
  const { ws: w, role } = await requireWs(ws, "view");
  const v = [...JSON.stringify(w.theme)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36); // 테마가 바뀌면 그림 주소도 바뀌게 (같은 길이 색 바꿈도)
  return (
    <ServiceShell ws={w} step="template" ctx="4단계 템플릿 (기본 틀·카드 색·워드마크)">
      <ThemeForm ws={w.id} v={v} canEdit={can(role, "manage")} defaultTemplate={w.defaultTemplate} theme={w.theme} templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, sample: !!t.sample }))}>
        <section className="sect"><h2>미리보기 <span className="sp small muted">저장된 색으로 그려요</span></h2>
          {!TEMPLATES.find((t) => t.id === w.defaultTemplate)?.sample ? <p className="small muted" style={{ margin: 0 }}>이 틀은 샘플 그림이 없어요. 갤러리에서 &apos;빈 틀로 시작&apos;을 누르면 볼 수 있어요.</p> : <div className="stg-prev" data-fmt={w.defaultTemplate === "reel" ? "reel" : undefined}>{[1, 2, 3].map((n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={n} src={`/api/sample/${w.defaultTemplate}/${n}?ws=${w.id}&v=${v}`} alt={`${n}장 미리보기`} loading="lazy" />
          ))}</div>}
        </section>
      </ThemeForm>
    </ServiceShell>
  );
}
