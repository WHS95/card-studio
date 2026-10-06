import "server-only";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Photo } from "./types";
import { OpError } from "./ops";

// 직접 올린 사진·영상 → public/uploads/<ws>/<hex>.(jpg|png|mp4). 종류는 확장자가 아니라 파일 앞 바이트로 가린다.

export const IMAGE_MAX = 8 * 1024 * 1024;
export const VIDEO_MAX = 300 * 1024 * 1024;
const UPLOADS = join(process.cwd(), "public", "uploads");

type Kind = "jpg" | "png" | "mp4";
function sniff(head: Buffer): Kind | null {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (head.subarray(4, 8).toString("latin1") === "ftyp") return "mp4"; // mp4·mov(quicktime) 모두 ftyp
  return null;
}

/** 명령 실행 (셸 없이 인자 배열로) */
export function run(cmd: string, args: string[], timeoutMs = 10 * 60_000): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.on("error", (e) => { clearTimeout(t); resolve({ code: -1, out, err: String(e) }); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code: code ?? -1, out, err }); });
  });
}

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
export const ffmpeg = (args: string[], timeoutMs?: number) => run(FFMPEG, args, timeoutMs);

/** 영상 정보: 길이(초)·가로·세로·소리 있음 */
export async function probe(file: string) {
  const r = await run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], 60_000);
  if (r.code !== 0) throw new OpError("영상을 읽지 못했어요");
  const j = JSON.parse(r.out) as { format?: { duration?: string }; streams?: { codec_type: string; width?: number; height?: number }[] };
  const v = j.streams?.find((s) => s.codec_type === "video");
  const duration = Number(j.format?.duration);
  if (!v || !Number.isFinite(duration) || duration <= 0) throw new OpError("영상 트랙이 없어요");
  return { duration: Math.round(duration * 100) / 100, width: v.width ?? 0, height: v.height ?? 0, audio: !!j.streams?.some((s) => s.codec_type === "audio") };
}

/** 받은 파일(스트림) 저장. 크기 제한을 넘으면 중간에 끊고 지운다 */
export async function saveUpload(ws: string, body: ReadableStream<Uint8Array>): Promise<Photo> {
  if (!/^[a-z0-9-]+$/.test(ws)) throw new OpError("서비스를 찾지 못했어요");
  const dir = join(UPLOADS, ws);
  await mkdir(dir, { recursive: true });
  const id = randomBytes(6).toString("hex");
  const tmp = join(dir, `${id}.part`);
  const out = createWriteStream(tmp);
  let size = 0;
  try {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > VIDEO_MAX) { await reader.cancel(); throw new OpError("300MB 이하만 올릴 수 있어요"); }
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    await new Promise<void>((r, j) => out.end((e?: Error | null) => (e ? j(e) : r())));
  } catch (e) {
    out.destroy(); await rm(tmp, { force: true });
    throw e;
  }
  return finishUpload(ws, tmp, id, size);
}

/** 이 Mac 안 파일에서 가져오기 (MCP 용) — 복사 후 같은 검사 */
export async function importFile(ws: string, path: string): Promise<Photo> {
  const { createReadStream } = await import("node:fs");
  const { stat } = await import("node:fs/promises");
  const st = await stat(path).catch(() => null);
  if (!st?.isFile()) throw new OpError("파일을 찾지 못했어요");
  if (st.size > VIDEO_MAX) throw new OpError("300MB 이하만 올릴 수 있어요");
  const { Readable } = await import("node:stream");
  return saveUpload(ws, Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>);
}

async function finishUpload(ws: string, tmp: string, id: string, size: number): Promise<Photo> {
  const fh = await open(tmp, "r");
  const head = Buffer.alloc(16);
  await fh.read(head, 0, 16, 0);
  await fh.close();
  const kind = sniff(head);
  const fail = async (m: string) => { await rm(tmp, { force: true }); throw new OpError(m); };
  if (!kind) return fail("JPG·PNG 사진이나 MP4·MOV 영상만 돼요");
  if (kind !== "mp4" && size > IMAGE_MAX) return fail("사진은 8MB 이하만 돼요");
  const dir = join(UPLOADS, ws);
  if (kind !== "mp4") {
    await rename(tmp, join(dir, `${id}.${kind}`));
    return { url: `/uploads/${ws}/${id}.${kind}`, credit: "", source: "", kind: "image" };
  }
  let info;
  try { info = await probe(tmp); } catch (e) { await rm(tmp, { force: true }); throw e; }
  if (info.duration < 3) return fail("3초 이상인 영상만 돼요");
  const video = join(dir, `${id}.mp4`), poster = join(dir, `${id}0.jpg`);
  await rename(tmp, video);
  const r = await ffmpeg(["-y", "-v", "error", "-ss", String(Math.min(1, info.duration / 2)), "-i", video, "-frames:v", "1", "-vf", "scale=1080:-2", "-q:v", "3", poster], 120_000);
  if (r.code !== 0) { await rm(video, { force: true }); throw new OpError("영상 첫 장면을 뽑지 못했어요"); }
  return { url: `/uploads/${ws}/${id}.mp4`, credit: "", source: "", kind: "video", poster: `/uploads/${ws}/${id}0.jpg`, duration: info.duration };
}
