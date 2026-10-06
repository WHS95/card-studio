import "server-only";
import { readDb } from "./store";
import { briefDone } from "./presets";
import { metricsDue } from "./ops";
import type { Workspace } from "./types";

// 서비스 안 8단계(목적 · 자료 조사 · 주제 · 템플릿 · 제작 · 검수 · 발행 · 성과)의 지금 상태.
// 위 단계 탭의 표시(✓ 됨 · ○ 진행 중 · ● 할 일 + 숫자)와 탭 아래 '지금 할 일' 한 줄이 이 값으로 정해진다.

export type StepKey = "brief" | "research" | "ideas" | "template" | "make" | "review" | "publish" | "insights";
export type StepState = "done" | "doing" | "todo";
export type Step = { key: StepKey; n: number; label: string; href: string; state: StepState; count: number; note: string };

export const STEP_LABEL: Record<StepKey, string> = { brief: "목적", research: "자료 조사", ideas: "주제", template: "템플릿", make: "제작", review: "검수", publish: "발행", insights: "성과" };
export const stepHref = (ws: string, k: StepKey) => `/w/${ws}/${{ brief: "brief", research: "research", ideas: "ideas", template: "template", make: "", review: "review", publish: "publish", insights: "insights" }[k]}`.replace(/\/$/, "");

export async function flowOf(w: Workspace) {
  const db = await readDb();
  const posts = db.posts.filter((p) => p.workspace === w.id && !p.archivedAt);
  const ideas = db.ideas.filter((i) => i.workspace === w.id);
  const research = db.research.filter((r) => r.workspace === w.id);
  const due = (await metricsDue(w.id)).length;
  const n = (st: string) => posts.filter((p) => p.status === st).length;
  const pillarsOk = (w.pillars?.length ?? 0) > 0 && w.pillars!.reduce((a, p) => a + p.share, 0) === 100;
  const review = ideas.filter((i) => i.status === "review").length, approved = ideas.filter((i) => i.status === "approved").length;
  const check = research.filter((r) => r.confidence === "check").length;
  const drafts = n("draft"), plans = n("plan"), ok = n("approved"), posted = n("posted");
  const raw: Record<StepKey, [StepState, number, string]> = {
    brief: briefDone(w.brief) && pillarsOk ? ["done", 0, "브리프·기둥이 채워졌어요"] : ["todo", 0, "브리프(소개·대상·말투)와 기둥 비중 100%를 채워 주세요"],
    research: research.length === 0 ? ["todo", 0, "자료를 하나 이상 모아 주세요"] : check ? ["doing", research.length, `확인 필요 자료 ${check}건`] : ["done", research.length, `자료 ${research.length}건`],
    ideas: review ? ["todo", review, `주제 ${review}개가 검수를 기다려요`] : approved ? ["doing", approved, `승인 ${approved}개가 달력을 기다려요`] : ideas.length ? ["done", 0, "검수할 주제가 없어요"] : ["todo", 0, "주제를 하나 이상 내 주세요"],
    template: ["done", 0, `기본 틀이 정해져 있어요`],
    make: plans + drafts ? ["doing", plans + drafts, `기획 ${plans} · 초안 ${drafts}`] : posts.length ? ["done", 0, "만들 게시물이 없어요"] : ["todo", 0, "승인한 주제를 달력에 넣어 주세요"],
    review: drafts ? ["doing", drafts, `초안 ${drafts}편이 승인을 기다려요`] : ["done", 0, "승인 기다리는 초안이 없어요"],
    publish: ok ? ["doing", ok, `승인 ${ok}편이 올릴 차례예요`] : ["done", posted, posted ? `게시 ${posted}편` : "올릴 차례인 게시물이 없어요"],
    insights: due ? ["todo", due, `게시 ${w.metricsDays ?? 7}일 지난 ${due}편 성과를 적어 주세요`] : ["done", 0, "적을 성과가 없어요"],
  };
  const keys = Object.keys(STEP_LABEL) as StepKey[];
  const steps: Step[] = keys.map((k, i) => ({ key: k, n: i + 1, label: STEP_LABEL[k], href: stepHref(w.id, k), state: raw[k][0], count: raw[k][1], note: raw[k][2] }));
  // 지금 할 일: 막히는 것부터
  const order: StepKey[] = ["brief", "ideas", "review", "publish", "insights", "make", "research"];
  const now = order.map((k) => steps.find((s) => s.key === k)!).find((s) => s.state === "todo" || (s.state === "doing" && s.key !== "research")) ?? null;
  return { steps, now, counts: { done: steps.filter((s) => s.state === "done").length, doing: steps.filter((s) => s.state === "doing").length, todo: steps.filter((s) => s.state === "todo").length } };
}
export type Flow = Awaited<ReturnType<typeof flowOf>>;
