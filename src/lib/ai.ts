import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { templateOf, TEMPLATES } from "./templates";
import { validatePost, type Field } from "./fields";
import { OpError } from "./ops";
import { getKey } from "./secrets";
import type { PostData, Workspace } from "./types";

// 화면 안 AI (선택): ANTHROPIC_API_KEY 가 있을 때만 켜진다. 없으면 MCP(Claude Code)로 같은 일을 한다.
// 돈이 드는 호출이라 사람이 버튼을 누를 때만 부른다. 결과는 늘 사람이 고친 뒤 저장·승인한다.

const MODEL = process.env.STUDIO_AI_MODEL || "claude-opus-5-5";
export const aiEnabled = () => !!getKey("anthropic");

let client: { key: string; c: Anthropic } | null = null;
const ai = () => {
  const key = getKey("anthropic");
  if (!key) throw new OpError("AI 를 쓰려면 운영자가 'AI 연동'에서 Claude 키를 넣어 주세요 (또는 MCP 로 Claude Code 에서)");
  if (client?.key !== key) client = { key, c: new Anthropic({ apiKey: key }) };
  return client.c;
};

const RULES = [
  "모든 글은 한국어로 쓴다.",
  "사실이 아닌 수치·후기·인용을 지어내지 않는다. 모르면 [확인 필요]라고 적는다.",
  "특정 장소·브랜드·제품 이름은 근거 자료가 있을 때만 쓴다.",
  "협찬·광고 내용이면 캡션에 #광고를 붙인다.",
].join("\n");

/** 서비스 브리프를 AI 가 읽는 글로 */
export function briefText(w: Workspace) {
  const b = w.brief;
  const pillars = (w.pillars ?? []).map((p) => `- ${p.name} (${p.share}%, ${templateOf(p.template).name}): ${p.description}`).join("\n");
  return [
    `서비스: ${w.name} (${w.handle || "계정 없음"})`,
    b?.about && `소개: ${b.about}`,
    b?.audience && `대상: ${b.audience}`,
    b?.goals.length && `목표: ${b.goals.join(", ")}`,
    b?.tone && `말투: ${b.tone}`,
    b?.keywords.length && `꼭 넣을 말: ${b.keywords.join(", ")}`,
    b?.banned.length && `쓰지 않을 말: ${b.banned.join(", ")}`,
    b?.cta && `기본 행동 유도: ${b.cta}`,
    pillars && `콘텐츠 기둥:\n${pillars}`,
  ].filter(Boolean).join("\n");
}

type Msg = Anthropic.Beta.BetaMessage;
type Param = Anthropic.Beta.BetaMessageParam;

function textOf(m: Msg) {
  if (m.stop_reason === "refusal") throw new OpError("AI 가 이 요청을 거절했어요. 표현을 바꿔 다시 해 주세요");
  return m.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
}
function jsonOf<T>(s: string): T {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)];
  try { return JSON.parse(m[1] ?? ""); } catch { throw new OpError("AI 답을 읽지 못했어요. 다시 해 주세요"); }
}
/** 거절되면 서버가 다른 모델로 이어 쓰게 (fallbacks "default") */
async function call(params: Omit<Anthropic.Beta.Messages.MessageCreateParamsNonStreaming, "model">) {
  try {
    return await ai().beta.messages.stream({ model: MODEL, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", ...params }).finalMessage();
  } catch (e) {
    if (e instanceof OpError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new OpError("ANTHROPIC_API_KEY 가 맞지 않아요");
    if (e instanceof Anthropic.RateLimitError) throw new OpError("AI 사용량이 많아요. 잠시 뒤 다시 해 주세요");
    if (e instanceof Anthropic.APIError) throw new OpError(`AI 호출이 실패했어요 (${e.status})`);
    throw e;
  }
}

export type IdeaSuggestion = { title: string; pillar: string; angle: string; template: string };

/** 브리프·기둥을 보고 아이디어 n개 (이미 있는 제목은 피한다) */
export async function suggestIdeas(w: Workspace, o: { pillar?: string; count?: number; avoid?: string[]; hint?: string }): Promise<IdeaSuggestion[]> {
  const count = Math.min(10, Math.max(1, o.count ?? 5));
  const pillars = (w.pillars ?? []).map((p) => p.name);
  const m = await call({
    max_tokens: 16000,
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: {
          type: "object", additionalProperties: false, required: ["ideas"],
          properties: { ideas: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "pillar", "angle", "template"], properties: {
            title: { type: "string", description: "카드뉴스 기획 제목, 40자 이내" },
            pillar: { type: "string", description: `기둥 이름 (${pillars.join(", ") || "없음"}) 또는 빈 문자열` },
            angle: { type: "string", description: "어떤 각도·구성으로 풀지 2~3문장" },
            template: { type: "string", enum: TEMPLATES.map((t) => t.id) },
          } } } },
        },
      },
    },
    system: `너는 인스타그램 카드뉴스 기획자다.\n${RULES}`,
    messages: [{ role: "user", content: `${briefText(w)}\n\n템플릿: ${TEMPLATES.map((t) => `${t.id}=${t.name}(${t.description})`).join(", ")}\n이미 있는 아이디어(피할 것): ${(o.avoid ?? []).slice(0, 60).join(" / ") || "없음"}\n${o.pillar ? `기둥 '${o.pillar}'에 맞는 ` : ""}카드뉴스 아이디어 ${count}개를 제안해 줘.${o.hint ? `\n요청: ${o.hint}` : ""}` }],
  });
  const out = jsonOf<{ ideas: IdeaSuggestion[] }>(textOf(m));
  return (out.ideas ?? []).slice(0, count);
}

export type SourceNote = { title: string; url: string; summary: string };

/** 웹 검색으로 주제 자료 조사: 출처 주소 + 한국어 요약 */
export async function researchTopic(w: Workspace, topic: string): Promise<SourceNote[]> {
  const messages: Param[] = [{ role: "user", content: `${briefText(w)}\n\n주제: ${topic}\n\n이 주제로 카드뉴스를 만들 근거 자료를 웹에서 찾아 줘. 믿을 만한 출처 3~6개. 마지막에 다음 JSON 만 \`\`\`json 블록으로 답해: {"sources":[{"title":"자료 제목","url":"https://...","summary":"카드뉴스에 쓸 핵심 사실 3~5줄 (한국어)"}]}` }];
  let m: Msg | null = null;
  for (let i = 0; i < 4; i++) {
    m = await call({ max_tokens: 16000, output_config: { effort: "medium" }, system: `너는 꼼꼼한 자료 조사원이다. 검색 결과에 실제로 있는 주소만 쓴다.\n${RULES}`, tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }], messages });
    if (m.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: m.content });
  }
  const out = jsonOf<{ sources: SourceNote[] }>(textOf(m!));
  return (out.sources ?? []).filter((s) => s.title && /^https:\/\//.test(s.url)).slice(0, 6);
}

/** 템플릿 칸 정의를 AI 가 읽을 글로 */
function schemaText(fields: Field[], pad = "  "): string {
  return fields.map((f) => f.type === "text" ? `${pad}${f.key}: 글 (${f.label}, 최대 ${f.max}자${(f.lines ?? 1) > 1 ? `, ${f.lines}줄까지 \\n 으로` : ", 한 줄"}${f.optional ? ", 비워도 됨" : ""}${f.rich ? ", **굵게**·==강조== 표시를 한두 군데 써도 됨" : ""})`
    : f.type === "photo" ? `${pad}${f.key}: null (사진은 사람이 고른다)`
    : f.type === "toggle" ? `${pad}${f.key}: true/false (${f.label})`
    : f.type === "choice" ? `${pad}${f.key}: ${f.options.map((o) => `"${o.v}"(${o.label})`).join(" | ")} 중 하나 (${f.label}, 기본 "${f.default}")`
    : f.type === "number" ? `${pad}${f.key}: 숫자 ${f.min}~${f.max} (${f.label})`
    : `${pad}${f.key}: 배열 ${f.min}~${f.max}개, 각 항목:\n${schemaText(f.item, pad + "  ")}`).join("\n");
}

/** 기획(제목·메모·자료)으로 장 글·캡션 초안. 템플릿 검사를 통과할 때까지 한 번 더 고친다 */
export async function draftPostData(w: Workspace, p: { template: string; title: string; category: string; note: string; current: PostData | null }, extra: string): Promise<PostData> {
  const t = templateOf(p.template);
  const kinds = t.kinds.map((k) => `- kind "${k.kind}" (${k.label}${k.fixed ? ", 첫 장 고정" : ""}):\n${schemaText(k.fields)}`).join("\n");
  const messages: Param[] = [{ role: "user", content: `${briefText(w)}\n\n기획 제목: ${p.title}\n카테고리: ${p.category}\n메모·자료:\n${p.note || "없음"}\n${extra ? `추가 요청: ${extra}\n` : ""}\n템플릿 '${t.name}' (최대 ${t.maxSlides}장, 첫 장은 ${t.kinds[0].kind}). 장 종류와 칸:\n${kinds}\n\n이 틀에 맞춰 카드뉴스 장 글과 인스타 캡션을 써 줘. 글자 수 제한을 꼭 지킨다(넘치면 안 된다). 캡션은 브리프 말투로, 끝에 기본 해시태그(${w.brief?.hashtags.join(" ") || "없음"})를 포함해 해시태그 30개 이하. 답은 \`\`\`json 블록 하나: {"slides":[{"kind":"...", ...칸}], "caption":"..."}` }];
  for (let i = 0; i < 2; i++) {
    const m = await call({ max_tokens: 16000, output_config: { effort: "medium" }, system: `너는 인스타그램 카드뉴스 카피라이터다. 짧고 또렷하게 쓴다.\n${RULES}`, messages });
    const raw = textOf(m);
    const out = jsonOf<{ slides: Record<string, unknown>[]; caption: string }>(raw);
    const data: PostData = { photos: p.current?.photos ?? [], caption: String(out.caption ?? ""), slides: (out.slides ?? []).map((s) => ({ ...s, kind: String(s.kind) })) };
    // 사진 칸은 지금 고른 사진을 그대로 (같은 순서의 장이면)
    data.slides.forEach((s, n) => { const old = p.current?.slides[n]; if (old && old.kind === s.kind) for (const k of Object.keys(old)) if (/^(photo|photoH|photoY|video)/.test(k)) s[k] = old[k]; });
    const err = validatePost(t, data);
    if (!err) return data;
    messages.push({ role: "assistant", content: raw }, { role: "user", content: `검사에서 틀렸어: ${err}\n고친 JSON 전체를 다시 줘.` });
  }
  throw new OpError("AI 초안이 칸 제한을 맞추지 못했어요. 다시 해 주세요");
}

/** 연결 확인: 모델 정보 한 번 읽기 (돈 안 드는 호출) */
export async function testClaude() {
  try { await ai().models.retrieve(MODEL); return `연결됐어요 (${MODEL})`; }
  catch (e) {
    if (e instanceof OpError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new OpError("Claude 키가 맞지 않아요");
    if (e instanceof Anthropic.NotFoundError) throw new OpError(`키는 맞지만 ${MODEL} 모델을 쓸 수 없어요`);
    throw new OpError("Claude 에 연결하지 못했어요");
  }
}
