import Link from "next/link";
import { can, requireWs } from "@/lib/auth";
import { TEMPLATES } from "@/lib/templates";
import { ServiceShell } from "../../../ui/Shell";
import ThemeForm from "./ThemeForm";

/** 4단계 템플릿: 이 서비스의 기본 틀 · 카드 색 · 워드마크 (미리보기는 저장된 테마로) */
export default async function TemplatePage({ params }: PageProps<"/w/[ws]/template">) {
  const { ws } = await params;
  const { ws: w, role } = await requireWs(ws, "view");
  const v = encodeURIComponent(JSON.stringify(w.theme)).length; // 테마가 바뀌면 그림 주소도 바뀌게
  return (
    <ServiceShell ws={w} step="template" ctx="4단계 템플릿 (기본 틀·카드 색·워드마크)">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="col"><h1>템플릿</h1><span className="small muted">이 서비스의 기본 틀과 카드 색. 강조색은 채움으로 써요(그 위 글자 = 강조색 위 글자). 기둥마다 기본 틀은 1 목적 탭에서.</span></div>
        <Link className="btn" href={`/templates?ws=${w.id}`}>갤러리에서 더 보기</Link>
      </div>
      <ThemeForm ws={w.id} canEdit={can(role, "manage")} defaultTemplate={w.defaultTemplate} theme={w.theme} templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, sample: !!t.sample }))} />
      <section className="sect"><h2>미리보기 <span className="sp small muted">저장된 색으로 그려요</span></h2>
        {!TEMPLATES.find((t) => t.id === w.defaultTemplate)?.sample ? <p className="small muted" style={{ margin: 0 }}>이 틀은 샘플 그림이 없어요. 갤러리에서 &apos;빈 틀로 시작&apos;해 확인해 주세요.</p> : <div className="gallery">{[1, 2, 3].map((n) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={n} src={`/api/sample/${w.defaultTemplate}/${n}?ws=${w.id}&v=${v}`} alt={`${n}장 미리보기`} loading="lazy" />
        ))}</div>}
      </section>
    </ServiceShell>
  );
}
