import "server-only";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OpError } from "./ops";
import { getKey } from "./secrets";
import { saveUpload } from "./media";
import { UPLOAD_RE } from "./fields";
import type { Photo } from "./types";

// 카드에 넣을 AI 영상 (Google Veo, Gemini API). 'AI 연동'의 Gemini 키(또는 GEMINI_API_KEY)로.
// 순서: predictLongRunning 시작 → 10초마다 상태 확인 → 다 되면 MP4 를 받아 직접 올린 영상과 같은 길(saveUpload)로 저장.
// 구글 서버의 결과는 2일 뒤 지워지므로 바로 스튜디오에 저장한다. 걸리는 시간 약 10초~6분 → 화면은 작업 번호로 상태를 묻는다.

const API = "https://generativelanguage.googleapis.com/v1beta";
export const VEO_MODELS = [
  { id: "veo-3.1-lite-generate-preview", label: "Lite (가장 싸고 빠름)" },
  { id: "veo-3.1-fast-generate-preview", label: "Fast" },
  { id: "veo-3.1-generate-preview", label: "기본 (가장 좋음)" },
] as const;
export const VEO_DURATIONS = [4, 6, 8] as const;
/** 만드는 방식. 처음·끝 / 참고 사진 / 이어 붙이기는 Lite 가 못 하고 8초만 (Gemini API 문서) */
export const VEO_MODES = [
  { id: "text", label: "글로만", note: "설명만으로" },
  { id: "image", label: "첫 장면 사진", note: "올린 사진에서 시작" },
  { id: "frames", label: "처음·끝 사진", note: "두 사진 사이를 이어 움직임 (8초, Fast·기본)" },
  { id: "reference", label: "참고 사진", note: "제품·인물·장소 모습 유지, 최대 3장 (8초, Fast·기본)" },
  { id: "extend", label: "이어 붙이기", note: "Veo 로 만든 영상 뒤에 7초 더 (2일 안, 720p, Fast·기본)" },
] as const;
export type VeoMode = (typeof VEO_MODES)[number]["id"];
export type VeoInput = {
  prompt: string; mode?: VeoMode; model?: string; aspect?: "9:16" | "16:9"; duration?: number; resolution?: "720p" | "1080p"; negative?: string;
  firstFrame?: string; lastFrame?: string; references?: string[]; extendFrom?: string; // 이 서비스에 올린 파일 주소 (/uploads/<ws>/…)
};
export type VeoJob = { id: string; ws: string; status: "running" | "done" | "error"; startedAt: number; message: string; photo?: Photo; prompt: string; model: string };

// 개발 서버가 코드를 다시 불러와도 작업 목록이 남게
const g = globalThis as unknown as { __veoJobs?: Map<string, VeoJob> };
const jobs = (g.__veoJobs ??= new Map());

export const veoEnabled = () => !!getKey("gemini");
const key = () => getKey("gemini") ?? (() => { throw new OpError("운영자가 'AI 연동'에서 Gemini 키를 넣어 주세요"); })();

async function api(path: string, init?: RequestInit) {
  const r = await fetch(path.startsWith("http") ? path : `${API}/${path}`, { ...init, headers: { "x-goog-api-key": key(), "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    const m = /"message":\s*"([^"]+)"/.exec(t)?.[1];
    if (r.status === 400 || r.status === 403) throw new OpError(`Google 이 요청을 받지 않았어요: ${m ?? r.status}`);
    if (r.status === 429) throw new OpError("Gemini 사용량 한도에 걸렸어요. 잠시 뒤 다시 해 주세요");
    throw new OpError(`Veo 호출이 실패했어요 (${r.status})`);
  }
  return r;
}

/** 시작만 하고 작업 번호를 돌려준다 (기다리지 않음) */
export async function startVeo(ws: string, input: VeoInput): Promise<VeoJob> {
  const prompt = String(input.prompt ?? "").trim().slice(0, 1500);
  if (prompt.length < 5) throw new OpError("어떤 영상인지 5자 이상 적어 주세요");
  const mode: VeoMode = VEO_MODES.some((m) => m.id === input.mode) ? input.mode! : input.firstFrame ? "image" : "text";
  const notes: string[] = [];
  let model: string = VEO_MODELS.some((m) => m.id === input.model) ? input.model! : VEO_MODELS[0].id;
  let duration = (VEO_DURATIONS as readonly number[]).includes(Number(input.duration)) ? Number(input.duration) : 8;
  let resolution = input.resolution === "1080p" ? "1080p" : "720p";
  // 모드·모델·길이 맞추기 (안 되는 조합은 고쳐 쓰고 알려 준다)
  const heavy = mode === "frames" || mode === "reference" || mode === "extend";
  if (heavy && model.includes("lite")) { model = "veo-3.1-fast-generate-preview"; notes.push("이 방식은 Lite 가 못 해서 Fast 로"); }
  if ((heavy || resolution === "1080p") && duration !== 8) { duration = 8; notes.push("8초로"); }
  if (mode === "extend" && resolution !== "720p") { resolution = "720p"; notes.push("이어 붙이기는 720p 로"); }
  const instance: Record<string, unknown> = { prompt };
  const photoData = async (u: string | undefined, what: string) => {
    if (!u || !UPLOAD_RE.test(u) || u.endsWith(".mp4") || !u.startsWith(`/uploads/${ws}/`)) throw new OpError(`${what}은 이 서비스에 직접 올린 사진(JPG·PNG)만 돼요`);
    const buf = await readFile(join(process.cwd(), "public", u));
    return { inlineData: { mimeType: u.endsWith(".png") ? "image/png" : "image/jpeg", data: buf.toString("base64") } };
  };
  if (mode === "image" || mode === "frames") instance.image = await photoData(input.firstFrame, "첫 장면");
  if (mode === "frames") instance.lastFrame = await photoData(input.lastFrame, "끝 장면");
  if (mode === "reference") {
    const refs = (input.references ?? []).filter(Boolean).slice(0, 3);
    if (!refs.length) throw new OpError("참고 사진을 1~3장 골라 주세요");
    instance.referenceImages = await Promise.all(refs.map(async (u) => ({ image: await photoData(u, "참고 사진"), referenceType: "asset" })));
  }
  if (mode === "extend") {
    const src = (await veoRegistry())[input.extendFrom ?? ""];
    if (!src || !input.extendFrom?.startsWith(`/uploads/${ws}/`)) throw new OpError("이어 붙이기는 이 스튜디오에서 Veo 로 만든 영상만 돼요");
    if (Date.now() - src.at > 47 * 3600_000) throw new OpError("Google 이 영상을 2일만 보관해서, 만든 지 2일이 지난 영상은 이어 붙일 수 없어요");
    instance.video = { uri: src.uri };
  }
  const parameters: Record<string, unknown> = { aspectRatio: input.aspect === "16:9" ? "16:9" : "9:16", durationSeconds: String(duration), resolution, numberOfVideos: 1 };
  if (input.negative) parameters.negativePrompt = String(input.negative).slice(0, 300);
  const r = await api(`models/${model}:predictLongRunning`, { method: "POST", body: JSON.stringify({ instances: [instance], parameters }) });
  const op = (await r.json()) as { name?: string };
  if (!op.name) throw new OpError("Veo 작업을 시작하지 못했어요");
  const job: VeoJob = { id: randomBytes(6).toString("hex"), ws, status: "running", startedAt: Date.now(), message: `만드는 중 (보통 1~3분)${notes.length ? ` · ${notes.join(", ")} 바꿨어요` : ""}`, prompt, model };
  jobs.set(job.id, job);
  void follow(job, op.name);
  return job;
}

/** 다 될 때까지 10초마다 묻고, 끝나면 받아서 저장 */
async function follow(job: VeoJob, opName: string) {
  try {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 10_000));
      const op = (await (await api(opName)).json()) as {
        done?: boolean; error?: { message?: string };
        response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[]; raiMediaFilteredReasons?: string[] } };
      };
      if (!op.done) { job.message = `만드는 중 · ${Math.round((Date.now() - job.startedAt) / 1000)}초`; continue; }
      if (op.error) throw new OpError(`Veo 가 실패했어요: ${op.error.message ?? ""}`);
      const res = op.response?.generateVideoResponse;
      const uri = res?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new OpError(res?.raiMediaFilteredReasons?.length ? `Google 안전 기준에 걸려 영상을 만들지 않았어요: ${res.raiMediaFilteredReasons.join(" ")}` : "영상 주소를 받지 못했어요");
      job.message = "받아서 저장하는 중";
      const file = await api(uri);
      if (!file.body) throw new OpError("영상을 받지 못했어요");
      const photo = await saveUpload(job.ws, file.body as ReadableStream<Uint8Array>);
      photo.credit = "AI 생성 (Google Veo)";
      photo.source = "Google Veo";
      await remember(photo.url, uri); // 2일 안에 '이어 붙이기'를 할 수 있게 구글 쪽 주소를 기억
      Object.assign(job, { status: "done", photo, message: "다 됐어요" });
      return;
    }
    throw new OpError("10분이 지나도 끝나지 않았어요. 다시 해 주세요");
  } catch (e) {
    Object.assign(job, { status: "error", message: e instanceof OpError ? e.message : (console.error(e), "영상을 만들지 못했어요") });
  }
}

export function getVeoJob(id: string, ws: string) {
  const j = jobs.get(id);
  return j && j.ws === ws ? j : null;
}

/** 연결 확인: 모델 목록을 한 번 읽어 본다 (돈 안 드는 호출) */
export async function testGemini() {
  const r = await api("models?pageSize=50");
  const j = (await r.json()) as { models?: { name: string }[] };
  return (j.models ?? []).some((m) => m.name.includes("veo")) ? "연결됐어요 (Veo 모델 보임)" : "연결은 됐지만 이 키로는 Veo 모델이 안 보여요 (결제·지역 확인)";
}

// Veo 로 만든 영상의 구글 쪽 주소 (이어 붙이기용, 2일 보관) — .cache/veo.json (git 제외)
const REG = join(process.cwd(), ".cache", "veo.json");
export async function veoRegistry(): Promise<Record<string, { uri: string; at: number }>> {
  try { return JSON.parse(await readFile(REG, "utf8")); } catch { return {}; }
}
async function remember(url: string, uri: string) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const reg = await veoRegistry();
  for (const [k, v] of Object.entries(reg)) if (Date.now() - v.at > 3 * 86400_000) delete reg[k];
  reg[url] = { uri, at: Date.now() };
  await mkdir(join(process.cwd(), ".cache"), { recursive: true });
  await writeFile(REG, JSON.stringify(reg, null, 1));
}
/** 이 목록 중 아직 이어 붙일 수 있는 영상 주소 */
export async function extendable(urls: string[]) {
  const reg = await veoRegistry();
  return urls.filter((u) => reg[u] && Date.now() - reg[u].at < 47 * 3600_000);
}
