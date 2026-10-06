import { can, requireWs } from "@/lib/auth";
import { emptyBrief, GOALS, PRESETS } from "@/lib/presets";
import { TEMPLATES } from "@/lib/templates";
import { ServiceShell } from "../../../ui/Shell";
import BriefEditor from "./BriefEditor";

/** 서비스 브리프 + 콘텐츠 기둥: 무엇을 · 누구에게 · 어떤 말투로 · 무엇을 꾸준히 다룰지 */
export default async function BriefPage({ params, searchParams }: PageProps<"/w/[ws]/brief">) {
  const { ws } = await params;
  const q = await searchParams;
  const { ws: w, role } = await requireWs(ws, "view");
  return (
    <ServiceShell ws={w} step="brief" ctx="1단계 목적 (브리프·기둥·콘텐츠 규칙·승인 체크리스트)">
        <div className="col"><h1>목적</h1><span className="small muted">누구에게 무엇을 위해 만드는지. 고치면 자동으로 저장돼요. AI·MCP 도 이 내용을 먼저 읽어요.</span></div>
        {q.new === "1" && <p className="hint">새 서비스를 만들었어요. 브리프를 채우면 아이디어·초안·캡션(AI·MCP)이 이 내용을 바탕으로 만들어져요. 나중에 채워도 돼요.</p>}
        <BriefEditor
          ws={w.id}
          brief={{ ...emptyBrief(), ...w.brief }}
          pillars={w.pillars ?? []}
          presets={PRESETS}
          goals={[...GOALS]}
          templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name }))}
          isNew={q.new === "1"}
          canEdit={can(role, "edit")}
        />
    </ServiceShell>
  );
}
