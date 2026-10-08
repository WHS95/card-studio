import "server-only";
import { createPost, getIdea, getPost, getWorkspace, listPosts, mutate, newId, readDb, updatePost, upsertWorkspace } from "./store";
import { emptyBrief, presetOf } from "./presets";
import { PLANS, planOf, thisMonth } from "./plans";
import { hashPassword, tempPassword, verifyPassword } from "./auth";
import { templateOf } from "./templates";
import { validatePost } from "./fields";
import { ruleWarnings, ruleLine } from "./rules";
import { CHECKS_MAX, CONFIDENCE, DEFAULT_CHECKS, IDEA_STATUS, NEXT_STATUS, NO_RULES, POST_STATUS, type Activity, type Brief, type Confidence, type ContentRules, type Idea, type IdeaStatus, type Metrics, type Role, type User, ROLES, type PlanId, type Pillar, type Post, type PostData, type PostStatus, type Research, type Theme, type Workspace } from "./types";

// 화면(server action)과 MCP 가 같이 쓰는 규칙 한 곳. 틀리면 OpError(사용자에게 보여 줄 문구).

export class OpError extends Error {}
const fail = (m: string): never => { throw new OpError(m); };

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** 기본 강조색: 흑백 도구에 맞춘 밝은 회색 (어두운 장·밝은 장 둘 다에서 채움이 보이게). 서비스 설정에서 바꾼다 */
export const NEUTRAL_ACCENT = "#D9D9D9";
const lum = (h: string) => { const n = parseInt(h.replace("#", ""), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
export const DEFAULT_THEME = (name: string, accent: string): Theme => ({
  dark: "#111111", light: "#FFFFFF", ink: "#111111", muted: "#5F5F5F", accent, onAccent: lum(accent) > 0.5 ? "#111111" : "#FFFFFF",
  // 강조색이 어두우면 워드마크 글자는 흰색 (검은 바탕 위에서 보이게)
  wordmark: { text: name.toUpperCase().slice(0, 24), color: lum(accent) < 0.3 ? "#FFFFFF" : accent, bg: "#111111" },
  font: { regular: "NotoSansKR-Medium.ttf", bold: "NotoSansKR-ExtraBold.ttf" },
});

/** 새 서비스. 업종(presets.ts)을 고르면 기둥·말투·목표·해시태그를 시작값으로 채운다 */
/** ownerId: 계정이 만들면 그 계정이 소유자 (요금제의 서비스 수 한도). 운영자·MCP 는 없음 */
export async function createWorkspace(input: { id: unknown; name: unknown; handle?: unknown; accent?: unknown; industry?: unknown; about?: unknown }, ownerId?: string) {
  const name = s(input.name, 30);
  const id = s(input.id, 30).toLowerCase();
  if (!name) fail("서비스 이름을 적어 주세요");
  if (!/^[a-z0-9-]{2,30}$/.test(id)) fail("주소는 영문 소문자·숫자·- 로 2~30자까지 쓸 수 있어요");
  if (await getWorkspace(id)) fail("이미 쓰고 있는 주소예요. 다른 주소를 적어 주세요");
  const ws: Workspace = {
    id, name, handle: s(input.handle, 30), theme: DEFAULT_THEME(name, hex(input.accent, NEUTRAL_ACCENT)),
    categories: ["정보", "소식", "팁", "참여"], slots: ["12:30"], days: 30, startDate: null, defaultTemplate: "magazine",
  };
  if (ownerId) {
    const owned = (await readDb()).workspaces.filter((w) => w.members?.some((m) => m.userId === ownerId && m.role === "owner"));
    const limit = Math.max(PLANS.free.servicesPerOwner, ...owned.map((w) => planOf(w.plan).servicesPerOwner));
    if (owned.length >= limit) fail(`지금 요금제로는 서비스를 ${limit}개까지 만들 수 있어요`);
    ws.members = [{ userId: ownerId, role: "owner", addedAt: new Date().toISOString() }];
  }
  const pr = presetOf(s(input.industry, 30));
  ws.brief = { ...emptyBrief(), industry: pr?.id ?? s(input.industry, 30), about: s(input.about, 300) };
  if (pr) {
    Object.assign(ws.brief, { tone: pr.tone, goals: [...pr.goals], hashtags: [...pr.hashtags] });
    ws.pillars = pr.pillars.map((x) => ({ ...x, examples: [...x.examples] }));
    ws.categories = pr.pillars.map((x) => x.name);
    ws.defaultTemplate = pr.pillars[0].template;
  }
  return upsertWorkspace(ws);
}

export type WorkspacePatch = Partial<{
  name: string; handle: string; categories: string[]; slots: string[]; days: number; startDate: string | null; defaultTemplate: string; metricsDays: number;
  theme: Partial<Omit<Theme, "wordmark" | "font">> & { wordmark?: Partial<Theme["wordmark"]> };
}>;
export async function updateWorkspace(id: string, p: WorkspacePatch) {
  const w = (await getWorkspace(id)) ?? fail("서비스를 찾지 못했어요");
  const slots = p.slots?.map((x) => String(x).trim()).filter((x) => /^([01]\d|2[0-3]):[0-5]\d$/.test(x));
  const t = p.theme ?? {};
  const next: Workspace = {
    ...w,
    name: p.name !== undefined ? s(p.name, 30) || w.name : w.name,
    handle: p.handle !== undefined ? s(p.handle, 30) : w.handle,
    categories: p.categories ? p.categories.map((c) => s(c, 20)).filter(Boolean).slice(0, 20) : w.categories,
    slots: slots?.length ? [...new Set(slots)].sort().slice(0, 6) : w.slots,
    days: p.days !== undefined ? Math.min(DAYS_MAX, Math.max(1, Math.round(Number(p.days)) || w.days)) : w.days,
    startDate: p.startDate === undefined ? w.startDate : p.startDate && /^\d{4}-\d{2}-\d{2}$/.test(p.startDate) ? p.startDate : null,
    defaultTemplate: p.defaultTemplate ? templateOf(p.defaultTemplate).id : w.defaultTemplate,
    metricsDays: p.metricsDays !== undefined ? Math.min(30, Math.max(1, Math.round(Number(p.metricsDays)) || 7)) : w.metricsDays,
    theme: {
      ...w.theme,
      dark: hex(t.dark, w.theme.dark), light: hex(t.light, w.theme.light), ink: hex(t.ink, w.theme.ink), muted: hex(t.muted, w.theme.muted),
      accent: hex(t.accent, w.theme.accent), onAccent: hex(t.onAccent, w.theme.onAccent),
      wordmark: {
        text: t.wordmark?.text !== undefined ? String(t.wordmark.text).slice(0, 24) : w.theme.wordmark.text,
        color: hex(t.wordmark?.color, w.theme.wordmark.color), bg: hex(t.wordmark?.bg, w.theme.wordmark.bg),
      },
    },
  };
  return upsertWorkspace(next);
}

/** 빈 칸에 게시물 만들기. data 가 없으면 기획(plan), 있으면 검사 후 초안 */
export async function createPostIn(wsId: string, p: { day: number; slot: string; template?: string; title?: string; category?: string; note?: string; data?: unknown; draft?: boolean }) {
  const w = (await getWorkspace(wsId)) ?? fail("서비스를 찾지 못했어요");
  const day = Math.round(Number(p.day));
  if (!(day >= 1 && day <= w.days)) fail(`일차는 1~${w.days} 사이로 골라 주세요`);
  if (!w.slots.includes(p.slot)) fail(`시간대는 ${w.slots.join(", ")} 중에서 골라 주세요`);
  const t = templateOf(p.template ?? w.defaultTemplate);
  const title = s(p.title, 80), category = s(p.category, 20) || w.categories[0] || "";
  let data: PostData | null = null;
  if (p.data !== undefined) { const e = validatePost(t, p.data); if (e) fail(e); data = p.data as PostData; }
  else if (p.draft && title) data = t.draft({ title, category, handle: w.handle });
  const r = await createPost({ workspace: w.id, day, slot: p.slot, template: t.id, category, title, note: s(p.note, 500), status: data ? "draft" : "plan", data, postedUrl: "" });
  return r;
}

/** 게시물 고치기. data 는 템플릿 기준으로 검사. 게시된 것은 글을 고칠 수 없다(게시 취소 후) */
export async function savePost(id: string, p: { template?: string; title?: string; category?: string; note?: string; data?: unknown }) {
  const cur = (await getPost(id)) ?? fail("게시물을 찾지 못했어요");
  if (cur.status === "posted" && p.data !== undefined) fail("게시된 게시물은 게시 취소 후 고칠 수 있어요");
  const template = templateOf(p.template ?? cur.template).id;
  const patch: Partial<Post> = { template };
  if (p.title !== undefined) patch.title = s(p.title, 80);
  if (p.category !== undefined) patch.category = s(p.category, 20);
  if (p.note !== undefined) patch.note = s(p.note, 500);
  if (p.data !== undefined) {
    const e = validatePost(templateOf(template), p.data);
    if (e) fail(e);
    patch.data = p.data as PostData;
    // 승인된 뒤 글을 고치면 다시 검수 받도록 초안으로 (체크 기록도 지운다)
    patch.status = cur.status === "plan" || cur.status === "approved" ? "draft" : cur.status;
    if (cur.status === "approved") patch.review = undefined;
  } else if (template !== cur.template && cur.data) fail("템플릿을 바꿀 때는 새 틀에 맞는 data 도 같이 보내 주세요");
  return (await updatePost(id, patch))!;
}

/** 승인 체크리스트 = 기본 항목 + 서비스가 더한 항목 */
export const requiredChecks = (w: Workspace) => [...DEFAULT_CHECKS, ...(w.brief?.checklist ?? [])];

/** 상태는 NEXT_STATUS 길로만. 승인은 저장된 내용 + 체크리스트를 모두 체크, 게시는 승인된 것 + 인스타 링크 */
export async function setStatus(id: string, status: PostStatus, postedUrl?: string, opts: { checks?: string[]; by?: string } = {}) {
  const cur = (await getPost(id)) ?? fail("게시물을 찾지 못했어요");
  if (!POST_STATUS.includes(status)) fail("상태 값이 맞지 않아요");
  if (!NEXT_STATUS[cur.status].includes(status)) fail(NEXT_STATUS[cur.status].length ? `지금 상태(${cur.status})에서는 ${NEXT_STATUS[cur.status].join(", ")} 로만 바꿀 수 있어요` : `지금 상태(${cur.status})에서는 상태를 바꿀 수 없어요`);
  const to: PostStatus = cur.status === "skip" && !cur.data ? "plan" : status;
  if (to !== "skip" && to !== "plan" && !cur.data) fail("저장된 내용이 없어요. 글을 먼저 저장해 주세요");
  // '샘플로 시작'의 자리 표시 그림이 남아 있으면 승인·게시하지 않는다
  if ((to === "approved" || to === "posted") && cur.data?.photos.some((p) => /^\/samples\//.test(p.url))) fail("샘플 그림이 남아 있어요. 실제 사진으로 바꾼 뒤 승인해 주세요");
  const url = (postedUrl ?? "").trim();
  if (to === "posted" && !/^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?/.test(url)) fail("인스타 게시물 링크(https://www.instagram.com/p/…)를 넣어 주세요");
  const patch: Partial<Post> = { status: to };
  // 초안 → 승인: 체크리스트를 모두 체크해야 (게시 취소로 돌아온 승인은 이미 체크한 것)
  if (to === "approved" && cur.status === "draft") {
    const w = (await getWorkspace(cur.workspace)) ?? fail("서비스를 찾지 못했어요");
    const got = new Set((opts.checks ?? []).map((x) => String(x).trim()));
    const miss = requiredChecks(w).filter((c) => !got.has(c));
    if (miss.length) fail(`승인 전 체크리스트를 모두 체크해 주세요 (남은 것 ${miss.length}개: ${miss[0]}${miss.length > 1 ? " 외" : ""})`);
    patch.review = { by: s(opts.by, 30) || "?", at: new Date().toISOString(), checks: requiredChecks(w) };
  }
  if (to === "draft" || to === "skip") patch.review = undefined;
  if (to === "posted") { patch.postedUrl = url; patch.postedAt = new Date().toISOString(); }
  // 게시 취소(posted → approved)면 게시 링크도 지운다
  else if (cur.status === "posted") { patch.postedUrl = ""; patch.postedAt = undefined; }
  return (await updatePost(id, patch))!;
}

/** 승인 전 확인: 사람이 체크할 항목 + 스튜디오가 알 수 있는 것(규칙 경고 · '확인 필요' 자료). 인스타 마진은 편집기가 따로 그린다 */
export async function checklistOf(postId: string) {
  const p = (await getPost(postId)) ?? fail("게시물을 찾지 못했어요");
  const w = (await getWorkspace(p.workspace)) ?? fail("서비스를 찾지 못했어요");
  const db = await readDb();
  const rids = new Set(db.ideas.filter((i) => i.postId === p.id).flatMap((i) => i.research));
  const unsure = db.research.filter((r) => rids.has(r.id) && r.confidence === "check");
  const warns = ruleWarnings(w.brief?.rules, w.defaultTemplate, p.template, p.data);
  return {
    required: requiredChecks(w),
    auto: [
      ...(warns.length ? warns.map((x) => ({ ok: false, text: ruleLine(x) })) : [{ ok: true, text: "콘텐츠 규칙 경고가 없어요" }]),
      ...(unsure.length ? unsure.map((r) => ({ ok: false, text: `'확인 필요' 자료: ${r.title}`, researchId: r.id })) : []),
    ],
    review: p.review ?? null,
  };
}

// ── 브리프 · 콘텐츠 기둥 ─────────────────────────────────────────────

const list = (v: unknown, n: number, each: number) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,\n]/) : []).map((x) => s(x, each)).filter(Boolean).slice(0, n);
const tag = (x: string) => (x.startsWith("#") ? x : `#${x}`).replace(/\s+/g, "");
const rulesOf = (v: unknown): ContentRules => { const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>; return Object.fromEntries(Object.keys(NO_RULES).map((k) => [k, o[k] === undefined ? NO_RULES[k as keyof ContentRules] : o[k] === true || o[k] === "on" || o[k] === "true"])) as ContentRules; };

export async function updateBrief(id: string, p: Partial<Record<keyof Brief, unknown>>) {
  const w = (await getWorkspace(id)) ?? fail("서비스를 찾지 못했어요");
  const b = w.brief ?? emptyBrief();
  const has = (k: keyof Brief) => p[k] !== undefined;
  const brief: Brief = {
    industry: has("industry") ? s(p.industry, 30) : b.industry,
    about: has("about") ? s(p.about, 300) : b.about,
    audience: has("audience") ? s(p.audience, 300) : b.audience,
    goals: has("goals") ? list(p.goals, 6, 20) : b.goals,
    tone: has("tone") ? s(p.tone, 200) : b.tone,
    keywords: has("keywords") ? list(p.keywords, 20, 30) : b.keywords,
    banned: has("banned") ? list(p.banned, 20, 30) : b.banned,
    hashtags: has("hashtags") ? [...new Set(list(p.hashtags, 30, 40).map(tag))] : b.hashtags,
    cta: has("cta") ? s(p.cta, 60) : b.cta,
    link: has("link") ? s(p.link, 200) : b.link,
    references: has("references") ? list(p.references, 10, 60) : b.references,
    rules: has("rules") ? rulesOf(p.rules) : b.rules,
    checklist: has("checklist") ? list(p.checklist, CHECKS_MAX, 80).filter((x) => !(DEFAULT_CHECKS as readonly string[]).includes(x)) : b.checklist,
  };
  if (brief.link && !/^https?:\/\//.test(brief.link)) fail("링크는 http:// 나 https:// 로 시작하게 적어 주세요");
  return upsertWorkspace({ ...w, brief });
}

/** 기둥을 통째로 바꾼다. 기둥 이름은 달력 카테고리에도 들어간다 (기둥 먼저, 나머지 카테고리는 뒤에) */
export async function setPillars(id: string, input: unknown) {
  const w = (await getWorkspace(id)) ?? fail("서비스를 찾지 못했어요");
  if (!Array.isArray(input)) fail("기둥 형식이 맞지 않아요");
  const pillars: Pillar[] = [];
  for (const x of (input as Record<string, unknown>[]).slice(0, 8)) {
    const name = s(x?.name, 20);
    if (!name || pillars.some((p) => p.name === name)) continue;
    pillars.push({
      name, description: s(x.description, 200),
      share: Math.min(100, Math.max(0, Math.round(Number(x.share)) || 0)),
      template: templateOf(s(x.template, 30)).id,
      examples: list(x.examples, 5, 80),
    });
  }
  const total = pillars.reduce((a, p) => a + p.share, 0);
  if (pillars.length && total !== 100) fail(`기둥 비중을 더해 100%가 되게 맞춰 주세요 (지금 ${total}%)`);
  const categories = [...new Set([...pillars.map((p) => p.name), ...w.categories])].slice(0, 20);
  return upsertWorkspace({ ...w, pillars, categories });
}

// ── 아이디어 보관함 ─────────────────────────────────────────────────

const IDEAS_MAX = 500, RESEARCH_MAX = 1000;

export async function createIdea(wsId: string, p: { title: unknown; pillar?: unknown; angle?: unknown; template?: unknown; research?: unknown; by?: Idea["by"] }) {
  const w = (await getWorkspace(wsId)) ?? fail("서비스를 찾지 못했어요");
  const title = s(p.title, 80);
  if (!title) fail("아이디어 제목을 적어 주세요");
  const pillar = s(p.pillar, 20);
  const pl = w.pillars?.find((x) => x.name === pillar);
  const now = new Date().toISOString();
  return mutate((db) => {
    if (db.ideas.filter((x) => x.workspace === w.id).length >= IDEAS_MAX) fail(`아이디어는 서비스마다 ${IDEAS_MAX}개까지예요`);
    const ids = new Set(db.research.filter((r) => r.workspace === w.id).map((r) => r.id));
    const idea: Idea = {
      id: newId(), workspace: w.id, title, pillar: pl ? pl.name : "", angle: s(p.angle, 1000),
      template: templateOf(s(p.template, 30) || pl?.template || w.defaultTemplate).id, status: "review",
      research: list(p.research, 20, 40).filter((id) => ids.has(id)), by: p.by ?? "user", createdAt: now, updatedAt: now,
    };
    db.ideas.push(idea);
    return idea;
  });
}

/** status: review(검수 대기로 되돌리기) · approved(승인 — 부르는 쪽이 approve 권한을 확인) · dropped(보류). planned 는 달력에 넣기로만 */
export async function updateIdea(id: string, p: { title?: unknown; pillar?: unknown; angle?: unknown; template?: unknown; status?: unknown; research?: unknown }, by = "") {
  const cur = (await getIdea(id)) ?? fail("아이디어를 찾지 못했어요");
  const w = (await getWorkspace(cur.workspace)) ?? fail("서비스를 찾지 못했어요");
  return mutate((db) => {
    const it = db.ideas.find((x) => x.id === id)!;
    if (p.title !== undefined) it.title = s(p.title, 80) || it.title;
    if (p.pillar !== undefined) { const n = s(p.pillar, 20); it.pillar = w.pillars?.some((x) => x.name === n) ? n : ""; }
    if (p.angle !== undefined) it.angle = s(p.angle, 1000);
    if (p.template !== undefined) it.template = templateOf(s(p.template, 30)).id;
    if (p.status !== undefined) {
      if (!IDEA_STATUS.includes(p.status as IdeaStatus)) fail("상태 값이 맞지 않아요");
      if (p.status === "planned") fail("제작에 넣으려면 '제작에 넣기'를 써 주세요");
      if (it.status === "planned" && it.postId && db.posts.some((x) => x.id === it.postId && !x.archivedAt)) fail("이미 제작에 들어간 주제예요. 게시물을 보관함으로 뺀 뒤 바꿀 수 있어요");
      it.status = p.status as IdeaStatus;
      if (it.status === "approved") { it.approvedBy = s(by, 30) || "?"; it.approvedAt = new Date().toISOString(); }
      else { it.approvedBy = undefined; it.approvedAt = undefined; }
    }
    if (p.research !== undefined) { const ids = new Set(db.research.filter((r) => r.workspace === w.id).map((r) => r.id)); it.research = list(p.research, 20, 40).filter((x) => ids.has(x)); }
    it.updatedAt = new Date().toISOString();
    return it;
  });
}

/** 비어 있는 첫 칸 (일차·시간대 순) */
export async function nextEmptySlot(wsId: string, fromDay = 1) {
  const w = (await getWorkspace(wsId)) ?? fail("서비스를 찾지 못했어요");
  const taken = new Set((await listPosts(w.id)).map((p) => `${p.day} ${p.slot}`));
  for (let d = Math.max(1, fromDay); d <= w.days; d++) for (const sl of w.slots) if (!taken.has(`${d} ${sl}`)) return { day: d, slot: sl };
  return null;
}

/** 일수 최대 (제작이 목록이라 자리가 모자라면 늘린다) */
export const DAYS_MAX = 365;
/** 빈 자리 — 없으면 일수를 늘려서라도 (DAYS_MAX 까지). 제작 목록의 '새 게시물'·주제 넣기가 '칸이 없어요'로 막히지 않게 */
export async function ensureSlot(wsId: string, fromDay = 1) {
  const got = await nextEmptySlot(wsId, fromDay);
  if (got) return got;
  const w = (await getWorkspace(wsId)) ?? fail("서비스를 찾지 못했어요");
  if (w.days >= DAYS_MAX) fail(`자리가 꽉 찼어요 (${DAYS_MAX}일 × 시간대). 보관함으로 빼거나 시간대를 늘려 주세요`);
  await mutate((db) => { const x = db.workspaces.find((y) => y.id === w.id)!; x.days = Math.min(DAYS_MAX, Math.max(x.days + 1, Math.round(fromDay))); });
  return (await nextEmptySlot(wsId, fromDay)) ?? fail("빈 자리를 만들지 못했어요");
}

/** 제작 목록 끝 다음 일차 (보관함 제외 게시물 중 가장 늦은 일차 + 1) — 화면에서 새로 넣는 것은 목록 끝에 붙는다 */
export async function tailDay(wsId: string) {
  const ps = await listPosts(wsId);
  return ps.reduce((m, p) => Math.max(m, p.day), 0) + 1;
}

/** 아이디어 → 달력 칸 (기획 게시물). 칸을 안 주면 비어 있는 첫 칸. 자료는 게시물 메모에 출처로 붙는다 */
export async function scheduleIdea(id: string, at?: { day?: unknown; slot?: unknown }) {
  const it = (await getIdea(id)) ?? fail("아이디어를 찾지 못했어요");
  if (it.postId && (await getPost(it.postId))) fail("이미 제작에 들어간 주제예요");
  if (it.status !== "approved") fail("승인한 주제만 제작에 넣을 수 있어요");
  const spot = at?.day !== undefined && at?.slot !== undefined ? { day: Number(at.day), slot: String(at.slot) } : await ensureSlot(it.workspace);
  const db = await readDb();
  const refs = it.research.map((rid) => db.research.find((r) => r.id === rid)).filter((r): r is Research => !!r);
  const note = [it.angle, refs.length ? `자료: ${refs.map((r) => `${r.title}${r.url ? ` ${r.url}` : ""}`).join(" / ")}` : ""].filter(Boolean).join("\n").slice(0, 500);
  const r = await createPostIn(it.workspace, { day: spot!.day, slot: spot!.slot, template: it.template, title: it.title, category: it.pillar, note });
  if (!r.created) fail(`D${spot!.day} ${spot!.slot} 칸에는 이미 게시물이 있어요. 다른 칸을 골라 주세요`);
  await mutate((d) => { const x = d.ideas.find((y) => y.id === id)!; x.status = "planned"; x.postId = r.post.id; x.updatedAt = new Date().toISOString(); });
  return r.post;
}

/** 승인한 주제 여러 개를 고른 순서대로 빈 칸에 하루씩 (from = 시작 일차, 없으면 처음부터) */
export async function scheduleIdeas(ids: string[], from?: number) {
  const out: Post[] = [];
  let day = Math.max(1, Math.round(Number(from)) || 1);
  for (const id of ids.slice(0, 30)) {
    const it = (await getIdea(id)) ?? fail("아이디어를 찾지 못했어요");
    if (it.status !== "approved") fail(`'${it.title}' 주제는 아직 승인 전이에요. 승인한 주제만 제작에 넣을 수 있어요`);
    const spot = await ensureSlot(it.workspace, day);
    out.push(await scheduleIdea(id, spot));
    day = spot.day + 1;
  }
  return out;
}

// ── 자료 조사 ───────────────────────────────────────────────────────

const confOf = (v: unknown, d: Confidence = "medium"): Confidence => (CONFIDENCE.includes(v as Confidence) ? (v as Confidence) : d);

export async function addResearch(wsId: string, p: { title: unknown; url?: unknown; summary?: unknown; memo?: unknown; tags?: unknown; confidence?: unknown; by?: Research["by"] }) {
  const w = (await getWorkspace(wsId)) ?? fail("서비스를 찾지 못했어요");
  const title = s(p.title, 120), url = s(p.url, 500);
  if (!title) fail("자료 제목을 적어 주세요");
  if (url && !/^https:\/\/[^\s"'<>]+$/.test(url)) fail("출처 주소는 https:// 로 시작하게 적어 주세요");
  return mutate((db) => {
    if (db.research.filter((x) => x.workspace === w.id).length >= RESEARCH_MAX) fail(`자료는 서비스마다 ${RESEARCH_MAX}개까지예요`);
    const r: Research = { id: newId(), workspace: w.id, title, url, summary: s(p.summary, 2000), memo: s(p.memo, 500), tags: list(p.tags, 10, 20), confidence: confOf(p.confidence), by: p.by ?? "user", createdAt: new Date().toISOString() };
    db.research.push(r);
    return r;
  });
}

export async function updateResearch(id: string, p: { title?: unknown; url?: unknown; summary?: unknown; memo?: unknown; tags?: unknown; confidence?: unknown }) {
  return mutate((db) => {
    const r = db.research.find((x) => x.id === id) ?? fail("자료를 찾지 못했어요");
    if (p.title !== undefined) r.title = s(p.title, 120) || r.title;
    if (p.url !== undefined) { const u = s(p.url, 500); if (u && !/^https:\/\/[^\s"'<>]+$/.test(u)) fail("출처 주소는 https:// 로 시작하게 적어 주세요"); r.url = u; }
    if (p.summary !== undefined) r.summary = s(p.summary, 2000);
    if (p.memo !== undefined) r.memo = s(p.memo, 500);
    if (p.tags !== undefined) r.tags = list(p.tags, 10, 20);
    if (p.confidence !== undefined) r.confidence = confOf(p.confidence, r.confidence);
    return r;
  });
}

/** 화면에서만 (MCP 에는 삭제 도구가 없다). 아이디어에 걸린 연결도 같이 푼다 */
export function removeResearch(id: string) {
  return mutate((db) => {
    const r = db.research.find((x) => x.id === id) ?? fail("자료를 찾지 못했어요");
    db.research = db.research.filter((x) => x.id !== id);
    for (const it of db.ideas) if (it.research.includes(id)) it.research = it.research.filter((x) => x !== id);
    return r;
  });
}

/** 주제 지우기 (화면에서만 — MCP 에는 삭제 도구가 없다). 제작에 넣은 게시물은 그대로 남는다 */
export function removeIdea(id: string) {
  return mutate((db) => {
    const it = db.ideas.find((x) => x.id === id) ?? fail("주제를 찾지 못했어요");
    db.ideas = db.ideas.filter((x) => x.id !== id);
    return it;
  });
}

/** 게시물 지우기 (화면에서만, 되돌릴 수 없다). 게시한 것은 기록이라 게시 취소 뒤에. 이 게시물로 넣은 주제는 다시 '승인'으로 돌려 다시 넣을 수 있게 */
export function removePost(id: string) {
  return mutate((db) => {
    const p = db.posts.find((x) => x.id === id) ?? fail("게시물을 찾지 못했어요");
    if (p.status === "posted") fail("게시한 게시물은 기록으로 남겨 둬요. 게시 취소 뒤에 지울 수 있어요");
    db.posts = db.posts.filter((x) => x.id !== id);
    const now = new Date().toISOString();
    for (const it of db.ideas) if (it.postId === id) { it.postId = undefined; it.status = "approved"; it.updatedAt = now; }
    return p;
  });
}

// ── 게시물 옮기기 · 복제 · 보관 · 성과 ──────────────────────────────

async function emptySpot(wsId: string, day: unknown, slot: unknown) {
  const w = (await getWorkspace(wsId)) ?? fail("서비스를 찾지 못했어요");
  if (day === undefined || slot === undefined || day === "" || slot === "") return (await nextEmptySlot(wsId)) ?? fail("빈 칸이 없어요. 설정에서 일수를 늘려 주세요");
  const d = Math.round(Number(day)), sl = String(slot);
  if (!(d >= 1 && d <= w.days)) fail(`일차는 1~${w.days} 사이로 골라 주세요`);
  if (!w.slots.includes(sl)) fail(`시간대는 ${w.slots.join(", ")} 중에서 골라 주세요`);
  if ((await listPosts(wsId)).some((p) => p.day === d && p.slot === sl)) fail(`D${d} ${sl} 칸에는 이미 게시물이 있어요. 다른 칸을 골라 주세요`);
  return { day: d, slot: sl };
}

/** 빈 칸으로 옮기기 (게시된 것도 옮길 수 있다 — 기록 정리용) */
export async function movePost(id: string, to: { day?: unknown; slot?: unknown }) {
  const p = (await getPost(id)) ?? fail("게시물을 찾지 못했어요");
  if (p.archivedAt) fail("보관함에 있는 게시물이에요. 되살리기로 칸에 넣어 주세요");
  const spot = await emptySpot(p.workspace, to.day, to.slot);
  return (await updatePost(id, spot))!;
}

/** 복제: 같은 글·사진으로 빈 칸에 새 초안 (게시 링크·성과는 빼고) */
export async function duplicatePost(id: string, to: { day?: unknown; slot?: unknown } = {}) {
  const p = (await getPost(id)) ?? fail("게시물을 찾지 못했어요");
  const spot = await emptySpot(p.workspace, to.day, to.slot);
  const r = await createPost({ workspace: p.workspace, day: spot.day, slot: spot.slot, template: p.template, category: p.category, title: `${p.title} (복사)`.slice(0, 80), note: p.note, status: p.data ? "draft" : "plan", data: p.data ? structuredClone(p.data) : null, postedUrl: "" });
  return r.post;
}

/** 보관함으로 빼기 (칸이 빈다). 게시된 것은 기록이라 빼지 않는다 */
export async function archivePost(id: string) {
  const p = (await getPost(id)) ?? fail("게시물을 찾지 못했어요");
  if (p.status === "posted") fail("게시된 게시물은 기록으로 남겨 둬요. 게시 취소 뒤에 뺄 수 있어요");
  return (await updatePost(id, { archivedAt: new Date().toISOString() }))!;
}

/** 보관함에서 되살리기: 원래 칸이 비었으면 그 칸, 아니면 고른 칸·비어 있는 첫 칸 */
export async function restorePost(id: string, to: { day?: unknown; slot?: unknown } = {}) {
  const p = (await getPost(id)) ?? fail("게시물을 찾지 못했어요");
  if (!p.archivedAt) fail("보관함에 있는 게시물이 아니에요");
  const free = !(await listPosts(p.workspace)).some((x) => x.day === p.day && x.slot === p.slot);
  const spot = to.day === undefined && free ? { day: p.day, slot: p.slot } : await emptySpot(p.workspace, to.day, to.slot);
  return (await updatePost(id, { ...spot, archivedAt: undefined }))!;
}

/** 게시 성과 적기 (게시된 것만). 숫자는 0 이상 정수 */
export async function setMetrics(id: string, m: Partial<Record<keyof Metrics, unknown>>) {
  const p = (await getPost(id)) ?? fail("게시물을 찾지 못했어요");
  if (p.status !== "posted") fail("성과는 게시한 게시물에만 적을 수 있어요");
  const n = (v: unknown, d: number) => (v === undefined || v === "" ? d : Math.max(0, Math.min(1e9, Math.round(Number(v)) || 0)));
  const o = p.metrics;
  const metrics: Metrics = { reach: n(m.reach, o?.reach ?? 0), likes: n(m.likes, o?.likes ?? 0), comments: n(m.comments, o?.comments ?? 0), saves: n(m.saves, o?.saves ?? 0), shares: n(m.shares, o?.shares ?? 0), follows: n(m.follows, o?.follows ?? 0), at: new Date().toISOString() };
  return (await updatePost(id, { metrics }))!;
}

const rate = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const eng = (m: Metrics) => m.likes + m.comments + m.saves + m.shares;
const postedTime = (p: Post) => Date.parse(p.postedAt ?? p.updatedAt);
export const SUGGEST_FROM = 7; // 성과를 적은 게시물이 이만큼 되면 제안
const SHARE_STEP = 10; // 기둥 비중은 한 번에 10%p 까지

/** 성과 적을 차례: 게시하고 metricsDays(기본 7)일 지났는데 성과가 없는 게시물 */
export async function metricsDue(wsId: string) {
  const w = (await getWorkspace(wsId)) ?? fail("서비스를 찾지 못했어요");
  const days = w.metricsDays ?? 7;
  const now = Date.now();
  return (await listPosts(wsId)).filter((p) => p.status === "posted" && !p.metrics && now - postedTime(p) >= days * 86400_000)
    .map((p) => ({ id: p.id, day: p.day, slot: p.slot, title: p.title, daysAgo: Math.floor((now - postedTime(p)) / 86400_000) }));
}

export type Suggestion =
  | { key: string; kind: "share"; from: string; to: string; fromShare: number; toShare: number; delta: number; why: string }
  | { key: string; kind: "followup"; postId: string; title: string; pillar: string; saveRate: number; why: string };

/** 다음 기획 제안 (기둥 기준, 적용은 사람이): 비중 옮기기 · 저장률 1위 후속편 */
function suggest(w: Workspace, posts: Post[]): Suggestion[] {
  if (posts.length < SUGGEST_FROM) return [];
  const out: Suggestion[] = [];
  const sr = (p: Post) => rate(p.metrics!.saves, p.metrics!.reach);
  const sorted = [...posts].map(sr).sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const pillars = w.pillars ?? [];
  const by = pillars.map((pl) => {
    const ps = posts.filter((p) => p.category === pl.name).sort((a, b) => postedTime(a) - postedTime(b));
    const reach = ps.reduce((a, p) => a + p.metrics!.reach, 0), saves = ps.reduce((a, p) => a + p.metrics!.saves, 0);
    const last2 = ps.slice(-2);
    return { pl, n: ps.length, saveRate: rate(saves, reach), low2: last2.length === 2 && last2.every((p) => sr(p) <= q1) };
  }).filter((x) => x.n >= 2);
  if (by.length >= 2) {
    const top = [...by].sort((a, b) => b.saveRate - a.saveRate)[0];
    const from = by.find((x) => x.low2 && x !== top) ?? [...by].sort((a, b) => a.saveRate - b.saveRate)[0];
    const delta = Math.min(SHARE_STEP, from.pl.share);
    if (from !== top && delta > 0 && from.saveRate < top.saveRate) {
      out.push({
        key: `share:${from.pl.name}>${top.pl.name}:${posts.length}`, kind: "share", from: from.pl.name, to: top.pl.name, fromShare: from.pl.share, toShare: top.pl.share, delta,
        why: `${from.low2 ? `${from.pl.name} 기둥의 최근 두 편이 모두 저장률 하위 25%예요. ` : `${from.pl.name} 기둥의 저장률(${from.saveRate}%)이 가장 낮아요. `}저장률이 가장 높은 기둥은 ${top.pl.name}(${top.saveRate}%)이에요. 한 번에 ${SHARE_STEP}%p까지만 옮겨요.`,
      });
    }
  }
  const best = [...posts].sort((a, b) => sr(b) - sr(a))[0];
  if (best) out.push({ key: `followup:${best.id}`, kind: "followup", postId: best.id, title: best.title, pillar: best.category, saveRate: sr(best), why: `저장률 1위(${sr(best)}%)예요. 같은 기둥(${best.category || "없음"})에 후속 주제를 검수 대기로 넣어요.` });
  const dismissed = new Set(w.dismissed ?? []);
  return out.filter((x) => !dismissed.has(x.key));
}

/** 성과 모아 보기: 기둥별 평균(저장률 순), 저장률 상위, 성과 적을 차례, 다음 기획 제안 */
export async function insights(wsId: string) {
  const w = (await getWorkspace(wsId)) ?? fail("서비스를 찾지 못했어요");
  const all = await listPosts(wsId);
  const posts = all.filter((p) => p.status === "posted" && p.metrics);
  const g = new Map<string, Post[]>();
  for (const p of posts) g.set(p.category || "없음", [...(g.get(p.category || "없음") ?? []), p]);
  const byPillar = [...g].map(([name, ps]) => {
    const sum = (f: (m: Metrics) => number) => ps.reduce((a, p) => a + f(p.metrics!), 0);
    return { name, posts: ps.length, reach: Math.round(sum((m) => m.reach) / ps.length), saveRate: rate(sum((m) => m.saves), sum((m) => m.reach)), engagement: rate(sum(eng), sum((m) => m.reach)), follows: sum((m) => m.follows), share: w.pillars?.find((x) => x.name === name)?.share ?? null };
  }).sort((a, b) => b.saveRate - a.saveRate);
  const top = [...posts].sort((a, b) => rate(b.metrics!.saves, b.metrics!.reach) - rate(a.metrics!.saves, a.metrics!.reach)).slice(0, 10)
    .map((p) => ({ id: p.id, day: p.day, slot: p.slot, title: p.title, category: p.category, template: p.template, reach: p.metrics!.reach, saveRate: rate(p.metrics!.saves, p.metrics!.reach), engagement: rate(eng(p.metrics!), p.metrics!.reach) }));
  return { posted: all.filter((p) => p.status === "posted").length, measured: posts.length, suggestFrom: SUGGEST_FROM, byPillar, top, due: await metricsDue(wsId), suggestions: suggest(w, posts) };
}

/** 제안 적용: 비중 옮기기 (합 100 유지) */
export async function applyShareSuggestion(wsId: string, from: string, to: string, delta: number) {
  const w = (await getWorkspace(wsId)) ?? fail("서비스를 찾지 못했어요");
  const pl = w.pillars ?? [];
  const a = pl.find((x) => x.name === from) ?? fail("기둥을 찾지 못했어요"), b = pl.find((x) => x.name === to) ?? fail("기둥을 찾지 못했어요");
  const d = Math.max(0, Math.min(SHARE_STEP, Math.round(Number(delta)) || 0, a.share));
  if (!d) fail("옮길 비중이 없어요");
  return setPillars(wsId, pl.map((x) => ({ ...x, share: x === a ? x.share - d : x === b ? x.share + d : x.share })));
}
/** 제안 적용: 후속편을 주제로 (검수 대기) */
export async function followUpIdea(postId: string, by: Idea["by"] = "user") {
  const p = (await getPost(postId)) ?? fail("게시물을 찾지 못했어요");
  return createIdea(p.workspace, { title: `${p.title} 후속편`.slice(0, 80), pillar: p.category, angle: `저장률이 높았던 '${p.title}'(D${p.day})에 이어 써요. 같은 독자에게 한 걸음 더 들어가요`, template: p.template, by });
}
export async function dismissSuggestion(wsId: string, key: string) {
  return mutate((db) => {
    const w = db.workspaces.find((x) => x.id === wsId) ?? fail("서비스를 찾지 못했어요");
    w.dismissed = [...new Set([...(w.dismissed ?? []), s(key, 120)])].slice(-100);
  });
}

// ── 즐겨찾기 · 표시 이름 · AI·MCP 작업 기록 ──────────────────────────

export async function toggleFavorite(uid: string, wsId: string) {
  return mutate((db) => {
    const p = db.prefs[uid] ?? { favorites: [] };
    p.favorites = p.favorites.includes(wsId) ? p.favorites.filter((x) => x !== wsId) : [...p.favorites, wsId].slice(-50);
    db.prefs[uid] = p;
    return p;
  });
}
/** 표시 이름: 계정은 계정 이름, 운영자는 화면 설정에 */
export async function setDisplayName(uid: string, name: unknown) {
  const n = s(name, 30);
  if (!n) fail("이름을 적어 주세요");
  return mutate((db) => {
    if (uid === "admin") db.prefs.admin = { ...(db.prefs.admin ?? { favorites: [] }), displayName: n };
    else { const u = db.users.find((x) => x.id === uid) ?? fail("계정을 찾지 못했어요"); u.name = n; }
  });
}

const ACTIVITY_MAX = 300; // 서비스마다
export async function logActivity(a: Omit<Activity, "id" | "at">) {
  return mutate((db) => {
    db.activity.push({ ...a, id: newId(), at: new Date().toISOString(), title: a.title.slice(0, 120), lines: a.lines.slice(0, 6).map((x) => x.slice(0, 200)) });
    const mine = db.activity.filter((x) => x.workspace === a.workspace);
    if (mine.length > ACTIVITY_MAX) { const drop = new Set(mine.slice(0, mine.length - ACTIVITY_MAX).map((x) => x.id)); db.activity = db.activity.filter((x) => !drop.has(x.id)); }
  });
}

// ── 함께 쓰는 사람 · 요금제 ─────────────────────────────────────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 멤버 더하기. 처음 보는 이메일이면 계정을 만들고 임시 비밀번호를 한 번 돌려준다 (소유자가 직접 전한다) */
export async function addMember(wsId: string, p: { email: unknown; name?: unknown; role: unknown }) {
  const email = s(p.email, 120).toLowerCase(), name = s(p.name, 30), role = p.role as Role;
  if (!EMAIL.test(email)) fail("이메일 주소를 다시 확인해 주세요 (예: name@example.com)");
  if (!ROLES.includes(role)) fail("역할은 소유자·편집자·검수자 중에서 골라 주세요");
  let temp: string | null = null;
  const out = await mutate((db) => {
    const w = db.workspaces.find((x) => x.id === wsId) ?? fail("서비스를 찾지 못했어요");
    const plan = planOf(w.plan);
    let u = db.users.find((x) => x.email === email);
    if (u && w.members?.some((m) => m.userId === u!.id)) fail("이미 함께 쓰는 사람이에요");
    if ((w.members?.length ?? 0) >= plan.members) fail(`${plan.name} 요금제는 ${plan.members}명까지 함께 써요`);
    if (!u) {
      temp = tempPassword();
      u = { id: newId(), email, name: name || email.split("@")[0], pass: hashPassword(temp), createdAt: new Date().toISOString() } satisfies User;
      db.users.push(u);
    }
    w.members = [...(w.members ?? []), { userId: u.id, role, addedAt: new Date().toISOString() }];
    return { userId: u.id, email: u.email, name: u.name, role };
  });
  return { ...out, tempPassword: temp as string | null };
}

export async function setMemberRole(wsId: string, userId: string, role: unknown) {
  if (!ROLES.includes(role as Role)) fail("역할은 소유자·편집자·검수자 중에서 골라 주세요");
  return mutate((db) => {
    const w = db.workspaces.find((x) => x.id === wsId) ?? fail("서비스를 찾지 못했어요");
    const m = w.members?.find((x) => x.userId === userId) ?? fail("함께 쓰는 사람이 아니에요");
    if (m.role === "owner" && role !== "owner" && w.members!.filter((x) => x.role === "owner").length === 1) fail("소유자는 한 명 이상 있어야 해요. 다른 사람을 먼저 소유자로 바꿔 주세요");
    m.role = role as Role;
    return m;
  });
}

/** 서비스에서 빼기 (계정은 남는다 — 다른 서비스에서 쓸 수 있다) */
export async function removeMember(wsId: string, userId: string) {
  return mutate((db) => {
    const w = db.workspaces.find((x) => x.id === wsId) ?? fail("서비스를 찾지 못했어요");
    const m = w.members?.find((x) => x.userId === userId) ?? fail("함께 쓰는 사람이 아니에요");
    if (m.role === "owner" && w.members!.filter((x) => x.role === "owner").length === 1) fail("마지막 소유자는 뺄 수 없어요. 다른 사람을 먼저 소유자로 바꿔 주세요");
    w.members = w.members!.filter((x) => x.userId !== userId);
    return m;
  });
}

/** 소유자가 멤버 비밀번호를 초기화 (임시 비밀번호를 한 번 돌려준다, 기존 로그인은 풀린다) */
export async function resetMemberPassword(wsId: string, userId: string) {
  const temp = tempPassword();
  await mutate((db) => {
    const w = db.workspaces.find((x) => x.id === wsId) ?? fail("서비스를 찾지 못했어요");
    if (!w.members?.some((m) => m.userId === userId)) fail("함께 쓰는 사람이 아니에요");
    const u = db.users.find((x) => x.id === userId) ?? fail("계정을 찾지 못했어요");
    u.pass = hashPassword(temp);
  });
  return temp;
}

export async function changePassword(userId: string, current: string, next: string) {
  if (next.length < 10) fail("새 비밀번호는 10자 이상으로 정해 주세요");
  return mutate((db) => {
    const u = db.users.find((x) => x.id === userId) ?? fail("계정을 찾지 못했어요");
    if (!verifyPassword(current, u.pass)) fail("지금 비밀번호가 맞지 않아요. 다시 확인해 주세요");
    u.pass = hashPassword(next);
    return u;
  });
}

/** 요금제 바꾸기 (결제 연결 전이라 운영자만 — 부르는 쪽에서 확인) */
export async function setPlan(wsId: string, plan: unknown) {
  if (!(["free", "pro", "agency"] as unknown[]).includes(plan)) fail("요금제는 무료·프로·에이전시 중에서 골라 주세요");
  return mutate((db) => {
    const w = db.workspaces.find((x) => x.id === wsId) ?? fail("서비스를 찾지 못했어요");
    w.plan = plan as PlanId;
    return w;
  });
}

/** AI 한 번 쓰기: 이번 달 한도 안이면 세고, 넘으면 막는다 (운영자는 세기만) */
export async function countAi(wsId: string, unlimited = false) {
  return mutate((db) => {
    const w = db.workspaces.find((x) => x.id === wsId) ?? fail("서비스를 찾지 못했어요");
    const m = thisMonth(), plan = planOf(w.plan);
    const used = w.usage?.month === m ? w.usage.ai : 0;
    if (!unlimited && used >= plan.aiPerMonth) fail(`이번 달 AI 사용 한도(${plan.aiPerMonth}번)를 다 썼어요. 다음 달에 다시 쓸 수 있어요`);
    w.usage = { month: m, ai: used + 1, video: w.usage?.month === m ? w.usage.video ?? 0 : 0 };
    return w.usage;
  });
}

/** AI 영상 한 편 (Veo 는 비싸서 글 AI 와 따로 센다). peek = 한도만 확인하고 세지 않음 (시작이 성공한 뒤에 센다) */
export async function countVideo(wsId: string, unlimited = false, peek = false) {
  return mutate((db) => {
    const w = db.workspaces.find((x) => x.id === wsId) ?? fail("서비스를 찾지 못했어요");
    const m = thisMonth(), plan = planOf(w.plan);
    const same = w.usage?.month === m;
    const used = same ? w.usage!.video ?? 0 : 0;
    if (!unlimited && used >= plan.videoPerMonth) fail(`이번 달 AI 영상 한도(${plan.videoPerMonth}편)를 다 썼어요. 다음 달에 다시 만들 수 있어요`);
    if (peek) return w.usage;
    w.usage = { month: m, ai: same ? w.usage!.ai : 0, video: used + 1 };
    return w.usage;
  });
}
