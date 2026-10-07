import { can, requireWs } from "@/lib/auth";
import { emptyBrief, GOALS, PRESETS } from "@/lib/presets";
import { TEMPLATES, templateOf } from "@/lib/templates";
import { ServiceShell } from "../../../ui/Shell";
import BriefEditor from "./BriefEditor";

/** 서비스 브리프 + 콘텐츠 기둥: 무엇을 · 누구에게 · 어떤 말투로 · 무엇을 꾸준히 다룰지 */
export default async function BriefPage({ params, searchParams }: PageProps<"/w/[ws]/brief">) {
  const { ws } = await params;
  const q = await searchParams;
  const { ws: w, role } = await requireWs(ws, "view");
  return (
    <ServiceShell ws={w} step="brief" ctx="1단계 목적 (브리프·기둥·콘텐츠 규칙·승인 체크리스트)">
        <BriefEditor
          ws={w.id}
          brief={{ ...emptyBrief(), ...w.brief }}
          pillars={w.pillars ?? []}
          presets={PRESETS}
          goals={[...GOALS]}
          templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name }))}
          defaultTemplateName={templateOf(w.defaultTemplate).name}
          isNew={q.new === "1"}
          canEdit={can(role, "edit")}
        />
    </ServiceShell>
  );
}
