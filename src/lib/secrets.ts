import "server-only";
import { readFileSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// 외부 AI 연동 키: 환경 변수가 먼저, 없으면 운영자가 'AI 연동' 화면에서 넣은 값(.secrets/integrations.json, git 제외, 600).
// 화면·MCP 로 키를 다시 보여 주지 않는다 (끝 4자리만).

export type Provider = "anthropic" | "gemini";
const ENV: Record<Provider, string> = { anthropic: "ANTHROPIC_API_KEY", gemini: "GEMINI_API_KEY" };
const DIR = join(process.cwd(), ".secrets");
const FILE = join(DIR, "integrations.json");

function readFileKeys(): Partial<Record<Provider, string>> {
  try { return JSON.parse(readFileSync(FILE, "utf8")); } catch { return {}; }
}
export function getKey(p: Provider): string | null {
  return process.env[ENV[p]] || readFileKeys()[p] || null;
}
export function keyStatus(p: Provider) {
  const env = !!process.env[ENV[p]], k = getKey(p);
  return { connected: !!k, from: env ? ("env" as const) : k ? ("screen" as const) : null, tail: k ? k.slice(-4) : "", envName: ENV[p] };
}
/** 화면에서 넣은 키 저장 (빈 값이면 지운다) */
export async function setKey(p: Provider, value: string) {
  const cur = readFileKeys();
  const v = value.trim();
  if (v) cur[p] = v; else delete cur[p];
  await mkdir(DIR, { recursive: true, mode: 0o700 });
  await writeFile(FILE, JSON.stringify(cur, null, 1), { mode: 0o600 });
  await chmod(FILE, 0o600);
}
