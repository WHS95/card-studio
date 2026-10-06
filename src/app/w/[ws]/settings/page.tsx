import { requireWs } from "@/lib/auth";
import { ServiceShell } from "../../../ui/Shell";
import WsSettings from "./WsSettings";

/** 서비스 설정 (소유자): 이름·계정 · 달력(1일차·일수·시간대·카테고리) · 성과 적을 날 · 요금제(운영자). 색·워드마크·기본 틀은 4 템플릿 탭 */
export default async function Settings({ params }: PageProps<"/w/[ws]/settings">) {
  const { ws } = await params;
  const { ws: w, actor } = await requireWs(ws, "manage");
  return (
    <ServiceShell ws={w} step="" ctx="서비스 설정">
      <div className="col"><h1>서비스 설정</h1><span className="small muted">카드 색·워드마크·기본 틀은 4 템플릿 탭, 브리프·규칙은 1 목적 탭에 있어요.</span></div>
      <WsSettings w={{ id: w.id, name: w.name, handle: w.handle, startDate: w.startDate, days: w.days, slots: w.slots, categories: w.categories, metricsDays: w.metricsDays ?? 7, plan: w.plan ?? "free", members: w.members?.length ?? 0 }} admin={actor.kind === "admin"} />
    </ServiceShell>
  );
}
