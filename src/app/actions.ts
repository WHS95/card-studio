"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkLogin, clearSession, loginUser, requireAuth, setSession, setUserSession, wsAccess, type Perm } from "@/lib/auth";
import { addMember, changePassword, removeMember, resetMemberPassword, setMemberRole, setPlan, countAi, addResearch, applyShareSuggestion, archivePost, createIdea, createPostIn, dismissSuggestion, duplicatePost, followUpIdea, insights, movePost, nextEmptySlot, restorePost, scheduleIdeas, setDisplayName, setMetrics, createWorkspace, OpError, removeResearch, savePost, scheduleIdea, setPillars, setStatus, toggleFavorite, updateBrief, updateIdea, updateResearch, updateWorkspace } from "@/lib/ops";
import { type PostData, type PostStatus } from "@/lib/types";
import { getIdea, getPost, getResearch, listIdeas } from "@/lib/store";
import { templateOf } from "@/lib/templates";
import { setKey, type Provider } from "@/lib/secrets";
import { createPat, getClient, issueCode, revokeToken } from "@/lib/tokens";
import { baseUrl } from "@/lib/baseurl";
import { headers } from "next/headers";
import { testGemini } from "@/lib/veo";
import { draftPostData, researchTopic, suggestIdeas, type IdeaSuggestion } from "@/lib/ai";
import { chat, countsAgainstPlan, saveAiConfig, testVia, type ChatTurn } from "@/lib/llm";
import { callTool, TOOLS } from "@/lib/mcp";
import { AI_VIA, type AiTier, type AiVia } from "@/lib/types";

// 화면용 얇은 껍데기 — 규칙은 전부 src/lib/ops.ts (MCP 와 같이 씀)

/** 서비스 권한 확인 (try 안에서 부른다 — 모자라면 OpError) */
async function gateWs(ws: string, perm: Perm) {
  await requireAuth();
  const a = await wsAccess(ws, perm);
  if (!a) throw new OpError("이 일은 권한이 없어요");
  return a;
}
async function gatePost(id: string, perm: Perm) {
  const p = await getPost(id);
  if (!p) throw new OpError("게시물을 찾지 못했어요");
  return { ...(await gateWs(p.workspace, perm)), post: p };
}
/** 아이디어·자료는 그 서비스 것인지까지 */
async function gateOwned(kind: "idea" | "research", id: string, ws: string) {
  const x = kind === "idea" ? await getIdea(id) : await getResearch(id);
  if (!x || x.workspace !== ws) throw new OpError("찾지 못했어요");
  return gateWs(ws, "edit");
}

const msg = (e: unknown) => (e instanceof OpError ? e.message : (console.error(e), "잠시 뒤 다시 해 주세요"));

export async function loginAction(_p: { error?: string } | undefined, fd: FormData) {
  const id = String(fd.get("id") ?? ""), pw = String(fd.get("password") ?? "");
  // 운영자(환경 변수) 먼저, 아니면 계정(이메일)
  if (checkLogin(id, pw)) await setSession();
  else if (!(id.includes("@") && (await loginUser(id, pw)))) return { error: "아이디나 비밀번호가 맞지 않아요" };
  // 로그인 뒤 돌아갈 곳 (AI 앱 연결 동의 화면 등, 이 사이트 안 주소만)
  const next = String(fd.get("next") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) redirect(next);
  redirect("/");
}
export async function logoutAction() { await clearSession(); redirect("/login"); }

export async function createWorkspaceAction(fd: FormData) {
  const actor = await requireAuth();
  let id = "";
  try { id = (await createWorkspace({ id: fd.get("id"), name: fd.get("name"), handle: fd.get("handle"), accent: fd.get("accent"), industry: fd.get("industry"), about: fd.get("about") }, actor.kind === "user" ? actor.id : undefined)).id; }
  catch (e) { redirect(`/?error=${encodeURIComponent(msg(e))}`); }
  // 새 서비스는 브리프부터 (무엇을 · 누구에게 · 어떤 말투로)
  redirect(`/w/${id}/brief?new=1`);
}

/** 서비스 설정(이름·계정·달력·성과 날짜·요금제) 또는 템플릿 탭(기본 틀·카드 색·워드마크) — 보낸 칸만 바꾼다 */
export async function saveWorkspaceAction(_p: SaveState, fd: FormData): Promise<SaveState> {
  await requireAuth();
  const id = String(fd.get("ws"));
  const list = (k: string) => String(fd.get(k) ?? "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  const g = (k: string) => (fd.has(k) ? String(fd.get(k) ?? "") : undefined);
  try {
    const { actor } = await gateWs(id, "manage");
    if (actor.kind === "admin" && fd.get("plan")) await setPlan(id, String(fd.get("plan")));
    const theme = fd.has("accent") ? { dark: g("dark"), light: g("light"), ink: g("ink"), muted: g("muted"), accent: g("accent"), onAccent: g("onAccent"), wordmark: { text: g("wordmark"), color: g("wmColor"), bg: g("wmBg") } } : undefined;
    await updateWorkspace(id, {
      name: g("name"), handle: g("handle"), categories: fd.has("categories") ? list("categories") : undefined, slots: fd.has("slots") ? list("slots") : undefined,
      days: fd.has("days") ? Number(g("days")) : undefined, startDate: fd.has("startDate") ? g("startDate") || null : undefined, defaultTemplate: g("defaultTemplate"),
      metricsDays: fd.has("metricsDays") ? Number(g("metricsDays")) : undefined, theme,
    });
    revalidatePath(`/w/${id}`, "layout");
    return { ok: true };
  } catch (e) { return { error: msg(e) }; }
}

/** 달력 빈칸 → 기획 게시물 만들고 편집기로 (이미 있으면 그 게시물로) */
export async function createPostAction(fd: FormData) {
  await requireAuth();
  const ws = String(fd.get("ws"));
  let id = "";
  try { await gateWs(ws, "edit"); id = (await createPostIn(ws, { day: Number(fd.get("day")), slot: String(fd.get("slot")) })).post.id; }
  catch (e) { redirect(`/w/${ws}?error=${encodeURIComponent(msg(e))}`); }
  redirect(`/w/${ws}/p/${id}`);
}

export type SaveState = { ok?: boolean; error?: string } | undefined;
export async function savePostAction(_p: SaveState, fd: FormData): Promise<SaveState> {
  await requireAuth();
  let data: unknown;
  try { data = JSON.parse(String(fd.get("data") ?? "")); } catch { return { error: "형식이 맞지 않아요" }; }
  try {
    await gatePost(String(fd.get("id")), "edit");
    const p = await savePost(String(fd.get("id")), { data, template: String(fd.get("template") ?? ""), title: String(fd.get("title") ?? ""), category: String(fd.get("category") ?? "") });
    revalidatePath(`/w/${p.workspace}`);
    revalidatePath(`/w/${p.workspace}/p/${p.id}`);
    return { ok: true };
  } catch (e) { return { error: msg(e) }; }
}

export async function setStatusAction(_p: SaveState, fd: FormData): Promise<SaveState> {
  await requireAuth();
  try {
    const to = String(fd.get("status")) as PostStatus;
    const cur = (await getPost(String(fd.get("id"))))?.status;
    // 승인·게시 표시·게시 취소는 검수 권한, 나머지(초안으로·건너뛰기)는 편집 권한
    const { actor } = await gatePost(String(fd.get("id")), to === "approved" || to === "posted" || cur === "posted" ? "approve" : "edit");
    const p = await setStatus(String(fd.get("id")), to, String(fd.get("postedUrl") ?? ""), { checks: fd.getAll("check").map(String), by: actor.name });
    revalidatePath(`/w/${p.workspace}`);
    revalidatePath(`/w/${p.workspace}/p/${p.id}`);
    return { ok: true };
  } catch (e) { return { error: msg(e) }; }
}

// ── 브리프 · 기둥 · 아이디어 · 자료 ──

const back = (to: string, e: unknown): never => redirect(`${to}${to.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg(e))}`);

/** 브리프 + 기둥 한 번에 (편집 화면이 JSON 으로 보낸다) */
export async function saveBriefAction(_p: SaveState, fd: FormData): Promise<SaveState> {
  await requireAuth();
  const ws = String(fd.get("ws"));
  try {
    await gateWs(ws, "edit");
    const body = JSON.parse(String(fd.get("body") ?? "{}"));
    await updateBrief(ws, body.brief ?? {});
    await setPillars(ws, body.pillars ?? []);
    revalidatePath(`/w/${ws}`, "layout");
    return { ok: true };
  } catch (e) { return { error: e instanceof SyntaxError ? "형식이 맞지 않아요" : msg(e) }; }
}

export async function createIdeaAction(fd: FormData) {
  await requireAuth();
  const ws = String(fd.get("ws"));
  try { await gateWs(ws, "edit"); await createIdea(ws, { title: fd.get("title"), pillar: fd.get("pillar"), angle: fd.get("angle"), template: fd.get("template"), research: fd.getAll("research").map(String) }); }
  catch (e) { back(`/w/${ws}/ideas`, e); }
  revalidatePath(`/w/${ws}/ideas`);
  redirect(`/w/${ws}/ideas${fd.get("from") === "research" ? "?ok=added" : ""}`);
}

export async function updateIdeaAction(fd: FormData) {
  await requireAuth();
  const ws = String(fd.get("ws")), id = String(fd.get("id"));
  const g = (k: string) => (fd.has(k) ? fd.get(k) : undefined);
  try {
    // 주제 승인·승인 취소는 소유자·검수자(approve) — 검수자는 편집 권한이 없어도 된다. 그 밖의 고침은 편집 권한
    const cur = await getIdea(id);
    if (!cur || cur.workspace !== ws) throw new OpError("찾지 못했어요");
    const approving = g("status") === "approved" || (g("status") === "review" && cur.status === "approved" && !fd.has("title"));
    const { actor } = approving ? await gateWs(ws, "approve") : await gateOwned("idea", id, ws);
    await updateIdea(id, { title: g("title"), pillar: g("pillar"), angle: g("angle"), template: g("template"), status: g("status"), research: fd.has("researchSet") ? fd.getAll("research").map(String) : undefined }, actor.name);
  }
  catch (e) { back(`/w/${ws}/ideas`, e); }
  revalidatePath(`/w/${ws}/ideas`);
  redirect(`/w/${ws}/ideas`);
}

/** 아이디어 → 달력 (칸을 고르면 그 칸, 아니면 비어 있는 첫 칸) → 편집기로 */
export async function scheduleIdeaAction(fd: FormData) {
  await requireAuth();
  const ws = String(fd.get("ws"));
  const spot = String(fd.get("spot") ?? "");
  const m = /^(\d+) (\d\d:\d\d)$/.exec(spot);
  let post = null;
  try { await gateOwned("idea", String(fd.get("id")), ws); post = await scheduleIdea(String(fd.get("id")), m ? { day: m[1], slot: m[2] } : undefined); }
  catch (e) { back(`/w/${ws}/ideas`, e); }
  revalidatePath(`/w/${ws}`, "layout");
  redirect(`/w/${ws}/p/${post!.id}`);
}

/** 승인한 주제 여러 개 → 고른 순서대로 빈 칸에 하루씩 */
export async function scheduleIdeasAction(fd: FormData) {
  await requireAuth();
  const ws = String(fd.get("ws"));
  const ids = String(fd.get("order") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  try {
    await gateWs(ws, "edit");
    if (!ids.length) throw new OpError("달력에 넣을 주제를 골라 주세요");
    for (const id of ids) await gateOwned("idea", id, ws);
    await scheduleIdeas(ids, Number(fd.get("from") ?? 1));
  } catch (e) { back(`/w/${ws}/ideas?s=approved`, e); }
  revalidatePath(`/w/${ws}`, "layout");
  redirect(`/w/${ws}?ok=${ids.length}`);
}

export async function addResearchAction(fd: FormData) {
  await requireAuth();
  const ws = String(fd.get("ws"));
  try { await gateWs(ws, "edit"); await addResearch(ws, { title: fd.get("title"), url: fd.get("url"), summary: fd.get("summary"), memo: fd.get("memo"), tags: fd.get("tags"), confidence: fd.get("confidence") }); }
  catch (e) { back(`/w/${ws}/research`, e); }
  revalidatePath(`/w/${ws}/research`);
  redirect(`/w/${ws}/research`);
}

export async function updateResearchAction(fd: FormData) {
  await requireAuth();
  const ws = String(fd.get("ws")), id = String(fd.get("id"));
  try {
    await gateOwned("research", id, ws);
    if (fd.get("op") === "remove") await removeResearch(id);
    else if (fd.get("op") === "confidence") await updateResearch(id, { confidence: fd.get("confidence") });
    else await updateResearch(id, { title: fd.get("title"), url: fd.get("url"), summary: fd.get("summary"), memo: fd.get("memo"), tags: fd.get("tags"), confidence: fd.get("confidence") ?? undefined });
  } catch (e) { back(`/w/${ws}/research`, e); }
  revalidatePath(`/w/${ws}/research`);
  redirect(`/w/${ws}/research`);
}

// ── AI (선택: ANTHROPIC_API_KEY 가 있을 때) ──

export type AiState<T> = { ok?: T; error?: string } | undefined;

/** 요금제 AI 횟수: 운영자는 세기만, 구독 연결(이 Mac 의 CLI)은 세지 않는다 */
async function countFor(ws: string, actor: Awaited<ReturnType<typeof requireAuth>>, tier: AiTier) {
  if (await countsAgainstPlan(tier, actor)) await countAi(ws, actor.kind === "admin");
}

export async function aiIdeasAction(_p: AiState<IdeaSuggestion[]>, fd: FormData): Promise<AiState<IdeaSuggestion[]>> {
  await requireAuth();
  try {
    const { ws: w, actor } = await gateWs(String(fd.get("ws")), "edit");
    await countFor(w.id, actor, "judge");
    const avoid = (await listIdeas(w.id)).map((i) => i.title);
    return { ok: await suggestIdeas(w, { pillar: String(fd.get("pillar") ?? "") || undefined, count: Number(fd.get("count") ?? 5), avoid, hint: String(fd.get("hint") ?? "").slice(0, 300) }, actor) };
  } catch (e) { return { error: msg(e) }; }
}

/** AI 제안 중 고른 것만 아이디어로 */
export async function addAiIdeasAction(fd: FormData) {
  await requireAuth();
  const ws = String(fd.get("ws"));
  try {
    await gateWs(ws, "edit");
    for (const raw of fd.getAll("pick").map(String)) {
      const x = JSON.parse(raw) as IdeaSuggestion;
      await createIdea(ws, { title: x.title, pillar: x.pillar, angle: x.angle, template: x.template, by: "ai" });
    }
  } catch (e) { back(`/w/${ws}/ideas`, e); }
  revalidatePath(`/w/${ws}/ideas`);
  redirect(`/w/${ws}/ideas`);
}

export async function aiResearchAction(_p: AiState<number>, fd: FormData): Promise<AiState<number>> {
  await requireAuth();
  try {
    const { ws: w, actor } = await gateWs(String(fd.get("ws")), "edit");
    const topic = String(fd.get("topic") ?? "").trim().slice(0, 200);
    if (!topic) return { error: "주제를 적어 주세요" };
    await countFor(w.id, actor, "write");
    const found = await researchTopic(w, topic, actor);
    for (const s of found) await addResearch(w.id, { title: s.title, url: s.url, summary: s.summary, tags: [topic.slice(0, 20)], confidence: "medium", by: "ai" });
    revalidatePath(`/w/${w.id}/research`);
    return { ok: found.length };
  } catch (e) { return { error: msg(e) }; }
}

/** 편집기: 기획으로 장 글·캡션 초안 (저장은 사람이) */
export async function aiDraftAction(input: { post: string; template: string; title: string; category: string; current: PostData | null; extra: string }): Promise<AiState<PostData>> {
  await requireAuth();
  try {
    const { post: p, ws: w, actor } = await gatePost(input.post, "edit");
    await countFor(w.id, actor, "write");
    return { ok: await draftPostData(w, { template: input.template, title: input.title, category: input.category, note: p.note, current: input.current }, String(input.extra ?? "").slice(0, 500), actor) };
  } catch (e) { return { error: msg(e) }; }
}

/** 템플릿 갤러리 → 비어 있는 첫 칸에 그 템플릿으로 (빈 틀 = 기본 초안, 샘플 = 샘플 글·추상 그림 그대로) → 편집기 */
export async function startFromTemplateAction(fd: FormData) {
  await requireAuth();
  const ws = String(fd.get("ws")), tpl = String(fd.get("template")), sample = fd.get("mode") === "sample";
  let id = "";
  try {
    await gateWs(ws, "edit");
    const spot = await nextEmptySlot(ws);
    if (!spot) throw new OpError("빈 칸이 없어요. 설정에서 일수를 늘려 주세요");
    const t = templateOf(tpl);
    const r = await createPostIn(ws, { day: spot.day, slot: spot.slot, template: t.id, title: sample ? `${t.name} 샘플` : `새 ${t.name}`, ...(sample && t.sample ? { data: t.sample() } : { draft: true }) });
    id = r.post.id;
  } catch (e) { redirect(`/templates?ws=${encodeURIComponent(ws)}&error=${encodeURIComponent(msg(e))}`); }
  revalidatePath(`/w/${ws}`);
  redirect(`/w/${ws}/p/${id}`);
}

// ── 게시물 옮기기 · 복제 · 보관 · 성과 ──

const spotOf = (fd: FormData) => { const m = /^(\d+) (\d\d:\d\d)$/.exec(String(fd.get("spot") ?? "")); return m ? { day: m[1], slot: m[2] } : {}; };

export async function postToolAction(fd: FormData) {
  await requireAuth();
  const ws = String(fd.get("ws")), id = String(fd.get("id")), op = String(fd.get("op"));
  let to = `/w/${ws}/p/${id}`;
  try {
    const { post } = await gatePost(id, "edit");
    if (post.workspace !== ws) throw new OpError("다른 서비스의 게시물이에요");
    if (op === "move") await movePost(id, spotOf(fd));
    else if (op === "duplicate") to = `/w/${ws}/p/${(await duplicatePost(id, spotOf(fd))).id}`;
    else if (op === "archive") { await archivePost(id); to = `/w/${ws}?view=archive`; }
    else if (op === "restore") await restorePost(id, spotOf(fd));
    else throw new OpError("모르는 동작이에요");
  } catch (e) { back(op === "restore" ? `/w/${ws}?view=archive` : `/w/${ws}/p/${id}`, e); }
  revalidatePath(`/w/${ws}`, "layout");
  redirect(to);
}

export async function metricsAction(_p: SaveState, fd: FormData): Promise<SaveState> {
  await requireAuth();
  try {
    await gatePost(String(fd.get("id")), "edit");
    const p = await setMetrics(String(fd.get("id")), Object.fromEntries(["reach", "likes", "comments", "saves", "shares", "follows"].map((k) => [k, fd.get(k) ?? undefined])));
    revalidatePath(`/w/${p.workspace}`, "layout");
    return { ok: true };
  } catch (e) { return { error: msg(e) }; }
}

// ── 함께 쓰는 사람 · 내 계정 ──

export type MemberState = { ok?: string; temp?: { email: string; password: string }; error?: string } | undefined;

/** 소유자: 멤버 더하기 · 역할 바꾸기 · 빼기 · 비밀번호 초기화. 임시 비밀번호는 이 응답에서 한 번만 보인다 */
export async function memberAction(_p: MemberState, fd: FormData): Promise<MemberState> {
  const ws = String(fd.get("ws")), op = String(fd.get("op"));
  try {
    await gateWs(ws, "manage");
    let out: MemberState = { ok: "바꿨어요" };
    if (op === "add") {
      const r = await addMember(ws, { email: fd.get("email"), name: fd.get("name"), role: fd.get("role") });
      out = r.tempPassword ? { ok: `${r.email} 계정을 만들고 더했어요`, temp: { email: r.email, password: r.tempPassword } } : { ok: `${r.email} 님을 더했어요 (이미 있는 계정)` };
    } else if (op === "role") await setMemberRole(ws, String(fd.get("user")), fd.get("role"));
    else if (op === "remove") { await removeMember(ws, String(fd.get("user"))); out = { ok: "서비스에서 뺐어요 (계정은 남아요)" }; }
    else if (op === "reset") { const u = String(fd.get("user")); out = { ok: "비밀번호를 초기화했어요", temp: { email: String(fd.get("email") ?? ""), password: await resetMemberPassword(ws, u) } }; }
    else throw new OpError("모르는 동작이에요");
    revalidatePath(`/w/${ws}/members`);
    return out;
  } catch (e) { return { error: msg(e) }; }
}

export async function changePasswordAction(_p: SaveState, fd: FormData): Promise<SaveState> {
  const actor = await requireAuth();
  if (actor.kind !== "user") return { error: "운영자 비밀번호는 .env.local 에서 바꿔요" };
  try {
    const u = await changePassword(actor.id, String(fd.get("current") ?? ""), String(fd.get("next") ?? ""));
    await setUserSession(u); // 바뀐 비밀번호로 다시 서명 (다른 기기 로그인은 풀린다)
    return { ok: true };
  } catch (e) { return { error: msg(e) }; }
}

// ── AI 연동 (운영자) ──

export type KeyState = { ok?: string; error?: string } | undefined;
export async function integrationAction(_p: KeyState, fd: FormData): Promise<KeyState> {
  const actor = await requireAuth();
  if (actor.kind !== "admin") return { error: "운영자만 바꿀 수 있어요" };
  const provider = String(fd.get("provider")) as Provider;
  if (provider !== "anthropic" && provider !== "gemini" && provider !== "openai") return { error: "모르는 연동이에요" };
  try {
    if (fd.get("op") === "test") return { ok: provider === "gemini" ? await testGemini() : await testVia(provider, actor) };
    const v = String(fd.get("key") ?? "").trim();
    const shape = { gemini: /^[A-Za-z0-9_-]{20,}$/, anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/, openai: /^sk-[A-Za-z0-9_-]{20,}$/ }[provider];
    if (v && !shape.test(v)) return { error: "키 모양이 맞지 않아요" };
    await setKey(provider, fd.get("op") === "remove" ? "" : v);
    revalidatePath("/settings");
    return { ok: fd.get("op") === "remove" ? "지웠어요" : "저장했어요. '연결 확인'을 눌러 보세요" };
  } catch (e) { return { error: msg(e) }; }
}

// ── AI 앱 연결 (OAuth 동의 · 개인 토큰) ──

/** 동의 화면의 허락/거절 → 인가 코드를 붙여 앱으로 돌려보낸다 */
export async function oauthConsentAction(fd: FormData) {
  const actor = await requireAuth();
  const g = (k: string) => String(fd.get(k) ?? "");
  const client = await getClient(g("client_id"));
  if (!client || !client.redirectUris.includes(g("redirect_uri"))) redirect("/");
  const back = new URL(g("redirect_uri"));
  if (g("state")) back.searchParams.set("state", g("state"));
  back.searchParams.set("iss", baseUrl(new Request("http://x", { headers: await headers() })));
  if (g("decision") !== "allow") { back.searchParams.set("error", "access_denied"); redirect(back.toString()); }
  back.searchParams.set("code", issueCode({ clientId: client.id, redirectUri: g("redirect_uri"), challenge: g("code_challenge"), userId: actor.kind === "admin" ? "admin" : actor.id, resource: g("resource") }));
  redirect(back.toString());
}

export type PatState = { token?: string; error?: string; ok?: string } | undefined;
export async function patAction(_p: PatState, fd: FormData): Promise<PatState> {
  const actor = await requireAuth();
  const uid = actor.kind === "admin" ? "admin" : actor.id;
  try {
    if (fd.get("op") === "revoke") { await revokeToken(uid, String(fd.get("id"))); revalidatePath("/account"); return { ok: "연결을 끊었어요" }; }
    const token = await createPat(uid, String(fd.get("name") ?? ""));
    revalidatePath("/account");
    return { token };
  } catch (e) { return { error: msg(e) }; }
}

// ── 0.6: 즐겨찾기 · 표시 이름 · AI 설정 · 성과 제안 · AI 패널 ──

export async function favoriteAction(fd: FormData) {
  const actor = await requireAuth();
  const ws = String(fd.get("ws"));
  if (await wsAccess(ws, "view")) await toggleFavorite(actor.kind === "admin" ? "admin" : actor.id, ws);
  revalidatePath("/");
}

export async function profileAction(_p: SaveState, fd: FormData): Promise<SaveState> {
  const actor = await requireAuth();
  try { await setDisplayName(actor.kind === "admin" ? "admin" : actor.id, fd.get("name")); revalidatePath("/", "layout"); return { ok: true }; }
  catch (e) { return { error: msg(e) }; }
}

/** AI 연결·작업별 모델 (운영자만 — 서비스 모두에 걸린다) */
export async function aiConfigAction(_p: KeyState, fd: FormData): Promise<KeyState> {
  const actor = await requireAuth();
  if (actor.kind !== "admin") return { error: "운영자만 바꿀 수 있어요" };
  try {
    const op = String(fd.get("op") ?? "");
    if (op.startsWith("test:")) { const v = op.slice(5) as AiVia; if (!AI_VIA.includes(v)) return { error: "모르는 연결이에요" }; return { ok: await testVia(v, actor) }; }
    const tiers: Record<string, unknown> = {};
    for (const k of ["judge", "write", "polish"]) tiers[k] = { via: fd.get(`${k}.via`), model: fd.get(`${k}.model`), effort: fd.get(`${k}.effort`) };
    await saveAiConfig({ enabled: AI_VIA.filter((v) => fd.get(`on.${v}`) === "on"), tiers });
    revalidatePath("/settings");
    return { ok: "저장했어요" };
  } catch (e) { return { error: msg(e) }; }
}

export async function suggestionAction(fd: FormData) {
  const actor = await requireAuth();
  const ws = String(fd.get("ws")), key = String(fd.get("key")), op = String(fd.get("op"));
  try {
    await gateWs(ws, "edit");
    const sg = (await insights(ws)).suggestions.find((x) => x.key === key);
    if (!sg) throw new OpError("그 제안이 바뀌었어요. 다시 확인해 주세요");
    if (op === "apply") {
      if (sg.kind === "share") { await gateWs(ws, "manage"); await applyShareSuggestion(ws, sg.from, sg.to, sg.delta); }
      else await followUpIdea(sg.postId, actor.kind === "admin" ? "user" : "user");
    }
    await dismissSuggestion(ws, key);
  } catch (e) { back(`/w/${ws}/insights`, e); }
  revalidatePath(`/w/${ws}`, "layout");
  redirect(`/w/${ws}/insights`);
}

/** AI 패널: 대화 한 번 (스튜디오 도구를 써서 실제로 일한다 — 한 일은 작업 기록 카드로 남는다) */
export async function aiChatAction(input: { ws: string; ctx: string; history: ChatTurn[] }): Promise<AiState<{ text: string; via: string; model: string }>> {
  const actor = await requireAuth();
  try {
    const { ws: w } = await gateWs(String(input.ws), "view");
    const history = (Array.isArray(input.history) ? input.history : []).slice(-12).map((x) => ({ role: x.role === "assistant" ? "assistant" as const : "user" as const, text: String(x.text ?? "").slice(0, 4000) }));
    if (!history.length || history[history.length - 1].role !== "user") throw new OpError("보낼 말을 적어 주세요");
    await countFor(w.id, actor, "judge");
    const tools = {
      tools: TOOLS.filter((t) => t.name !== "export_post").map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      call: async (name: string, args: Record<string, unknown>) => { const r = await callTool(name, args, actor, "ai"); return { text: r.content.map((c) => (c.type === "text" ? c.text : "[그림]")).join("\n"), isError: r.isError }; },
    };
    const token = process.env.STUDIO_MCP_TOKEN;
    const mcpUrl = `${baseUrl(new Request("http://x", { headers: await headers() }))}/api/mcp`;
    const out = await chat(actor, `${w.name}(${w.id}) · ${String(input.ctx ?? "").slice(0, 200)}`, history, tools, token ? { url: mcpUrl, token } : null);
    revalidatePath(`/w/${w.id}`, "layout");
    return { ok: out };
  } catch (e) { return { error: msg(e) }; }
}
