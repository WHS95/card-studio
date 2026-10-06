import type { PlanId } from "./types";

// 요금제: 서비스(워크스페이스)마다 하나. 결제 연결은 아직 없다 — 환경 변수 운영자가 설정에서 정한다 (docs/HANDOFF.md '정할 것').
// 한도는 ops.ts 에서 실제로 막는다. 환경 변수 운영자는 한도 없음.
export type Plan = { id: PlanId; name: string; price: string; members: number; aiPerMonth: number; videoPerMonth: number; servicesPerOwner: number; note: string };

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", name: "무료", price: "0원", members: 2, aiPerMonth: 20, videoPerMonth: 3, servicesPerOwner: 1, note: "혼자 시작하기 — 서비스 1개, 함께 쓰는 사람 2명(나 포함)" },
  pro: { id: "pro", name: "프로", price: "[가격 미정]", members: 5, aiPerMonth: 300, videoPerMonth: 30, servicesPerOwner: 3, note: "작은 팀 — 검수자를 두고 승인 흐름으로" },
  agency: { id: "agency", name: "에이전시", price: "[가격 미정]", members: 20, aiPerMonth: 2000, videoPerMonth: 200, servicesPerOwner: 20, note: "여러 고객사 서비스를 한 곳에서" },
};
export const planOf = (id: PlanId | undefined) => PLANS[id ?? "free"] ?? PLANS.free;
export const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 7);
