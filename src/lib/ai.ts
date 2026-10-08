import "server-only";
import { templateOf, TEMPLATES } from "./templates";
import { validatePost, type Field } from "./fields";
import { OpError } from "./ops";
import { ask, askStream, aiReady, pickVia } from "./llm";
import type { Actor } from "./auth";
import type { AiReview, Post, PostData, SlideData, Workspace } from "./types";
import { WRITING_GUIDE, fixList, lintPost } from "./writing";

// 화면 안 AI (선택): 설정 · AI 에서 연결한 것(이 Mac 의 Claude Code·Codex, API 키)으로 작업 등급마다 부른다(llm.ts).
// 연결이 없으면 MCP(내 Claude·ChatGPT)로 같은 일을 한다. 돈이 드는 호출이라 사람이 버튼을 누를 때만. 결과는 늘 사람이 고친 뒤 저장·승인한다.

export const aiEnabled = (actor: Actor | null) => aiReady(actor);

const RULES = [
  "모든 글은 한국어로 쓴다.",
  "사실이 아닌 수치·후기·인용을 지어내지 않는다. 모르면 [확인 필요]라고 적는다.",
  "특정 장소·브랜드·제품 이름은 근거 자료가 있을 때만 쓴다.",
  "협찬·광고 내용이면 캡션에 #광고를 붙인다.",
  WRITING_GUIDE,
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

function jsonOf<T>(s: string): T {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)];
  try { return JSON.parse(m[1] ?? ""); } catch { throw new OpError("AI 답을 읽지 못했어요. 다시 해 주세요"); }
}

export type IdeaSuggestion = { title: string; pillar: string; angle: string; template: string };

/** 브리프·기둥을 보고 아이디어 n개 (이미 있는 제목은 피한다) · 판단 등급 */
export async function suggestIdeas(w: Workspace, o: { pillar?: string; count?: number; avoid?: string[]; hint?: string }, actor: Actor | null): Promise<IdeaSuggestion[]> {
  const count = Math.min(10, Math.max(1, o.count ?? 5));
  const pillars = (w.pillars ?? []).map((p) => p.name);
  const { text } = await ask("judge", actor, {
    system: `너는 인스타그램 카드뉴스 기획자다.\n${RULES}`,
    prompt: `${briefText(w)}\n\n템플릿: ${TEMPLATES.map((t) => `${t.id}=${t.name}(${t.description})`).join(", ")}\n이미 있는 아이디어(피할 것): ${(o.avoid ?? []).slice(0, 60).join(" / ") || "없음"}\n${o.pillar ? `기둥 '${o.pillar}'에 맞는 ` : ""}카드뉴스 아이디어 ${count}개를 제안해 줘.${o.hint ? `\n요청: ${o.hint}` : ""}\n답은 \`\`\`json 블록 하나: {"ideas":[{"title":"40자 이내","pillar":"기둥 이름(${pillars.join(", ") || "없음"}) 또는 빈 문자열","angle":"어떤 각도·구성으로 풀지 2~3문장","template":"${TEMPLATES.map((t) => t.id).join("|")}"}]}`,
  });
  const out = jsonOf<{ ideas: IdeaSuggestion[] }>(text);
  return (out.ideas ?? []).filter((x) => x && x.title).map((x) => ({ ...x, template: TEMPLATES.some((t) => t.id === x.template) ? x.template : w.defaultTemplate })).slice(0, count);
}

export type SourceNote = { title: string; url: string; summary: string };

/** 웹 검색으로 주제 자료 조사: 출처 주소 + 한국어 요약 · 쓰기 등급 */
export async function researchTopic(w: Workspace, topic: string, actor: Actor | null): Promise<SourceNote[]> {
  const { text } = await ask("write", actor, {
    webSearch: true,
    system: `너는 꼼꼼한 자료 조사원이다. 검색 결과에 실제로 있는 주소만 쓴다.\n${RULES}`,
    prompt: `${briefText(w)}\n\n주제: ${topic}\n\n이 주제로 카드뉴스를 만들 근거 자료를 웹에서 찾아 줘. 믿을 만한 출처 3~6개. 마지막에 다음 JSON 만 \`\`\`json 블록으로 답해: {"sources":[{"title":"자료 제목","url":"https://...","summary":"카드뉴스에 쓸 핵심 사실 3~5줄 (한국어)"}]}`,
  });
  const out = jsonOf<{ sources: SourceNote[] }>(text);
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

type DraftInput = { template: string; title: string; category: string; note: string; current: PostData | null };

/** 초안 요청 글의 공통 부분 (브리프 · 기획 · 템플릿 칸) */
function draftBase(w: Workspace, p: DraftInput, extra: string) {
  const t = templateOf(p.template);
  const kinds = t.kinds.map((k) => `- kind "${k.kind}" (${k.label}${k.fixed ? ", 첫 장 고정" : ""}):\n${schemaText(k.fields)}`).join("\n");
  return `${briefText(w)}\n\n기획 제목: ${p.title}\n카테고리: ${p.category}\n메모·자료:\n${p.note || "없음"}\n${extra ? `추가 요청: ${extra}\n` : ""}\n템플릿 '${t.name}' (최대 ${t.maxSlides}장, 첫 장은 ${t.kinds[0].kind}). 장 종류와 칸:\n${kinds}\n\n이 틀에 맞춰 카드뉴스 장 글과 인스타 캡션을 써 줘. 글자 수 제한을 꼭 지킨다(넘치면 안 된다). 캡션은 브리프 말투로, 끝에 기본 해시태그(${w.brief?.hashtags.join(" ") || "없음"})를 포함해 해시태그 30개 이하.`;
}
const DRAFT_SYSTEM = `너는 인스타그램 카드뉴스 카피라이터다. 짧고 또렷하게 쓴다.\n${RULES}`;

/** 사진 칸은 지금 고른 사진을 그대로 (같은 순서·같은 종류의 장이면) */
function keepPhotos(s: Record<string, unknown>, n: number, current: PostData | null) {
  const old = current?.slides[n];
  if (old && old.kind === s.kind) for (const k of Object.keys(old)) if (/^(photo|photoH|photoY|video)/.test(k)) s[k] = old[k];
  return s;
}

/** 문구 검사(writing.ts)에서 꼭 고칠 것이 나오면 다듬기 등급으로 한 번 고친다. 구조·사실은 그대로, 못 고치면 null */
async function polishWriting(t: ReturnType<typeof templateOf>, data: PostData, current: PostData | null, actor: Actor | null): Promise<PostData | null> {
  const list = fixList(lintPost((k) => t.kinds.find((x) => x.kind === k), data));
  if (!list) return null;
  try {
    const { text } = await ask("polish", actor, {
      system: `너는 UX 라이터다. 사실·숫자·장 구조는 그대로 두고 문구만 고친다.\n${WRITING_GUIDE}`,
      prompt: `아래 카드뉴스 JSON 에서 고칠 곳만 문구 규칙에 맞게 고쳐 줘. 칸 이름·장 순서·장 수·글자 수 제한·**굵게**·==강조== 표시·사진 번호는 그대로 둬.\n고칠 곳:\n${list}\n\nJSON:\n${JSON.stringify({ slides: data.slides, caption: data.caption })}\n\n답은 \`\`\`json 블록 하나: {"slides":[...], "caption":"..."}`,
    });
    const o = jsonOf<{ slides: Record<string, unknown>[]; caption: string }>(text);
    const fixed: PostData = { photos: data.photos, caption: String(o.caption ?? data.caption), slides: (o.slides ?? []).map((s, n) => keepPhotos({ ...s, kind: String(s.kind) }, n, current) as SlideData) };
    return fixed.slides.length === data.slides.length && !validatePost(t, fixed) ? fixed : null;
  } catch { return null; }
}

/** 기획(제목·메모·자료)으로 장 글·캡션 초안. 템플릿 검사를 통과할 때까지 한 번 더 고친다 */
export async function draftPostData(w: Workspace, p: DraftInput, extra: string, actor: Actor | null): Promise<PostData> {
  const t = templateOf(p.template);
  let prompt = `${draftBase(w, p, extra)} 답은 \`\`\`json 블록 하나: {"slides":[{"kind":"...", ...칸}], "caption":"..."}`;
  for (let i = 0; i < 2; i++) {
    const { text: raw } = await ask("write", actor, { system: DRAFT_SYSTEM, prompt });
    const out = jsonOf<{ slides: Record<string, unknown>[]; caption: string }>(raw);
    const data: PostData = { photos: p.current?.photos ?? [], caption: String(out.caption ?? ""), slides: (out.slides ?? []).map((s, n) => keepPhotos({ ...s, kind: String(s.kind) }, n, p.current) as SlideData) };
    const err = validatePost(t, data);
    if (!err) return (await polishWriting(t, data, p.current, actor)) ?? data;
    prompt += `\n\n앞선 답:\n${raw}\n\n검사에서 틀렸어: ${err}\n고친 JSON 전체를 다시 줘.`;
  }
  throw new OpError("AI 초안이 칸 길이를 맞추지 못했어요. 다시 해 주세요");
}

// ── 장마다 써지는 초안 (편집기: 흐린 칸 → 글이 써짐 → 그 장 미리보기) ──
export type DraftEvent =
  | { t: "start"; via: string; model: string }
  | { t: "total"; n: number }
  | { t: "partial"; i: number; slide: Record<string, unknown> }
  | { t: "slide"; i: number; slide: SlideData }
  | { t: "caption"; text: string; done: boolean }
  | { t: "fixing"; reason: string }
  | { t: "polish"; reason: string }
  | { t: "done"; data: PostData; note?: string }
  | { t: "error"; message: string };

/** 덜 온 JSON 한 줄을 읽을 수 있는 데까지 (열린 글·괄호를 닫아 본다) */
export function parsePartial(src: string): Record<string, unknown> | null {
  let s = src.trim();
  if (!s.startsWith("{")) return null;
  for (let tries = 0; tries < 12 && s.length > 1; tries++) {
    let inStr = false, esc = false;
    const stack: string[] = [];
    for (const ch of s) {
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === "{" || ch === "[") stack.push(ch); else if (ch === "}" || ch === "]") stack.pop();
    }
    let c = s;
    if (inStr) { if (esc) c = c.slice(0, -1); c += '"'; }
    c = c.replace(/[\s,]+$/, "");
    if (c.endsWith(":")) c += "null";
    c += stack.reverse().map((x) => (x === "{" ? "}" : "]")).join("");
    try { const v = JSON.parse(c); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch {}
    // 덜 쓴 이름·값을 버리고 앞 칸까지만 다시
    let cut = -1; inStr = false; esc = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === "," || ch === "{" || ch === "[") cut = i;
    }
    if (cut <= 0) return null;
    s = s.slice(0, s[cut] === "," ? cut : cut + 1);
  }
  return null;
}

/** 다 쓴 장을 칸 정의에 맞춘다 (길면 자르고, 모자라면 기본값) — 미리보기가 멈추지 않게. 최종본은 검사·고침을 따로 거친다 */
function fitValue(f: Field, v: unknown, blank: unknown): unknown {
  if (f.type === "text") {
    let s = typeof v === "string" ? v : typeof blank === "string" ? blank : "";
    s = s.split("\n").slice(0, f.lines ?? 1).join("\n").slice(0, f.max);
    return !f.optional && !s.trim() ? (typeof blank === "string" && blank.trim() ? blank.slice(0, f.max) : "…") : s;
  }
  if (f.type === "photo") return undefined;
  if (f.type === "toggle") return typeof v === "boolean" ? v : blank;
  if (f.type === "choice") return typeof v === "string" && f.options.some((o) => o.v === v) ? v : undefined;
  if (f.type === "number") return typeof v === "number" && Number.isFinite(v) ? Math.min(f.max, Math.max(f.min, v)) : undefined;
  const arr = (Array.isArray(v) ? v : []).slice(0, f.max) as Record<string, unknown>[];
  const bl = (Array.isArray(blank) ? blank : []) as Record<string, unknown>[];
  while (arr.length < f.min) arr.push(bl[arr.length] ?? {});
  return arr.map((it, i) => Object.fromEntries(f.item.map((sub) => [sub.key, fitValue(sub, it?.[sub.key], bl[i]?.[sub.key])]).filter(([, x]) => x !== undefined)));
}
function fitSlide(t: ReturnType<typeof templateOf>, raw: Record<string, unknown>, n: number): SlideData | null {
  const k = t.kinds.find((x) => x.kind === raw.kind && (!x.fixed || n === 0)) ?? (n === 0 ? t.kinds[0] : null);
  if (!k) return null;
  const blank = k.blank() as Record<string, unknown>;
  const out: Record<string, unknown> = { kind: k.kind };
  for (const f of k.fields) { const v = fitValue(f, raw[f.key], blank[f.key]); if (v !== undefined) out[f.key] = v; }
  return out as SlideData;
}

/** 초안을 줄마다(장 하나 = JSON 한 줄) 흘려 받으며 이벤트로 알린다. 저장은 하지 않는다(편집기에서 사람이) */
export async function draftPostStream(w: Workspace, p: DraftInput, extra: string, actor: Actor | null, emit: (e: DraftEvent) => void, signal?: AbortSignal) {
  const t = templateOf(p.template);
  const via = await pickVia("write", actor);
  if (!via) throw new OpError("AI 연결이 없어요. 설정 · AI 에서 연결해 주세요");
  emit({ t: "start", via: via.via, model: via.model });
  const prompt = `${draftBase(w, p, extra)}\n\n답 형식(꼭 지킨다): 코드 블록 없이 JSON 을 한 줄에 하나씩.\n1줄: {"total": 장 수(1~${t.maxSlides})}\n그다음 장마다 한 줄: {"kind":"...", ...칸} (첫 장은 "${t.kinds[0].kind}", 장 순서대로)\n마지막 줄: {"caption":"..."}\n글 안의 줄바꿈은 \\n 으로 쓴다. 다른 말은 쓰지 않는다.`;
  const raws: Record<string, unknown>[] = [];
  let caption = "", buf = "", lastPartial = 0, lastSent = "";
  const line = (l: string) => {
    const s = l.trim().replace(/^```(json)?/, "").trim();
    if (!s.startsWith("{")) return;
    let o: Record<string, unknown>;
    try { o = JSON.parse(s); } catch { return; }
    if (typeof o.total === "number") emit({ t: "total", n: Math.min(t.maxSlides, Math.max(1, Math.round(o.total))) });
    else if (typeof o.caption === "string" && !o.kind) { caption = o.caption; emit({ t: "caption", text: caption, done: true }); }
    else if (typeof o.kind === "string") {
      const n = raws.length;
      raws.push(o);
      const fit = fitSlide(t, o, n);
      if (fit) emit({ t: "slide", i: n, slide: keepPhotos(fit, n, p.current) as SlideData });
    }
  };
  const { text } = await askStream("write", actor, { system: DRAFT_SYSTEM, prompt }, (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); lastSent = ""; }
    const now = Date.now();
    if (now - lastPartial < 70) return;
    const part = parsePartial(buf);
    if (!part) return;
    const key = JSON.stringify(part);
    if (key === lastSent) return;
    lastPartial = now; lastSent = key;
    if (typeof part.kind === "string") emit({ t: "partial", i: raws.length, slide: part });
    else if (typeof part.caption === "string") emit({ t: "caption", text: part.caption, done: false });
  }, signal);
  if (buf.trim()) line(buf);
  if (!raws.length) {
    // 줄 형식을 안 지켰으면 (```json 한 덩어리 등) 통째로 읽어 본다
    try { const o = jsonOf<{ slides?: Record<string, unknown>[]; caption?: string }>(text); (o.slides ?? []).forEach((x) => raws.push(x)); caption = String(o.caption ?? caption); } catch {}
  }
  const data: PostData = { photos: p.current?.photos ?? [], caption, slides: raws.map((s, n) => keepPhotos({ ...s, kind: String(s.kind) }, n, p.current) as SlideData) };
  const finish = async (d: PostData, note?: string) => {
    // 문구 규칙에서 꼭 고칠 것이 있으면 한 번 다듬는다 (못 고치면 그대로)
    if (fixList(lintPost((k) => t.kinds.find((x) => x.kind === k), d))) {
      emit({ t: "polish", reason: "문구를 다듬고 있어요" });
      const better = await polishWriting(t, d, p.current, actor);
      if (better) d = better;
    }
    emit(note ? { t: "done", data: d, note } : { t: "done", data: d });
  };
  let err = validatePost(t, data);
  if (!err) return finish(data);
  // 칸 검사에서 틀렸으면: 한 번 고쳐 달라고 (조각 없이), 그래도 틀리면 칸에 맞춰 자른 것으로
  emit({ t: "fixing", reason: err });
  try {
    const { text: raw } = await ask("write", actor, { system: DRAFT_SYSTEM, prompt: `${draftBase(w, p, extra)}\n\n앞선 답:\n${text}\n\n검사에서 틀렸어: ${err}\n고친 전체를 \`\`\`json 블록 하나로: {"slides":[{"kind":"...", ...칸}], "caption":"..."}` });
    const o = jsonOf<{ slides: Record<string, unknown>[]; caption: string }>(raw);
    const fixed: PostData = { photos: data.photos, caption: String(o.caption ?? caption), slides: (o.slides ?? []).map((s, n) => keepPhotos({ ...s, kind: String(s.kind) }, n, p.current) as SlideData) };
    err = validatePost(t, fixed);
    if (!err) return finish(fixed);
  } catch (e) { if (signal?.aborted) throw e; }
  const fitted: PostData = { photos: data.photos, caption: caption.slice(0, 2200), slides: raws.map((s, n) => fitSlide(t, s, n)).filter((x): x is SlideData => !!x).slice(0, t.maxSlides).map((s, n) => keepPhotos(s, n, p.current) as SlideData) };
  if (!validatePost(t, fitted)) return finish(fitted, "칸보다 긴 글을 칸 길이에 맞춰 잘랐어요. 잘린 곳을 확인해 주세요");
  throw new OpError("AI 초안이 칸 길이를 맞추지 못했어요. 다시 해 주세요");
}

// ── 검수: AI 종합 피드백 (편집기 '검수' 창, 사람이 누를 때만 · 판단 등급) ──

/** 장 글을 AI 가 읽을 글로 (사진 칸·조절 값은 뺀다) */
function slidesText(t: ReturnType<typeof templateOf>, data: PostData) {
  return data.slides.map((s, n) => {
    const k = t.kinds.find((x) => x.kind === s.kind);
    const keep = Object.fromEntries(Object.entries(s).filter(([key, v]) => key !== "kind" && !/^(photo|video)/.test(key) && v !== null && v !== "" && !(k?.fields.find((f) => f.key === key)?.type === "choice")));
    return `${n + 1}장 (${k?.label ?? s.kind}): ${JSON.stringify(keep)}`;
  }).join("\n");
}

export type AiFeedback = Omit<AiReview, "by" | "at" | "for">;

/** 게시물 전체를 보고 총평 · 잘된 점 · 고칠 것(고친 문구 제안). 자동 확인 결과는 받아서 되풀이하지 않는다. 승인은 하지 않는다 */
export async function reviewPost(w: Workspace, p: Post, auto: string[], research: { title: string; summary: string; confidence: string }[], actor: Actor | null): Promise<AiFeedback> {
  if (!p.data) throw new OpError("저장된 글이 없어요. 글을 채우고 저장한 뒤 검수해 주세요");
  const t = templateOf(p.template);
  const { text } = await ask("judge", actor, {
    system: `너는 인스타그램 카드뉴스 편집장이다. 올리기 전에 게시물 전체를 보고 짧고 구체적으로 피드백한다. 승인은 사람이 한다.\n${RULES}`,
    prompt: `${briefText(w)}\n\n게시물: ${p.title || "제목 없음"} (카테고리 ${p.category}, 템플릿 ${t.name}, ${p.data.slides.length}장)\n메모: ${p.note || "없음"}\n근거 자료:\n${research.map((r) => `- [${r.confidence === "check" ? "확인 필요" : r.confidence === "high" ? "믿을 만함" : "보통"}] ${r.title}: ${r.summary.slice(0, 300)}`).join("\n") || "없음"}\n\n장 글:\n${slidesText(t, p.data)}\n\n캡션:\n${p.data.caption || "(비어 있음)"}\n\n스튜디오 자동 확인 결과 (사람에게 이미 보여 줬으니 되풀이하지 말 것):\n${auto.map((x) => `- ${x}`).join("\n")}\n\n다음을 봐 줘: 표지가 넘겨 보고 싶게 하는지, 장 흐름(문제 → 내용 → 행동)이 자연스러운지, 브리프의 대상·말투에 맞는지, 근거 자료에 없는 사실·숫자가 있는지, 문구 규칙, 캡션 첫 두 줄과 행동 유도, 해시태그.\n고칠 것은 중요한 것부터 6개까지, 고친 문구를 직접 제안해(칸 글자 수 안에서). 고칠 게 없으면 fix 는 빈 배열.\n답은 \`\`\`json 블록 하나: {"verdict":"ready 또는 fix","summary":"한두 문장 총평","good":["잘된 점 1~3개"],"fix":[{"slide":장 번호(캡션이나 전체는 0),"what":"무엇이 문제인지 한 문장","how":"이렇게 고쳐 보세요 + 고친 문구"}]}`,
  });
  const o = jsonOf<Partial<AiFeedback>>(text);
  const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const n = p.data.slides.length;
  return {
    verdict: o.verdict === "ready" ? "ready" : "fix",
    summary: str(o.summary, 300) || "총평을 받지 못했어요",
    good: (Array.isArray(o.good) ? o.good : []).map((x) => str(x, 200)).filter(Boolean).slice(0, 3),
    fix: (Array.isArray(o.fix) ? o.fix : []).map((f) => ({ slide: Math.min(n, Math.max(0, Math.round(Number(f?.slide)) || 0)), what: str(f?.what, 200), how: str(f?.how, 400) })).filter((f) => f.what).slice(0, 6),
  };
}
