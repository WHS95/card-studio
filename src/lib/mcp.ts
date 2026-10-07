import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CAPTION_MAX, PHOTOS_MAX, PHOTO_H, VIDEO_DUR, validatePost } from "./fields";
import { TEMPLATES, templateOf } from "./templates";
import { getPost, getWorkspace, listIdeas, listPosts, listResearch, listWorkspaces } from "./store";
import { PRESETS, emptyBrief } from "./presets";
import { briefText } from "./ai";
import { getVeoJob, startVeo, VEO_MODELS, VEO_MODES } from "./veo";
import { can, roleIn, type Actor, type Perm } from "./auth";
import { getIdea, getResearch } from "./store";
import { countVideo, addResearch, applyShareSuggestion, checklistOf, createIdea, createPostIn, createWorkspace, dismissSuggestion, duplicatePost, followUpIdea, insights, logActivity, movePost, nextEmptySlot, setMetrics, OpError, savePost, scheduleIdea, scheduleIdeas, setPillars, setStatus, updateBrief, updateIdea, updateResearch, updateWorkspace, type WorkspacePatch } from "./ops";
import { flowOf } from "./flow";
import { importFile, ffmpeg } from "./media";
import { checkPost } from "./check";
import { fullCaption, slideFile } from "./exporter";
import { zip } from "./zip";
import { SAFE } from "./render/kit";
import { NEXT_STATUS, POST_STATUS, type Photo, type Post, type PostData, type PostStatus } from "./types";

// MCP 도구: 화면과 같은 규칙(ops.ts)으로만 고친다. 삭제·인스타 업로드 도구는 일부러 없다.
// 파일은 card-studio/exports/ 안에만 쓴다. 이 Mac 파일 가져오기는 내용(앞 바이트)으로 사진·영상만 받는다.

const BASE = process.env.STUDIO_URL || "http://127.0.0.1:3200";
const EXPORTS = join(process.cwd(), "exports");
const HASHTAG_MAX = 30;

type Json = Record<string, unknown>;
type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
type Tool = { name: string; description: string; inputSchema: Json; run: (a: Json, actor: Actor) => Promise<unknown> };

const str = { type: "string" } as const;
const int = { type: "integer" } as const;
const obj = (properties: Json, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const need = <T>(v: T | null | undefined, m: string): T => { if (v === null || v === undefined) throw new OpError(m); return v; };

const editorUrl = (p: Post) => `${BASE}/w/${p.workspace}/p/${p.id}`;
const summary = (p: Post) => ({
  id: p.id, day: p.day, slot: p.slot, status: p.status, template: p.template, category: p.category, title: p.title,
  slides: p.data?.slides.length ?? 0, metrics: p.metrics, video: !!p.data?.photos.some((x) => x.kind === "video"), postedUrl: p.postedUrl || undefined, updatedAt: p.updatedAt, url: editorUrl(p),
});
const postOut = (p: Post) => ({ ...p, captionWithCredits: fullCaption(p), nextStatus: NEXT_STATUS[p.status], url: editorUrl(p) });

async function postWs(id: string) {
  const p = need(await getPost(id), "게시물을 찾지 못했어요");
  const w = need(await getWorkspace(p.workspace), "서비스를 찾지 못했어요");
  return { p, w };
}
const dirOf = (p: Post) => join(EXPORTS, p.workspace, `D${String(p.day).padStart(2, "0")}-${p.slot.replace(":", "")}`);

/** 대화에 보여 줄 작은 JPG (원본 PNG 는 크다) */
async function thumb(file: string, video: boolean): Promise<Content | null> {
  const out = file.replace(/\.(png|mp4)$/, ".thumb.jpg");
  const r = await ffmpeg(["-y", "-v", "error", ...(video ? ["-ss", "0.5"] : []), "-i", file, "-frames:v", "1", "-vf", "scale=432:-2", "-q:v", "5", out], 60_000);
  if (r.code !== 0) return null;
  return { type: "image", data: (await readFile(out)).toString("base64"), mimeType: "image/jpeg" };
}

const PLAN_TOOLS: Tool[] = [
  {
    name: "generate_video",
    description: `카드에 넣을 AI 영상 만들기 (Google Veo, 'AI 연동'의 Gemini 키 필요, 요금 발생). 시작만 하고 job 번호를 돌려준다 → get_video_job 으로 10초쯤마다 확인 (보통 1~3분). 결과는 이 서비스에 올린 영상(photo)으로 저장 — update_post 로 data.photos 에 넣고 video:true 사진 칸에서 고른다.
mode: ${VEO_MODES.map((m) => `${m.id}=${m.label}(${m.note})`).join(" · ")}.
· image: firstFrame · frames: firstFrame+lastFrame · reference: references(1~3) · extend: extendFrom(이 스튜디오에서 Veo 로 만든 영상 주소, 2일 안). 사진 주소는 이 서비스에 올린 /uploads/<ws>/…jpg|png.
model: ${VEO_MODELS.map((m) => m.id).join(" · ")} (기본 lite; frames·reference·extend 는 lite 불가라 fast 로 바뀜, 8초로 맞춤). aspect 9:16(기본)|16:9, duration 4|6|8, resolution 720p|1080p(1080p 는 8초). 실제 사람·브랜드를 흉내 내지 않는다.`,
    inputSchema: obj({
      ws: str, prompt: str, mode: { type: "string", enum: VEO_MODES.map((m) => m.id) }, model: str, aspect: { type: "string", enum: ["9:16", "16:9"] }, duration: int,
      resolution: { type: "string", enum: ["720p", "1080p"] }, firstFrame: str, lastFrame: str, references: { type: "array", items: str, maxItems: 3 }, extendFrom: str, negative: str,
    }, ["ws", "prompt"]),
    run: async (a, actor) => { need(await getWorkspace(String(a.ws)), "서비스를 찾지 못했어요"); await countVideo(String(a.ws), actor.kind === "admin", true); const j = await startVeo(String(a.ws), a as never); await countVideo(String(a.ws), true); return { job: j.id, status: j.status, message: j.message, model: j.model }; },
  },
  {
    name: "get_video_job",
    description: "generate_video 작업 상태: running · done(photo 포함) · error(message). 서버를 다시 띄우면 작업 기록은 사라진다.",
    inputSchema: obj({ ws: str, job: str }, ["ws", "job"]),
    run: async (a) => { const j = need(getVeoJob(String(a.job), String(a.ws)), "작업을 찾지 못했어요"); return { status: j.status, message: j.message, photo: j.photo }; },
  },
  {
    name: "move_post",
    description: "게시물을 빈 칸으로 옮기기 (day·slot 을 안 주면 비어 있는 첫 칸).",
    inputSchema: obj({ id: str, day: int, slot: str }, ["id"]),
    run: async (a) => summary(await movePost(String(a.id), { day: a.day, slot: a.slot })),
  },
  {
    name: "duplicate_post",
    description: "같은 글·사진으로 빈 칸에 새 초안 만들기 (게시 링크·성과는 빼고). 시리즈·재활용용.",
    inputSchema: obj({ id: str, day: int, slot: str }, ["id"]),
    run: async (a) => postOut(await duplicatePost(String(a.id), { day: a.day, slot: a.slot })),
  },
  {
    name: "set_metrics",
    description: "게시된 게시물의 성과 적기 (사람이 알려 준 인스타 인사이트 숫자): reach·likes·comments·saves·shares·follows.",
    inputSchema: obj({ id: str, reach: int, likes: int, comments: int, saves: int, shares: int, follows: int }, ["id"]),
    run: async (a) => (await setMetrics(String(a.id), a as never)).metrics,
  },
  {
    name: "get_insights",
    description: "성과 모아 보기: 기둥별 평균 도달·저장률·참여율(저장률 순), 저장률 상위, 성과 적을 차례(due: 게시 뒤 metricsDays 일 지났는데 성과 없음), 다음 기획 제안(suggestions — 성과를 적은 게시물 7편부터: share=기둥 비중 옮기기, followup=후속편). 적용은 사람이 정하거나 apply_suggestion.",
    inputSchema: obj({ ws: str }, ["ws"]),
    run: (a) => insights(String(a.ws)),
  },
  {
    name: "apply_suggestion",
    description: "get_insights 의 제안 적용·넘기기. key = 제안 key, action: apply(share 면 기둥 비중을 옮기고, followup 이면 후속 주제를 검수 대기로) | dismiss(다시 안 보이게). 사람이 원할 때만.",
    inputSchema: obj({ ws: str, key: str, action: { type: "string", enum: ["apply", "dismiss"] } }, ["ws", "key", "action"]),
    run: async (a) => {
      const ws = String(a.ws), key = String(a.key);
      const sg = need((await insights(ws)).suggestions.find((x) => x.key === key), "그 제안을 찾지 못했어요 (이미 넘겼거나 바뀌었어요)");
      if (a.action === "dismiss") { await dismissSuggestion(ws, key); return { ok: true }; }
      if (sg.kind === "share") { await applyShareSuggestion(ws, sg.from, sg.to, sg.delta); await dismissSuggestion(ws, key); return { ok: true, pillars: (await getWorkspace(ws))?.pillars }; }
      const idea = await followUpIdea(sg.postId, "mcp"); await dismissSuggestion(ws, key); return { ok: true, idea };
    },
  },
  {
    name: "get_flow",
    description: "서비스의 8단계(목적·자료 조사·주제·템플릿·제작·검수·발행·성과) 지금 상태(done·doing·todo + 숫자 + 설명)와 '지금 할 일'. 무엇부터 할지 정할 때 먼저 본다.",
    inputSchema: obj({ ws: str }, ["ws"]),
    run: async (a) => flowOf(need(await getWorkspace(String(a.ws)), "서비스를 찾지 못했어요")),
  },
  {
    name: "get_checklist",
    description: "게시물 승인 전 확인: required(사람이 모두 체크해야 하는 문구 — set_status approved 의 checks 에 그대로), auto(규칙 경고·'확인 필요' 자료), review(이미 승인했으면 기록).",
    inputSchema: obj({ id: str }, ["id"]),
    run: (a) => checklistOf(String(a.id)),
  },
  {
    name: "get_brief",
    description: "서비스 브리프(무엇을·누구에게·말투·꼭 넣을 말·쓰지 않을 말·기본 해시태그·CTA)와 콘텐츠 기둥(이름·비중·기본 템플릿·예시 주제). 아이디어·초안·캡션을 쓰기 전에 먼저 읽는다. text 는 AI 가 읽기 좋은 요약.",
    inputSchema: obj({ ws: str }, ["ws"]),
    run: async (a) => {
      const w = need(await getWorkspace(String(a.ws)), "서비스를 찾지 못했어요");
      return { brief: { ...emptyBrief(), ...w.brief }, pillars: w.pillars ?? [], text: briefText(w), presets: PRESETS.map((p) => ({ id: p.id, name: p.name })) };
    },
  },
  {
    name: "update_brief",
    description: "브리프 고치기 (준 칸만): industry, about(300), audience(300), goals[], tone(200), keywords[], banned[], hashtags[](최대 30), cta(60), link(http), references[], rules{photoEvery,templateOnly,coverQuestion,ctaComment: 켜면 편집기 경고}, checklist[](승인 체크리스트에 더할 문구, 10개까지). pillars 를 주면 기둥을 통째로 바꾼다: [{name(20), description, share(합 100), template, examples[]}] — 기둥 이름은 달력 카테고리가 된다.",
    inputSchema: obj({ ws: str, brief: { type: "object" }, pillars: { type: "array", items: { type: "object" } } }, ["ws"]),
    run: async (a) => {
      const ws = String(a.ws);
      if (a.brief) await updateBrief(ws, a.brief as never);
      if (a.pillars) await setPillars(ws, a.pillars);
      const w = need(await getWorkspace(ws), "서비스를 찾지 못했어요");
      return { brief: w.brief, pillars: w.pillars ?? [] };
    },
  },
  {
    name: "list_ideas",
    description: "주제(아이디어) 보관함 (최신 순). status: review(검수 대기) · approved(승인, 달력에 넣을 수 있음) · planned(달력에 넣음, postId) · dropped(보류). 새 주제를 낼 때 겹치지 않게 먼저 본다.",
    inputSchema: obj({ ws: str, status: { type: "string", enum: ["review", "approved", "planned", "dropped"] }, pillar: str }, ["ws"]),
    run: async (a) => (await listIdeas(String(a.ws))).filter((i) => (!a.status || i.status === a.status) && (a.pillar === undefined || i.pillar === a.pillar)),
  },
  {
    name: "add_ideas",
    description: "주제 여러 개 더하기 (최대 20, 모두 검수 대기로 들어간다 — 사람이 승인해야 달력에 넣을 수 있다). 각 {title(80), pillar(기둥 이름), angle(어떤 각도로·메모), template?, research?(자료 id[])}. 사실·숫자가 들어가면 add_research 로 출처를 먼저 넣고 research 로 연결한다.",
    inputSchema: obj({ ws: str, ideas: { type: "array", items: obj({ title: str, pillar: str, angle: str, template: str, research: { type: "array", items: str } }, ["title"]) } }, ["ws", "ideas"]),
    run: async (a) => { const out = []; for (const x of (a.ideas as Json[]).slice(0, 20)) out.push(await createIdea(String(a.ws), { ...x, by: "mcp" } as never)); return out; },
  },
  {
    name: "update_idea",
    description: "주제 고치기: title, pillar, angle, template, status(review=검수 대기로 | approved=승인 — 소유자·검수자, 사람이 정했을 때만 | dropped=보류). 상태만 바꾸는 승인 취소·보류·꺼내기는 검수자도, research(자료 id[] 통째로).",
    inputSchema: obj({ id: str, title: str, pillar: str, angle: str, template: str, status: { type: "string", enum: ["review", "approved", "dropped"] }, research: { type: "array", items: str } }, ["id"]),
    run: (a, actor) => updateIdea(String(a.id), a as never, actor.name),
  },
  {
    name: "schedule_idea",
    description: "승인한 주제를 달력 칸에 넣어 기획 게시물로 만든다. day·slot 을 안 주면 비어 있는 첫 칸. 자료 출처가 게시물 메모에 붙는다. 그다음 create_post 대신 update_post 로 data 를 채운다.",
    inputSchema: obj({ id: str, day: int, slot: str }, ["id"]),
    run: async (a) => postOut(await scheduleIdea(String(a.id), a.day !== undefined && a.slot !== undefined ? { day: a.day, slot: a.slot } : undefined)),
  },
  {
    name: "schedule_ideas",
    description: "승인한 주제 여러 개를 ids 순서대로 빈 칸에 하루씩 넣는다 (fromDay 부터, 없으면 1일차부터 비어 있는 칸).",
    inputSchema: obj({ ws: str, ids: { type: "array", items: str }, fromDay: int }, ["ws", "ids"]),
    run: async (a) => {
      const ids = (a.ids as unknown[]).map(String);
      for (const id of ids) if ((await getIdea(id))?.workspace !== String(a.ws)) throw new OpError("다른 서비스의 주제가 섞여 있어요");
      return (await scheduleIdeas(ids, a.fromDay as number | undefined)).map(summary);
    },
  },
  {
    name: "next_empty_slot",
    description: "비어 있는 첫 달력 칸 (일차·시간대). 없으면 null.",
    inputSchema: obj({ ws: str, fromDay: int }, ["ws"]),
    run: async (a) => nextEmptySlot(String(a.ws), Number(a.fromDay ?? 1)),
  },
  {
    name: "list_research",
    description: "자료 조사 목록 (출처 주소·요약·메모·태그·신뢰도 high|medium|check). q 로 찾기.",
    inputSchema: obj({ ws: str, q: str, tag: str, confidence: { type: "string", enum: ["high", "medium", "check"] } }, ["ws"]),
    run: async (a) => (await listResearch(String(a.ws))).filter((r) => (!a.tag || r.tags.includes(String(a.tag))) && (!a.confidence || (r.confidence ?? "medium") === a.confidence) && (!a.q || `${r.title} ${r.summary} ${r.memo}`.includes(String(a.q)))),
  },
  {
    name: "add_research",
    description: "자료 더하기 (최대 20). 각 {title(120), url(https, 실제로 연 출처만), summary(2000, 카드에 쓸 핵심 사실), memo, tags[], confidence(high=공식·학술 원문을 직접 확인 | medium=2차 요약·블로그(기본) | check=원문 대조 전)}. 웹에서 찾은 내용은 반드시 출처 주소를 붙인다.",
    inputSchema: obj({ ws: str, items: { type: "array", items: obj({ title: str, url: str, summary: str, memo: str, tags: { type: "array", items: str }, confidence: { type: "string", enum: ["high", "medium", "check"] } }, ["title"]) } }, ["ws", "items"]),
    run: async (a) => { const out = []; for (const x of (a.items as Json[]).slice(0, 20)) out.push(await addResearch(String(a.ws), { ...x, by: "mcp" } as never)); return out; },
  },
  {
    name: "update_research",
    description: "자료 고치기: title, url, summary, memo, tags[], confidence(high|medium|check).",
    inputSchema: obj({ id: str, title: str, url: str, summary: str, memo: str, tags: { type: "array", items: str }, confidence: { type: "string", enum: ["high", "medium", "check"] } }, ["id"]),
    run: (a) => updateResearch(String(a.id), a as never),
  },
];

export const TOOLS: Tool[] = [
  {
    name: "list_workspaces",
    description: "카드뉴스 스튜디오의 서비스(워크스페이스) 목록: 테마·카테고리·발행 시간대·일수·1일차.",
    inputSchema: obj({}),
    run: async (_a, actor) => (await listWorkspaces()).filter((w) => roleIn(actor, w)).map((w) => ({ ...w, members: undefined, usage: undefined, role: roleIn(actor, w), url: `${BASE}/w/${w.id}` })),
  },
  {
    name: "create_workspace",
    description: "새 서비스 만들기. id 는 주소용 영문(소문자·숫자·-). industry 에 업종 묶음 id(get_brief 의 presets: community·cafe·beauty·fitness·education·saas·shop·travel·local)를 주면 기둥·말투·해시태그 시작값을 채운다. 나머지는 기본값(시간대 12:30, 30일).",
    inputSchema: obj({ id: str, name: str, industry: str, about: str, handle: { ...str, description: "인스타 계정 (@…)" }, accent: { ...str, description: "강조색 #RRGGBB (채움 전용)" } }, ["id", "name"]),
    run: (a, actor) => createWorkspace(a as never, actor.kind === "user" ? actor.id : undefined),
  },
  {
    name: "update_workspace",
    description: "서비스 설정 고치기: name, handle, categories[], slots[](HH:MM), days(1~90), startDate(YYYY-MM-DD|null), defaultTemplate, metricsDays(1~30, 성과 적을 차례), theme{dark,light,ink,muted,accent,onAccent,wordmark{text,color,bg}}. 강조색은 채움으로만 쓴다(그 위 글자 onAccent).",
    inputSchema: obj({ ws: str, patch: { type: "object" } }, ["ws", "patch"]),
    run: (a) => updateWorkspace(String(a.ws), a.patch as WorkspacePatch),
  },
  {
    name: "list_templates",
    description: "템플릿과 장 종류별 칸 정의(필드 스펙). data 를 만들기 전에 꼭 본다. data = { slides: [{ kind, ...칸 }], caption, photos: [{url,credit,source,kind?,poster?,duration?}] }. photo 칸 값은 photos 배열 번호(없으면 null). 장 공통 선택값: photoH(사진 높이 %), photoY(사진 위치 %), 영상 장이면 videoStart·videoDur(초)·videoMute.",
    inputSchema: obj({}),
    run: async () => ({
      templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, maxSlides: t.maxSlides, kinds: t.kinds.map((k) => ({ kind: k.kind, label: k.label, light: !!k.light, fixedFirst: !!k.fixed, fields: k.fields, blank: k.blank() })) })),
      limits: { captionMax: CAPTION_MAX, photosMax: PHOTOS_MAX, hashtagMax: HASHTAG_MAX, photoH: PHOTO_H, video: { ...VIDEO_DUR, note: "영상은 add_media 로 이 Mac 파일을 올린 것만, video:true 인 photo 칸에만" } },
      safeZone: { size: [1080, 1350], cover: SAFE.cover, feed: SAFE.feed, note: "글자 수 제한 안에서는 항상 안전 영역 안에 들어간다 (tests/slide_safe.py). 프로필 그리드는 표지를 3:4로 잘라 좌우 약 34px이 가려진다." },
      statuses: { all: POST_STATUS, next: NEXT_STATUS },
    }),
  },
  {
    name: "list_posts",
    description: "서비스의 게시물 목록 (일차·시간대 순). status 로 거를 수 있다.",
    inputSchema: obj({ ws: str, status: { type: "string", enum: [...POST_STATUS] }, dayFrom: int, dayTo: int }, ["ws"]),
    run: async (a) => (await listPosts(String(a.ws)))
      .filter((p) => (!a.status || p.status === a.status) && (!a.dayFrom || p.day >= Number(a.dayFrom)) && (!a.dayTo || p.day <= Number(a.dayTo)))
      .map(summary),
  },
  {
    name: "get_post",
    description: "게시물 전체 (data·캡션+사진 출처·다음에 갈 수 있는 상태·편집기 주소).",
    inputSchema: obj({ id: str }, ["id"]),
    run: async (a) => postOut((await postWs(String(a.id))).p),
  },
  {
    name: "draft_post",
    description: "저장하지 않고 템플릿 기본 초안 data 만 만들어 돌려준다 (고쳐서 create_post/update_post 에 넣기).",
    inputSchema: obj({ ws: str, template: str, title: str, category: str }, ["ws", "title"]),
    run: async (a) => {
      const w = need(await getWorkspace(String(a.ws)), "서비스를 찾지 못했어요");
      const t = templateOf(String(a.template ?? w.defaultTemplate));
      return { template: t.id, data: t.draft({ title: String(a.title), category: String(a.category ?? w.categories[0] ?? ""), handle: w.handle }) };
    },
  },
  {
    name: "validate_post",
    description: "저장 전 검사만: 템플릿 기준으로 data 가 맞는지 (글자·줄 수, 사진 번호, 영상 길이 등).",
    inputSchema: obj({ template: str, data: { type: "object" } }, ["template", "data"]),
    run: async (a) => { const e = validatePost(templateOf(String(a.template)), a.data); return e ? { ok: false, error: e } : { ok: true }; },
  },
  {
    name: "create_post",
    description: "달력 빈칸(일차·시간대)에 게시물 만들기. data 를 주면 검사 후 초안, draft:true 면 제목으로 기본 초안, 둘 다 없으면 기획. 이미 있는 칸이면 만들지 않고 그 게시물을 돌려준다(created:false).",
    inputSchema: obj({ ws: str, day: int, slot: { ...str, description: "HH:MM — 서비스 시간대 중 하나" }, template: str, title: str, category: str, note: str, data: { type: "object" }, draft: { type: "boolean" } }, ["ws", "day", "slot"]),
    run: async (a) => { const r = await createPostIn(String(a.ws), a as never); return { created: r.created, post: postOut(r.post) }; },
  },
  {
    name: "update_post",
    description: "게시물 고치기. data 는 통째로(get_post 로 받아 고친 것). 승인된 게시물 data 를 고치면 다시 초안이 된다. 게시된 것은 게시 취소 뒤에.",
    inputSchema: obj({ id: str, data: { type: "object" }, title: str, category: str, note: str, template: str }, ["id"]),
    run: async (a) => postOut(await savePost(String(a.id), a as never)),
  },
  {
    name: "set_status",
    description: "상태 바꾸기 (plan→skip, draft→approved|skip, approved→posted|draft|skip, posted→approved, skip→draft). draft→approved 는 checks(get_checklist 의 required 문구 전부)가 필요하다 — 사람이 직접 확인하고 체크했다고 말했을 때만. posted 는 postedUrl(인스타 게시물 링크) 필수.",
    inputSchema: obj({ id: str, status: { type: "string", enum: [...POST_STATUS] }, postedUrl: str, checks: { type: "array", items: str } }, ["id", "status"]),
    run: async (a, actor) => postOut(await setStatus(String(a.id), a.status as PostStatus, a.postedUrl as string | undefined, { checks: a.checks as string[] | undefined, by: actor.name })),
  },
  {
    name: "add_media",
    description: "사진·영상 더하기. url(https 이미지, 무료 사진은 출처 credit 필수 권장) 또는 filePath(이 Mac 의 JPG·PNG·MP4·MOV 절대 경로, 8MB/300MB). postId 를 주면 그 게시물 photos 끝에 붙여 저장하고 번호를 돌려준다.",
    inputSchema: obj({ ws: str, postId: str, url: str, filePath: str, credit: str, source: str }, ["ws"]),
    run: async (a) => {
      const ws = String(a.ws);
      const wsObj = need(await getWorkspace(ws), "서비스를 찾지 못했어요");
      let photo: Photo;
      if (typeof a.url === "string" && /unsplash\.com\/photos\//.test(a.url)) throw new OpError("Unsplash는 사진 페이지가 아니라 이미지 주소(images.unsplash.com/…)를 넣어 주세요");
      if (typeof a.filePath === "string" && a.filePath) photo = await importFile(ws, a.filePath);
      else if (typeof a.url === "string" && /^https:\/\/[^\s"'<>]+$/.test(a.url)) photo = { url: a.url.replace(/fm=webp/, "fm=jpg"), credit: "", source: new URL(a.url).hostname.includes("unsplash") ? "Unsplash" : new URL(a.url).hostname, kind: "image" };
      else throw new OpError("url(https) 이나 filePath 중 하나가 필요해요");
      photo.credit = String(a.credit ?? photo.credit).slice(0, 60);
      if (a.source) photo.source = String(a.source).slice(0, 40);
      if (!a.postId) return { photo };
      const { p } = await postWs(String(a.postId));
      if (p.workspace !== ws) throw new OpError("다른 서비스의 게시물이에요");
      const data: PostData = p.data ? structuredClone(p.data) : templateOf(p.template).draft({ title: p.title || "제목", category: p.category, handle: wsObj.handle });
      data.photos.push(photo);
      const saved = await savePost(p.id, { data });
      return { photo, index: data.photos.length - 1, post: summary(saved) };
    },
  },
  {
    name: "render_slide",
    description: "저장된 게시물의 한 장(n: 1부터)을 card-studio/exports/ 에 PNG(영상 장은 MP4)로 쓰고 경로를 돌려준다. preview:true 면 작은 JPG 도 같이 보여 준다.",
    inputSchema: obj({ id: str, n: int, preview: { type: "boolean" } }, ["id", "n"]),
    run: async (a) => {
      const { p, w } = await postWs(String(a.id));
      const d = need(p.data, "내용이 없는 게시물이에요");
      const i = Number(a.n) - 1;
      if (!(i >= 0 && i < d.slides.length)) throw new OpError(`장은 1~${d.slides.length}이에요`);
      const f = await slideFile(w, p, i);
      const dir = dirOf(p); await mkdir(dir, { recursive: true });
      const file = join(dir, f.name); await writeFile(file, f.data);
      const out: Content[] = [{ type: "text", text: JSON.stringify({ file, type: f.type, bytes: f.data.length }) }];
      if (a.preview) { const t = await thumb(file, f.type === "video/mp4"); if (t) out.push(t); }
      return { __content: out };
    },
  },
  {
    name: "check_safe_zone",
    description: "인스타 마진 계산: 사진·영상을 뺀 글·장식이 안전 영역(표지=그리드 3:4 기준, 안쪽=피드) 밖으로 나간 픽셀 수. id(저장본) 또는 ws+template+data(저장 전).",
    inputSchema: obj({ id: str, ws: str, template: str, data: { type: "object" } }),
    run: async (a) => {
      if (a.id) { const { p, w } = await postWs(String(a.id)); return checkPost(p.template, w.theme, need(p.data, "내용이 없는 게시물이에요")); }
      const w = need(await getWorkspace(String(a.ws)), "서비스를 찾지 못했어요");
      const t = templateOf(String(a.template));
      const e = validatePost(t, a.data); if (e) throw new OpError(e);
      return checkPost(t.id, w.theme, a.data as PostData);
    },
  },
  {
    name: "export_post",
    description: "저장된 게시물 전체를 card-studio/exports/<서비스>/D일차-시간/ 에 장별 PNG·MP4 + caption.txt + ZIP 으로 쓴다. 인스타 업로드는 하지 않는다(사람이 승인 후 직접).",
    inputSchema: obj({ id: str }, ["id"]),
    run: async (a) => {
      const { p, w } = await postWs(String(a.id));
      const d = need(p.data, "내용이 없는 게시물이에요");
      const dir = dirOf(p); await mkdir(dir, { recursive: true });
      const files: { name: string; data: Buffer }[] = [];
      for (let i = 0; i < d.slides.length; i++) { const f = await slideFile(w, p, i); files.push(f); await writeFile(join(dir, f.name), f.data); }
      const cap = { name: "caption.txt", data: Buffer.from(fullCaption(p), "utf8") };
      await writeFile(join(dir, cap.name), cap.data);
      const z = join(dir, `${w.id}-D${p.day}-${p.slot.replace(":", "")}.zip`);
      await writeFile(z, zip([...files, cap]));
      return { dir, files: [...files.map((f) => join(dir, f.name)), join(dir, cap.name)], zip: z, status: p.status, note: p.status === "approved" ? "승인된 게시물이에요" : "아직 승인 전이에요 — 업로드 전에 사람 검수가 필요해요" };
    },
  },
  ...PLAN_TOOLS,
];

export const INSTRUCTIONS = `카드뉴스 스튜디오(card-studio, ${BASE}) — 여러 서비스의 인스타 카드뉴스(1080×1350 캐러셀)를 기획·편집·검수·내보내기.
순서(8단계): list_workspaces → get_flow(지금 할 일) → get_brief(목적·기둥·콘텐츠 규칙) → add_research(자료, 신뢰도) → add_ideas(주제, 검수 대기) → 사람이 승인 → schedule_ideas → list_templates(칸 정의) → update_post(제작) → check_safe_zone·render_slide → get_checklist → 사람이 체크하고 승인(set_status approved + checks) → export_post(발행은 사람이) → 7일 뒤 set_metrics → get_insights 제안.
규칙: 주제 승인·게시물 승인은 사람이 확인한 뒤에만. 게시(posted)는 실제 인스타 링크가 있을 때만. 무료 사진은 주소+출처, 장소 이름이 나오면 실제 그 장소 사진만. 협찬은 #광고. 삭제·인스타 업로드 도구는 없다.`;

// ── 권한: 도구마다 어느 서비스의 무슨 권한이 필요한지 (계정으로 붙은 AI 앱은 그 사람 역할로만) ──
type On = "ws" | "post" | "idea" | "research";
const GUARD: Record<string, { on: On; perm: Perm } | "admin"> = {
  update_workspace: { on: "ws", perm: "manage" }, list_posts: { on: "ws", perm: "view" }, get_post: { on: "post", perm: "view" },
  draft_post: { on: "ws", perm: "view" }, create_post: { on: "ws", perm: "edit" }, update_post: { on: "post", perm: "edit" },
  set_status: { on: "post", perm: "edit" }, add_media: { on: "ws", perm: "edit" }, render_slide: { on: "post", perm: "view" },
  check_safe_zone: { on: "post", perm: "view" }, export_post: "admin", generate_video: { on: "ws", perm: "edit" }, get_video_job: { on: "ws", perm: "edit" },
  move_post: { on: "post", perm: "edit" }, duplicate_post: { on: "post", perm: "edit" }, set_metrics: { on: "post", perm: "edit" }, get_insights: { on: "ws", perm: "view" },
  get_brief: { on: "ws", perm: "view" }, update_brief: { on: "ws", perm: "edit" }, list_ideas: { on: "ws", perm: "view" }, add_ideas: { on: "ws", perm: "edit" },
  update_idea: { on: "idea", perm: "edit" }, schedule_idea: { on: "idea", perm: "edit" }, next_empty_slot: { on: "ws", perm: "view" },
  schedule_ideas: { on: "ws", perm: "edit" }, get_flow: { on: "ws", perm: "view" }, get_checklist: { on: "post", perm: "view" }, apply_suggestion: { on: "ws", perm: "edit" },
  list_research: { on: "ws", perm: "view" }, add_research: { on: "ws", perm: "edit" }, update_research: { on: "research", perm: "edit" },
};
async function wsOf(on: On, a: Json) {
  if (on === "ws") return String(a.ws ?? "");
  if (on === "post") return (await getPost(String(a.id ?? a.postId ?? "")))?.workspace ?? (typeof a.ws === "string" ? a.ws : "");
  if (on === "idea") return (await getIdea(String(a.id ?? "")))?.workspace ?? "";
  return (await getResearch(String(a.id ?? "")))?.workspace ?? "";
}
async function guard(name: string, a: Json, actor: Actor) {
  if (actor.kind === "admin") return;
  const g = GUARD[name];
  if (g === "admin" || (name === "add_media" && a.filePath)) throw new OpError("이 도구(또는 Mac 파일 가져오기)는 운영자만 써요");
  if (!g) return; // list_workspaces·list_templates·validate_post·create_workspace 는 안에서 걸러진다
  const w = await getWorkspace(await wsOf(g.on, a));
  const role = w ? roleIn(actor, w) : null;
  if (!w || !role) throw new OpError("서비스를 찾지 못했어요");
  // 승인·게시 표시·게시 취소는 검수 권한
  const perm: Perm = (name === "set_status" && (a.status === "approved" || a.status === "posted" || (await getPost(String(a.id)))?.status === "posted")) || (name === "update_idea" && a.status === "approved") ? "approve" : g.perm;
  // 주제 보류·보류에서 꺼내기·승인 취소(상태만 바꿀 때)는 검수자도
  const holding = name === "update_idea" && Object.keys(a).every((k) => k === "id" || k === "status") && (a.status === "dropped" || (a.status === "review" && ["dropped", "approved"].includes((await getIdea(String(a.id)))?.status ?? "")));
  if (!can(role, perm) && !(holding && can(role, "approve"))) throw new OpError("이 서비스에서 그 일을 할 권한이 없어요");
  if (name === "update_post" && a.postId && (await getPost(String(a.postId)))?.workspace !== w.id) throw new OpError("다른 서비스의 게시물이에요");
}

// ── AI·MCP 가 한 일 기록 (AI 패널 카드) ──
const ACT: Record<string, (a: Json, r: unknown) => [string, string[]] | null> = {
  add_ideas: (a) => [`주제 ${(a.ideas as unknown[]).length}개를 검수 대기로 넣었어요`, (a.ideas as Json[]).map((x) => `${x.title}${x.pillar ? ` · ${x.pillar}` : ""}`)],
  add_research: (a) => [`자료 ${(a.items as unknown[]).length}건을 넣었어요`, (a.items as Json[]).map((x) => String(x.title))],
  update_research: (a, r) => [a.confidence && Object.keys(a).length === 2 ? "자료 신뢰도를 바꿨어요" : "자료를 고쳤어요", [String((r as { title?: string })?.title ?? a.title ?? "")].filter(Boolean)],
  update_idea: (a, r) => [a.status === "approved" ? "주제를 승인했어요" : a.status === "dropped" ? "주제를 보류했어요" : a.status === "review" ? "주제를 검수 대기로 돌렸어요" : "주제를 고쳤어요", [`${(r as { title?: string })?.title ?? a.title ?? ""}${a.pillar ? ` · 기둥 ${a.pillar}` : ""}`].filter(Boolean)],
  schedule_idea: (_a, r) => ["주제를 달력에 넣었어요", [`D${(r as Post).day} ${(r as Post).slot} · ${(r as Post).title}`]],
  schedule_ideas: (_a, r) => [`주제 ${(r as unknown[]).length}개를 달력에 넣었어요`, (r as { day: number; slot: string; title: string }[]).map((p) => `D${p.day} ${p.slot} · ${p.title}`)],
  create_post: (_a, r) => ["게시물을 만들었어요", [`${(r as { post: Post }).post.title}`]],
  update_post: (_a, r) => ["게시물을 고쳤어요", [`D${(r as Post).day} ${(r as Post).slot} · ${(r as Post).title}`]],
  set_status: (a, r) => [`상태를 ${a.status}(으)로 바꿨어요`, [(r as Post).title]],
  update_brief: (a) => ["브리프를 고쳤어요", Object.keys((a.brief as Json) ?? {}).concat(a.pillars ? ["기둥"] : [])],
  update_workspace: () => ["서비스 설정을 고쳤어요", []],
  set_metrics: (a) => ["성과를 적었어요", [`도달 ${a.reach ?? "-"} · 저장 ${a.saves ?? "-"} · 댓글 ${a.comments ?? "-"}`]],
  add_media: (a) => ["사진·영상을 더했어요", [String(a.credit || a.url || a.filePath || "")]],
  move_post: () => ["게시물을 옮겼어요", []], duplicate_post: () => ["게시물을 복제했어요", []],
  apply_suggestion: (a) => [a.action === "dismiss" ? "제안을 넘겼어요" : "제안을 적용했어요", [String(a.key)]],
  generate_video: () => ["AI 영상을 만들기 시작했어요", []],
};
async function wsOfCall(name: string, a: Json): Promise<string> {
  if (typeof a.ws === "string") return a.ws;
  const g = GUARD[name];
  return g && g !== "admin" ? await wsOf(g.on, a) : "";
}

/** actor: 토큰 주인 (운영자·계정). 계정이면 그 사람 역할 안에서만. via: mcp(바깥 AI 앱) · ai(스튜디오 AI 패널) */
export async function callTool(name: string, args: Json, actor: Actor = { kind: "admin", id: "admin", name: "운영자" }, via: "mcp" | "ai" = "mcp"): Promise<{ content: Content[]; isError?: boolean }> {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return { content: [{ type: "text", text: `모르는 도구예요: ${name}` }], isError: true };
  try {
    await guard(name, args ?? {}, actor);
    const r = await t.run(args ?? {}, actor);
    const act = ACT[name]?.(args ?? {}, r);
    if (act) { const ws = await wsOfCall(name, args ?? {}); if (ws) await logActivity({ workspace: ws, via, who: actor.name, tool: name, title: act[0], lines: act[1], ok: true }).catch(() => undefined); }
    if (r && typeof r === "object" && "__content" in r) return { content: (r as { __content: Content[] }).__content };
    return { content: [{ type: "text", text: JSON.stringify(r, null, 1) }] };
  } catch (e) {
    if (e instanceof OpError) return { content: [{ type: "text", text: e.message }], isError: true };
    console.error(e);
    return { content: [{ type: "text", text: "처리하지 못했어요 (서버 로그 확인)" }], isError: true };
  }
}
