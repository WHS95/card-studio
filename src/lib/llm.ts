import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { OpError } from "./ops";
import { getKey } from "./secrets";
import { mutate, readDb } from "./store";
import { AI_TIERS, AI_VIA } from "./types";
import type { Actor } from "./auth";
import type { AiConfig, AiTier, AiVia, Effort, TierSetting } from "./types";
import { WRITING_GUIDE } from "./writing";

// AI 연결 한 곳. 연결 4가지 중 켜 둔 것을 작업 등급(판단·쓰기·다듬기)마다 골라 쓴다.
//  · claude-code / codex: 이 Mac 에 설치·로그인된 CLI 를 실행한다(구독). 스튜디오는 로그인 토큰을 받지 않는다.
//    Anthropic·OpenAI 정책상 구독은 본인 사용만 — 운영자 본인이 이 Mac(로컬 개발 서버)에서 부를 때만 쓴다.
//    함께 쓰는 계정·MCP 로 들어온 요청·배포한 서버에서는 쓰지 않는다(그쪽은 API 키 또는 각자 AI 구독).
//  · anthropic / openai: API 키 (.env.local 이 먼저, 없으면 설정 화면에서 넣은 값). 쓴 만큼 요금.

export const CLAUDE_MODELS = [
  { id: "claude-fable-5-1", label: "Fable 5.1 · 가장 강함 · 가장 느림" },
  { id: "claude-opus-5-5", label: "Opus 5.5 · 강함" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5 · 빠름" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 · 가장 빠름" },
];
export const DEFAULT_AI: AiConfig = {
  enabled: ["anthropic"],
  tiers: {
    judge: { via: "anthropic", model: process.env.STUDIO_AI_MODEL || "claude-opus-5-5", effort: "high" },
    write: { via: "anthropic", model: "claude-sonnet-5-5", effort: "medium" },
    polish: { via: "anthropic", model: "claude-haiku-4-5-20251001", effort: "low" },
  },
};
export const PRESETS: Record<"best" | "save" | "max", (via: AiVia, pick: (i: number) => string) => Record<AiTier, TierSetting>> = {
  best: (via, m) => ({ judge: { via, model: m(1), effort: "high" }, write: { via, model: m(2), effort: "medium" }, polish: { via, model: m(3), effort: "low" } }),
  save: (via, m) => ({ judge: { via, model: m(1), effort: "medium" }, write: { via, model: m(3), effort: "low" }, polish: { via, model: m(3), effort: "low" } }),
  max: (via, m) => ({ judge: { via, model: m(0), effort: "high" }, write: { via, model: m(1), effort: "high" }, polish: { via, model: m(2), effort: "medium" } }),
};

export async function aiConfig(): Promise<AiConfig> {
  const c = (await readDb()).ai;
  if (!c) return structuredClone(DEFAULT_AI);
  return { enabled: c.enabled.filter((v) => AI_VIA.includes(v)), tiers: { ...DEFAULT_AI.tiers, ...c.tiers } };
}
export async function saveAiConfig(input: { enabled?: unknown; tiers?: unknown }) {
  const cur = await aiConfig();
  const enabled = Array.isArray(input.enabled) ? AI_VIA.filter((v) => (input.enabled as unknown[]).includes(v)) : cur.enabled;
  const tiers = { ...cur.tiers };
  const t = (input.tiers && typeof input.tiers === "object" ? input.tiers : {}) as Record<string, Partial<TierSetting>>;
  for (const k of AI_TIERS) {
    const x = t[k];
    if (!x) continue;
    tiers[k] = {
      via: AI_VIA.includes(x.via as AiVia) ? (x.via as AiVia) : tiers[k].via,
      model: typeof x.model === "string" ? x.model.trim().slice(0, 80) : tiers[k].model,
      effort: (["high", "medium", "low"] as const).includes(x.effort as Effort) ? (x.effort as Effort) : tiers[k].effort,
    };
  }
  await mutate((db) => { db.ai = { enabled, tiers }; });
  return { enabled, tiers };
}

// ── 쓸 수 있는지 ──
/** 구독(CLI) 연결을 써도 되는 요청인가: 운영자 본인 + 이 Mac 의 개발 서버 */
export const localCliAllowed = (actor: Actor | null) => !!actor && actor.kind === "admin" && process.env.NODE_ENV !== "production" && process.env.STUDIO_LOCAL_CLI !== "0";
const isCli = (v: AiVia) => v === "claude-code" || v === "codex";
const BIN: Record<"claude-code" | "codex", string> = { "claude-code": process.env.CLAUDE_BIN || "claude", codex: process.env.CODEX_BIN || "codex" };

function run(cmd: string, args: string[], o: { input?: string; timeout?: number; env?: Record<string, string> } = {}) {
  return new Promise<{ code: number; out: string; err: string }>((resolve) => {
    let out = "", err = "";
    let p;
    try { p = spawn(cmd, args, { env: { ...process.env, ...o.env, PATH: `${process.env.PATH ?? ""}:/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin` }, stdio: ["pipe", "pipe", "pipe"] }); }
    catch { return resolve({ code: -1, out: "", err: "실행하지 못했어요" }); }
    const t = setTimeout(() => p.kill("SIGTERM"), o.timeout ?? 120_000);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", () => { clearTimeout(t); resolve({ code: -1, out, err: err || "찾지 못했어요" }); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code: code ?? -1, out, err }); });
    if (o.input !== undefined) p.stdin.end(o.input); else p.stdin.end();
  });
}

/** 연결마다 상태 (설정 화면) */
export async function viaStatus(actor: Actor | null) {
  const cli = async (v: "claude-code" | "codex") => {
    if (!localCliAllowed(actor)) return { ok: false, note: "운영자 본인이 이 Mac 에서 쓸 때만" };
    const r = await run(BIN[v], ["--version"], { timeout: 10_000 });
    return r.code === 0 ? { ok: true, note: r.out.trim().split("\n")[0].slice(0, 60) } : { ok: false, note: "이 Mac 에서 찾지 못했어요" };
  };
  return {
    "claude-code": await cli("claude-code"),
    codex: await cli("codex"),
    anthropic: getKey("anthropic") ? { ok: true, note: `키 …${getKey("anthropic")!.slice(-4)}` } : { ok: false, note: "키 없음" },
    openai: getKey("openai") ? { ok: true, note: `키 …${getKey("openai")!.slice(-4)}` } : { ok: false, note: "키 없음" },
  } satisfies Record<AiVia, { ok: boolean; note: string }>;
}

/** 이 요청에서 이 등급이 실제로 쓸 연결 (못 쓰면 켜 둔 API 키 연결로, 그것도 없으면 null) */
export async function pickVia(tier: AiTier, actor: Actor | null): Promise<TierSetting | null> {
  const c = await aiConfig();
  const usable = (v: AiVia) => c.enabled.includes(v) && (isCli(v) ? localCliAllowed(actor) : !!getKey(v as "anthropic" | "openai"));
  const t = c.tiers[tier];
  if (usable(t.via)) return t;
  if (usable("anthropic")) return { via: "anthropic", model: t.via === "anthropic" ? t.model : DEFAULT_AI.tiers[tier].model, effort: t.effort };
  if (usable("openai")) return { via: "openai", model: c.tiers[tier].via === "openai" ? c.tiers[tier].model : "", effort: t.effort };
  return null;
}
export async function aiReady(actor: Actor | null) { return !!(await pickVia("judge", actor)); }
const NO_AI = "AI 연결이 없어요. 설정 · AI 에서 연결하거나, 내 Claude·ChatGPT 에 이 스튜디오를 붙여(MCP) 써 주세요";

// ── 한 번 묻고 답 받기 ──
export type Ask = { system: string; prompt: string; webSearch?: boolean; maxTokens?: number };

let aClient: { key: string; c: Anthropic } | null = null;
const anthropic = () => {
  const key = getKey("anthropic") ?? (() => { throw new OpError(NO_AI); })();
  if (aClient?.key !== key) aClient = { key, c: new Anthropic({ apiKey: key }) };
  return aClient.c;
};
const anthropicErr = (e: unknown): never => {
  if (e instanceof OpError) throw e;
  if (e instanceof Anthropic.AuthenticationError) throw new OpError("Anthropic API 키가 맞지 않아요");
  if (e instanceof Anthropic.RateLimitError) throw new OpError("AI 사용량이 많아요. 잠시 뒤 다시 해 주세요");
  if (e instanceof Anthropic.APIError) throw new OpError(`AI 호출이 실패했어요 (${e.status})`);
  throw e;
};

async function askAnthropic(t: TierSetting, q: Ask) {
  type P = Anthropic.Beta.BetaMessageParam;
  const messages: P[] = [{ role: "user", content: q.prompt }];
  let m: Anthropic.Beta.BetaMessage | null = null;
  try {
    for (let i = 0; i < 4; i++) {
      m = await anthropic().beta.messages.stream({
        model: t.model || DEFAULT_AI.tiers.judge.model, max_tokens: q.maxTokens ?? 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
        output_config: { effort: t.effort }, system: q.system, messages,
        ...(q.webSearch ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }] } : {}),
      } as never).finalMessage();
      if (m.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: m.content });
    }
  } catch (e) { anthropicErr(e); }
  if (m!.stop_reason === "refusal") throw new OpError("AI 가 이 요청을 거절했어요. 표현을 바꿔 다시 해 주세요");
  return m!.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
}

async function openaiFetch(path: string, body?: unknown) {
  const key = getKey("openai") ?? (() => { throw new OpError(NO_AI); })();
  const r = await fetch(`https://api.openai.com/v1${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) throw new OpError("OpenAI API 키가 맞지 않아요");
  if (r.status === 429) throw new OpError("AI 사용량이 많아요. 잠시 뒤 다시 해 주세요");
  if (!r.ok) throw new OpError(`OpenAI 호출이 실패했어요 (${r.status})`);
  return r.json() as Promise<Record<string, unknown>>;
}
const openaiText = (j: Record<string, unknown>) => String(j.output_text ?? ((j.output as { type: string; content?: { type: string; text?: string }[] }[] | undefined) ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text).join(""));
async function askOpenAI(t: TierSetting, q: Ask) {
  if (!t.model) throw new OpError("OpenAI 모델을 설정 · AI 에서 골라 주세요");
  const j = await openaiFetch("/responses", { model: t.model, instructions: q.system, input: q.prompt, reasoning: { effort: t.effort }, ...(q.webSearch ? { tools: [{ type: "web_search" }] } : {}) });
  return openaiText(j);
}

async function askClaudeCode(t: TierSetting, q: Ask, extra: string[] = [], timeout = 300_000) {
  // 쓸 수 있는 기본 도구를 정해 둔다 (--allowedTools 는 '묻지 않고 허락'일 뿐이라 막지 못한다): 웹 조사면 웹만, 아니면 없음
  const args = ["-p", "--output-format", "json", "--model", t.model || "claude-sonnet-5-5", "--append-system-prompt", q.system,
    "--tools", q.webSearch ? "WebSearch,WebFetch" : "", ...(q.webSearch ? ["--allowedTools", "WebSearch WebFetch"] : []), ...extra];
  const r = await run(BIN["claude-code"], args, { input: q.prompt, timeout });
  if (r.code !== 0) throw new OpError(`Claude Code 실행이 실패했어요${r.err ? ` (${r.err.trim().split("\n").pop()?.slice(0, 120)})` : ""}. 터미널에서 claude 로그인을 확인해 주세요`);
  try {
    const j = JSON.parse(r.out);
    if (j.subtype === "error_max_turns") throw new OpError(`할 일이 많아 ${j.num_turns ?? ""}단계에서 멈췄어요. 위 카드가 지금까지 한 일이에요 — '이어서 해 줘'라고 보내면 남은 일을 해요`);
    if (j.is_error) throw new OpError(`Claude Code: ${String(j.result ?? "오류").slice(0, 160)}`);
    return String(j.result ?? "");
  }
  catch (e) { if (e instanceof OpError) throw e; return r.out; }
}
async function askCodex(t: TierSetting, q: Ask, extra: string[] = [], timeout = 300_000) {
  const dir = await mkdtemp(join(tmpdir(), "cs-codex-"));
  const out = join(dir, "last.txt");
  try {
    const args = ["exec", "--skip-git-repo-check", "--output-last-message", out, ...(t.model ? ["-m", t.model] : []), ...(q.webSearch ? ["--search"] : []), ...extra, "-"];
    const r = await run(BIN.codex, args, { input: `${q.system}\n\n${q.prompt}`, timeout });
    if (r.code !== 0) throw new OpError(`Codex 실행이 실패했어요${r.err ? ` (${r.err.trim().split("\n").pop()?.slice(0, 120)})` : ""}. 터미널에서 codex 로그인을 확인해 주세요`);
    return await readFile(out, "utf8").catch(() => r.out);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** 등급에 맞는 연결로 한 번 묻는다 */
export async function ask(tier: AiTier, actor: Actor | null, q: Ask) {
  const t = await pickVia(tier, actor);
  if (!t) throw new OpError(NO_AI);
  const text = t.via === "anthropic" ? await askAnthropic(t, q) : t.via === "openai" ? await askOpenAI(t, q) : t.via === "claude-code" ? await askClaudeCode(t, q) : await askCodex(t, q);
  return { text, via: t.via, model: t.model };
}
// ── 조각으로 받기 (편집기 AI 초안: 글이 써지는 모습을 화면에 보여 준다) ──
export type OnText = (chunk: string) => void;
const cliEnv = () => ({ ...process.env, PATH: `${process.env.PATH ?? ""}:/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin` });

function streamClaudeCode(t: TierSetting, q: Ask, onText: OnText, signal?: AbortSignal, timeout = 300_000) {
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--model", t.model || "claude-sonnet-5-5", "--append-system-prompt", q.system, "--tools", ""];
  return new Promise<string>((resolve, reject) => {
    let p;
    try { p = spawn(/*turbopackIgnore: true*/ BIN["claude-code"], args, { env: cliEnv(), stdio: ["pipe", "pipe", "pipe"] }); }
    catch { return reject(new OpError("Claude Code 를 실행하지 못했어요")); }
    let buf = "", err = "", sent = "", result: { subtype?: string; is_error?: boolean; result?: string } | null = null;
    const stop = () => p.kill("SIGTERM");
    const timer = setTimeout(stop, timeout);
    signal?.addEventListener("abort", stop, { once: true });
    p.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let j: { type?: string; event?: { type?: string; delta?: { type?: string; text?: string } }; subtype?: string; is_error?: boolean; result?: string };
        try { j = JSON.parse(line); } catch { continue; }
        if (j.type === "stream_event" && j.event?.type === "content_block_delta" && j.event.delta?.type === "text_delta" && j.event.delta.text) { sent += j.event.delta.text; onText(j.event.delta.text); }
        else if (j.type === "result") result = j;
      }
    });
    p.stderr.on("data", (d: Buffer) => (err += d));
    p.on("error", () => { clearTimeout(timer); reject(new OpError("Claude Code 를 이 Mac 에서 찾지 못했어요")); });
    p.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (signal?.aborted) return reject(new OpError("멈췄어요"));
      if (!result || code !== 0 || result.is_error) return reject(new OpError(`Claude Code 실행이 실패했어요${result?.result ? ` (${String(result.result).slice(0, 120)})` : err ? ` (${err.trim().split("\n").pop()?.slice(0, 120)})` : ""}. 터미널에서 claude 로그인을 확인해 주세요`));
      const text = String(result.result ?? sent);
      if (!sent && text) onText(text); // 조각을 못 받는 버전이면 한 번에
      resolve(text);
    });
    p.stdin.end(q.prompt);
  });
}

async function streamAnthropic(t: TierSetting, q: Ask, onText: OnText, signal?: AbortSignal) {
  let m: Anthropic.Beta.BetaMessage;
  try {
    const st = anthropic().beta.messages.stream({
      model: t.model || DEFAULT_AI.tiers.write.model, max_tokens: q.maxTokens ?? 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: t.effort }, system: q.system, messages: [{ role: "user", content: q.prompt }],
    } as never, { signal });
    st.on("text", (d: string) => onText(d));
    m = await st.finalMessage();
  } catch (e) { if (signal?.aborted) throw new OpError("멈췄어요"); return anthropicErr(e); }
  if (m.stop_reason === "refusal") throw new OpError("AI 가 이 요청을 거절했어요. 표현을 바꿔 다시 해 주세요");
  return m.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
}

async function streamOpenAI(t: TierSetting, q: Ask, onText: OnText, signal?: AbortSignal) {
  if (!t.model) throw new OpError("OpenAI 모델을 설정 · AI 에서 골라 주세요");
  const key = getKey("openai") ?? (() => { throw new OpError(NO_AI); })();
  const r = await fetch("https://api.openai.com/v1/responses", { method: "POST", signal, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: t.model, instructions: q.system, input: q.prompt, reasoning: { effort: t.effort }, stream: true }) }).catch((e) => { if (signal?.aborted) throw new OpError("멈췄어요"); throw e; });
  if (r.status === 401) throw new OpError("OpenAI API 키가 맞지 않아요");
  if (r.status === 429) throw new OpError("AI 사용량이 많아요. 잠시 뒤 다시 해 주세요");
  if (!r.ok || !r.body) throw new OpError(`OpenAI 호출이 실패했어요 (${r.status})`);
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read().catch(() => { throw new OpError(signal?.aborted ? "멈췄어요" : "OpenAI 응답이 끊겼어요"); });
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      try { const j = JSON.parse(line.slice(5)); if (j.type === "response.output_text.delta" && j.delta) { text += j.delta; onText(j.delta); } } catch {}
    }
  }
  return text;
}

/** 등급에 맞는 연결로 묻고, 답을 조각으로 흘려 준다 (Codex 는 한 번에) */
export async function askStream(tier: AiTier, actor: Actor | null, q: Ask, onText: OnText, signal?: AbortSignal) {
  const t = await pickVia(tier, actor);
  if (!t) throw new OpError(NO_AI);
  let text: string;
  if (t.via === "claude-code") text = await streamClaudeCode(t, q, onText, signal);
  else if (t.via === "anthropic") text = await streamAnthropic(t, q, onText, signal);
  else if (t.via === "openai") text = await streamOpenAI(t, q, onText, signal);
  else { text = await askCodex(t, q); onText(text); }
  return { text, via: t.via, model: t.model };
}

/** 요금제 AI 횟수에 세는가 (구독 연결은 그 구독에서 나가므로 세지 않는다) */
export async function countsAgainstPlan(tier: AiTier, actor: Actor | null) { const t = await pickVia(tier, actor); return !!t && !isCli(t.via); }

/** 연결마다 쓸 수 있는 모델 목록 */
export async function modelsOf(v: AiVia): Promise<{ id: string; label: string }[]> {
  if (v === "claude-code") return CLAUDE_MODELS;
  if (v === "anthropic") {
    try { const l = await anthropic().models.list({ limit: 50 }); const got = l.data.map((m) => ({ id: m.id, label: m.display_name || m.id })); return got.length ? got : CLAUDE_MODELS; }
    catch { return CLAUDE_MODELS; }
  }
  if (v === "openai") {
    try { const j = await openaiFetch("/models"); return ((j.data as { id: string }[]) ?? []).map((m) => m.id).filter((id) => /^(gpt|o\d|chatgpt)/.test(id)).sort().reverse().map((id) => ({ id, label: id })); }
    catch { return []; }
  }
  return []; // Codex 는 목록을 알려 주지 않는다 — 비우면 Codex 기본 모델
}

/** '실제로 대화해서 확인' */
export async function testVia(v: AiVia, actor: Actor | null) {
  if (isCli(v) && !localCliAllowed(actor)) throw new OpError("구독 연결은 운영자 본인이 이 Mac 에서만 확인할 수 있어요");
  const c = await aiConfig();
  const t: TierSetting = { via: v, model: Object.values(c.tiers).find((x) => x.via === v)?.model ?? (v === "anthropic" || v === "claude-code" ? "claude-haiku-4-5-20251001" : ""), effort: "low" };
  const q = { system: "짧게 답한다.", prompt: "'연결됐어요'라고만 한국어로 답해 줘.", maxTokens: 200 };
  const text = v === "anthropic" ? await askAnthropic(t, q) : v === "openai" ? await askOpenAI(t, q) : v === "claude-code" ? await askClaudeCode(t, q, [], 90_000) : await askCodex(t, q, [], 90_000);
  return `${text.trim().slice(0, 60)} · ${t.model || "기본 모델"}`;
}

// ── AI 패널 대화: 스튜디오 도구(MCP 와 같은 것)를 써서 실제로 일한다 ──
export type ChatTurn = { role: "user" | "assistant"; text: string };
export type ToolRunner = { tools: { name: string; description: string; inputSchema: Record<string, unknown> }[]; call: (name: string, args: Record<string, unknown>) => Promise<{ text: string; isError?: boolean }> };

const CHAT_SYSTEM = (ctx: string) => `너는 카드뉴스 스튜디오 안의 도우미다. 사용자가 보고 있는 서비스·화면: ${ctx}
스튜디오 도구로 실제로 일한다(주제·자료·게시물·브리프). 규칙: 승인(approved)은 사람이 체크리스트를 보고 한다 — 너는 승인하지 않는다. 사실·숫자는 자료 조사에 출처가 있는 것만. 사진은 search_photos 로 찾아(장소 이름이 나오면 실제 그 장소 사진만) add_media(postId·credit·source) 로 넣고 update_post 로 장의 사진 칸에 번호를 넣는다 — 영상은 직접 올린 것·AI 영상만 되니 사람에게 부탁한다. 새 주제는 검수 대기로 들어간다. 답은 한국어로 짧게, 한 일을 한두 줄로 알려 준다.
장 글·캡션·주제를 쓰거나 고칠 때, 그리고 네 답에도 아래 문구 규칙을 지킨다. 게시물을 고친 뒤엔 check_writing 으로 살펴본다.
${WRITING_GUIDE}`;

export async function chat(actor: Actor, ctx: string, history: ChatTurn[], tools: ToolRunner, mcp: { url: string; token: string } | null) {
  const t = await pickVia("judge", actor);
  if (!t) throw new OpError(NO_AI);
  const system = CHAT_SYSTEM(ctx);
  const turns = history.slice(-12);
  if (t.via === "claude-code" || t.via === "codex") {
    if (!mcp) throw new OpError("이 Mac 의 MCP 토큰(STUDIO_MCP_TOKEN)이 없어 구독 연결로는 도구를 쓸 수 없어요");
    const prompt = turns.map((x) => `${x.role === "user" ? "사용자" : "도우미"}: ${x.text}`).join("\n\n") + "\n\n도우미:";
    if (t.via === "claude-code") {
      const cfg = JSON.stringify({ mcpServers: { "card-studio": { type: "http", url: mcp.url, headers: { Authorization: `Bearer ${mcp.token}`, "X-Studio-Via": "ai" } } } });
      const text = await askClaudeCode(t, { system, prompt }, ["--mcp-config", cfg, "--strict-mcp-config", "--allowedTools", "mcp__card-studio", "--max-turns", "40"], 900_000);
      return { text, via: t.via, model: t.model };
    }
    const text = await askCodex(t, { system, prompt }, ["-c", `mcp_servers.card-studio.url="${mcp.url}"`, "-c", `mcp_servers.card-studio.http_headers={ Authorization = "Bearer ${mcp.token}", "X-Studio-Via" = "ai" }`], 600_000);
    return { text, via: t.via, model: t.model };
  }
  if (t.via === "anthropic") {
    type P = Anthropic.Beta.BetaMessageParam;
    const messages: P[] = turns.map((x) => ({ role: x.role, content: x.text }));
    const defs = tools.tools.map((x) => ({ name: x.name, description: x.description.slice(0, 1000), input_schema: x.inputSchema as Anthropic.Beta.BetaTool.InputSchema }));
    let last = "";
    try {
      for (let i = 0; i < 12; i++) {
        const m = await anthropic().beta.messages.stream({ model: t.model, max_tokens: 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: t.effort }, system, tools: defs, messages } as never).finalMessage();
        last = m.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("") || last;
        const uses = m.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
        if (m.stop_reason !== "tool_use" || !uses.length) break;
        messages.push({ role: "assistant", content: m.content });
        const results = [];
        for (const u of uses) { const r = await tools.call(u.name, (u.input ?? {}) as Record<string, unknown>); results.push({ type: "tool_result" as const, tool_use_id: u.id, content: r.text.slice(0, 20000), is_error: !!r.isError }); }
        messages.push({ role: "user", content: results });
      }
    } catch (e) { anthropicErr(e); }
    return { text: last, via: t.via, model: t.model };
  }
  // openai: Responses API + function tools
  if (!t.model) throw new OpError("OpenAI 모델을 설정 · AI 에서 골라 주세요");
  const defs = tools.tools.map((x) => ({ type: "function", name: x.name, description: x.description.slice(0, 1000), parameters: x.inputSchema, strict: false }));
  let input: unknown[] = turns.map((x) => ({ role: x.role, content: x.text }));
  let last = "";
  for (let i = 0; i < 12; i++) {
    const j = await openaiFetch("/responses", { model: t.model, instructions: system, input, tools: defs, reasoning: { effort: t.effort } });
    last = openaiText(j) || last;
    const calls = ((j.output as { type: string; name?: string; arguments?: string; call_id?: string }[]) ?? []).filter((o) => o.type === "function_call");
    if (!calls.length) break;
    const outs = [];
    for (const c of calls) { let a = {}; try { a = JSON.parse(c.arguments ?? "{}"); } catch { /* 빈 인자 */ } const r = await tools.call(c.name!, a); outs.push({ type: "function_call_output", call_id: c.call_id, output: r.text.slice(0, 20000) }); }
    input = [...input, ...(j.output as unknown[]), ...outs];
  }
  return { text: last, via: t.via, model: t.model };
}

