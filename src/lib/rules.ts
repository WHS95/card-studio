import { templateOf } from "./templates";
import { NO_RULES, RULE_LABEL, type ContentRules, type PostData } from "./types";
import { issueLine, lintPost } from "./writing";

// 콘텐츠 규칙 검사 (브리프의 규칙 · 경고만, 저장은 막지 않는다). 편집기(화면)와 서버(승인 체크·MCP)가 같이 쓴다.

export type RuleWarning = { rule: keyof ContentRules; slide?: number; text: string };

const plain = (s: string) => s.replace(/\*\*(.+?)\*\*|==(.+?)==/g, "$1$2").trim();
const texts = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(texts) : v && typeof v === "object" ? Object.values(v).flatMap(texts) : []);

export function ruleWarnings(rules: ContentRules | undefined, defaultTemplate: string, template: string, data: PostData | null): RuleWarning[] {
  const r = { ...NO_RULES, ...rules };
  const out: RuleWarning[] = [];
  if (r.templateOnly && template !== defaultTemplate) out.push({ rule: "templateOnly", text: `서비스 기본 틀(${templateOf(defaultTemplate).name})과 다른 템플릿이에요` });
  if (!data) return out;
  const t = templateOf(template);
  if (r.photoEvery) {
    data.slides.forEach((s, i) => {
      const k = t.kinds.find((x) => x.kind === s.kind);
      const photos = (k?.fields ?? []).filter((f) => f.type === "photo");
      const main = photos.find((f) => f.key === "photo") ?? photos[0];
      if (!main) out.push({ rule: "photoEvery", slide: i + 1, text: `${i + 1}장(${k?.label ?? s.kind})은 사진 칸이 없는 장이에요` });
      else if (typeof s[main.key] !== "number") out.push({ rule: "photoEvery", slide: i + 1, text: `${i + 1}장 사진 칸이 비었어요` });
    });
  }
  if (r.coverQuestion && data.slides[0]) {
    const s = data.slides[0];
    const k = t.kinds.find((x) => x.kind === s.kind);
    const key = (k?.fields ?? []).filter((f) => f.type === "text").map((f) => f.key).find((x) => ["title", "hook", "big"].includes(x)) ?? "title";
    const title = plain(String(s[key] ?? ""));
    if (title && !/[?？]$/.test(title)) out.push({ rule: "coverQuestion", slide: 1, text: "표지 제목이 질문(?)으로 끝나지 않아요" });
  }
  if (r.ctaComment && data.slides.length) {
    const last = data.slides[data.slides.length - 1];
    if (!texts(last).some((x) => x.includes("댓글"))) out.push({ rule: "ctaComment", slide: data.slides.length, text: "마지막 장에 '댓글' 유도가 없어요" });
  }
  if (r.uxWriting) {
    for (const spot of lintPost((k) => t.kinds.find((x) => x.kind === k), data))
      out.push({ rule: "uxWriting", slide: spot.slide, text: `${spot.caption ? "캡션" : `${spot.slide}장`} 문구: ${issueLine(spot.issues)}` });
  }
  return out;
}

export const ruleLine = (w: RuleWarning) => `${w.text} · ${RULE_LABEL[w.rule].label}`;
