// 문구 규칙 (UX 라이팅) — 카드 글·캡션·주제·AI 답 등 문구가 생기는 모든 곳의 기준. 화면·서버·AI·MCP 가 같이 쓴다.
// 바탕: 토스 UX 라이팅 자료(앱인토스 UX 가이드 · 8가지 라이팅 원칙 · 에러 메시지 원칙 · 마케팅 라이팅). 우리 말로 다시 정리 — docs/WRITING.md

import type { Field } from "./fields";
import type { PostData } from "./types";

/** AI 에게 주는 문구 규칙 (초안·캡션·주제 제안·자료 요약·AI 패널·MCP 안내) */
export const WRITING_GUIDE = [
  "문구 규칙 (UX 라이팅 — 장 글·캡션·주제·답 모두):",
  "1. 해요체로만 써요. '~습니다·~합니다'는 쓰지 않아요. '되어요'는 '돼요', '되었어요'는 '됐어요'.",
  "2. 능동형으로 써요(~됐어요 → ~했어요). '되어지다' 같은 이중 피동은 쓰지 않아요.",
  "3. 긍정형으로: 안 되는 것보다 할 수 있는 것을 말해요(없어요 → ~하면 할 수 있어요). 안전·정책처럼 분명히 알려야 할 때만 부정형.",
  "4. 과한 경어는 빼요: '~시겠어요'·'계시다'·'~께'·'여쭈다' 대신 '~할래요?'·'있다'·'~에게'·'묻다'.",
  "5. 명사 덩어리·한자어는 풀어 써요(이용 가능 → 쓸 수 있어요, 진행 예정 → 할 거예요).",
  "6. 빼도 뜻이 같은 말(혹시·앞으로·일단·다양한), 같은 말 되풀이, 자리 채우기용 문장은 지워요. 한 문장에는 메시지 하나.",
  "7. 소리 내 읽어 자연스러운 쉬운 말로. 전문 용어·유행어·은어·밈은 쓰지 않아요.",
  "8. 강요·겁주기는 하지 않아요(~해야 해요, 놓치면 손해, 마지막 기회 → ~할 수 있어요). 과장도 하지 않아요(최고·역대급·완벽).",
  "9. 다음에 무엇을 하면 되는지 알 수 있게 써요. 행동 유도는 구체적으로(예: '댓글로 내 페이스 남기기').",
  "10. 홍보·행동 유도: 핵심 하나만. 크고 불확실한 혜택보다 확실한 것. 행동은 가볍게(가입 → 준비), 조건은 숫자로(4가지, 3분이면 돼요), 일상 동작 말(찍기·담기·저장하기).",
  "11. 읽는 사람의 마음을 먼저 생각해요(공감 한 줄). 사실·숫자는 자료에 있는 것만.",
].join("\n");

export type WritingRule = "haeyo" | "dwaeyo" | "honorific" | "passive" | "noun" | "weed" | "force" | "hype" | "slang" | "negative" | "long" | "bang";
/** fix = 고쳐야 하는 것(AI 초안은 한 번 다듬는다) · tip = 살펴볼 것 */
export type WritingIssue = { rule: WritingRule; hit: string; tip: string; level: "fix" | "tip" };

const CHECKS: { rule: WritingRule; re: RegExp; tip: string; level: "fix" | "tip" }[] = [
  { rule: "haeyo", re: /[가-힣]*(?:습니다|습니까|십시오|입니다|합니다|됩니다|드립니다|바랍니다)(?=[\s.!?,)"'’”…~]|$)/g, tip: "해요체로 (~해요)", level: "fix" },
  { rule: "dwaeyo", re: /되어요|되었어요|되었다|되어서|되어야/g, tip: "줄여서 (되어요 → 돼요, 되었어요 → 됐어요)", level: "fix" },
  { rule: "honorific", re: /시겠어요|시겠습|계시|계신|께서|[가-힣]*(?:님|분들|분)께|여쭈|여쭤/g, tip: "과한 경어 빼기 (~할래요? · 있어요 · ~에게 · 물어요)", level: "fix" },
  { rule: "passive", re: /되어지|되어진|하게 되었|하게 됐|지게 되었|지게 됐/g, tip: "능동형으로 (~했어요)", level: "tip" },
  { rule: "noun", re: /이용 ?가능|이용 ?불가|불가능합|필수 ?입력|확인 ?요망|진행 ?예정|실시합|요망|미기재|해당 ?없음/g, tip: "풀어 쓰기 (이용 가능 → 쓸 수 있어요)", level: "tip" },
  { rule: "weed", re: /혹시|앞으로|일단|사실상|기본적으로|다양한|다양하게|각종|여러 ?가지/g, tip: "빼도 뜻이 같아요", level: "tip" },
  { rule: "force", re: /반드시|꼭 ?[가-힣]*해야|하지 않으면|안 하면|놓치면|손해|후회|마지막 기회|서두르|큰일 ?나/g, tip: "강요·겁주기 대신 권유 (~할 수 있어요)", level: "tip" },
  { rule: "hype", re: /최고의?|역대급|완벽한?|대박|미친|레전드|끝판왕|기적의?|국내 ?최초|1등/g, tip: "과장 대신 사실·숫자로", level: "tip" },
  { rule: "slang", re: /ㅋㅋ|ㅎㅎ|ㄹㅇ|킹받|존맛|JMT|핵꿀|개꿀|갓생|찐텐|레알/g, tip: "모두가 아는 말로", level: "tip" },
  { rule: "negative", re: /안 돼요|안돼요|못 해요|할 수 없어요|불가해요/g, tip: "할 수 있는 것을 먼저 (긍정형)", level: "tip" },
  { rule: "bang", re: /!{2,}|！{2,}/g, tip: "느낌표는 하나만", level: "tip" },
];
const LONG = 70; // 한 문장 글자 수 (넘으면 메시지 하나로 나누기)

/** 글 하나 검사 (**굵게**·==강조== 표시와 해시태그는 빼고) */
export function lintText(src: string): WritingIssue[] {
  const s = src.replace(/\*\*(.+?)\*\*|==(.+?)==/g, "$1$2").replace(/#[^\s#]+/g, " ");
  const out: WritingIssue[] = [];
  for (const c of CHECKS) {
    const hits = [...new Set([...s.matchAll(c.re)].map((m) => m[0]))];
    for (const hit of hits.slice(0, 2)) out.push({ rule: c.rule, hit, tip: c.tip, level: c.level });
  }
  const long = s.split(/(?<=[.!?。！？])\s+|\n+/).map((x) => x.trim()).find((x) => x.length > LONG);
  if (long) out.push({ rule: "long", hit: `${long.slice(0, 18)}…(${long.length}자)`, tip: "한 문장에 메시지 하나 (나누기)", level: "tip" });
  return out;
}

const texts = (fields: Field[], obj: Record<string, unknown>): string[] => fields.flatMap((f) =>
  f.type === "text" ? (typeof obj[f.key] === "string" ? [obj[f.key] as string] : [])
    : f.type === "items" && Array.isArray(obj[f.key]) ? (obj[f.key] as Record<string, unknown>[]).flatMap((it) => texts(f.item, it ?? {})) : []);

export type WritingSpot = { slide?: number; caption?: boolean; issues: WritingIssue[] };
/** 게시물 전체: 장마다(1부터) + 캡션 */
export function lintPost(kindsOf: (kind: string) => { fields: Field[] } | undefined, data: PostData | null): WritingSpot[] {
  if (!data) return [];
  const out: WritingSpot[] = [];
  data.slides.forEach((s, i) => {
    const k = kindsOf(s.kind);
    const issues = k ? texts(k.fields, s).flatMap(lintText) : [];
    if (issues.length) out.push({ slide: i + 1, issues });
  });
  const cap = lintText(data.caption ?? "");
  if (cap.length) out.push({ caption: true, issues: cap });
  return out;
}

/** 한 줄 요약: "'습니다' 해요체로 (~해요) · '혹시' 빼도 뜻이 같아요" (같은 규칙은 하나로) */
export function issueLine(issues: WritingIssue[], max = 3) {
  const seen = new Set<WritingRule>();
  return issues.filter((x) => !seen.has(x.rule) && (seen.add(x.rule), true)).slice(0, max).map((x) => `'${x.hit}' ${x.tip}`).join(" · ");
}

/** AI 에게 고칠 곳을 알려 줄 글 */
export function fixList(spots: WritingSpot[], onlyFix = true) {
  return spots.map((p) => {
    const is = p.issues.filter((x) => !onlyFix || x.level === "fix");
    return is.length ? `- ${p.caption ? "캡션" : `${p.slide}장`}: ${is.map((x) => `'${x.hit}' → ${x.tip}`).join(", ")}` : "";
  }).filter(Boolean).join("\n");
}
