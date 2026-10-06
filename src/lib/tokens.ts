import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mutate, newId, readDb, getUser } from "./store";
import { OpError } from "./ops";
import type { Actor } from "./auth";
import type { ApiToken, OAuthClient } from "./types";

// AI 앱 연결 (Claude·ChatGPT·Claude Code 가 이 스튜디오를 MCP 로 쓰게): 개인 토큰(PAT)과 OAuth 토큰.
// 토큰은 sha256 만 저장한다. MCP 호출은 토큰 주인(계정·역할) 권한으로 돈다 — 구독 계정의 AI 가 그 사람으로 일한다.

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const fresh = (prefix: string) => `${prefix}_${randomBytes(24).toString("base64url")}`;
const ACCESS_TTL = 60 * 60 * 1000; // OAuth 접근 토큰 1시간 (새로 고침 토큰으로 갱신)
const PAT_MAX = 10;

/** 개인 토큰 만들기 — 값은 이번 한 번만 돌려준다 */
export async function createPat(userId: string, name: string) {
  const token = fresh("cs_pat");
  await mutate((db) => {
    if (db.tokens.filter((t) => t.userId === userId && t.kind === "pat").length >= PAT_MAX) throw new OpError(`개인 토큰은 ${PAT_MAX}개까지예요`);
    db.tokens.push({ id: newId(), userId, name: name.trim().slice(0, 40) || "개인 토큰", hash: sha(token), kind: "pat", createdAt: new Date().toISOString() });
  });
  return token;
}

/** 내 연결 목록 (개인 토큰 + 연결된 앱) */
export async function listTokens(userId: string) {
  const db = await readDb();
  return db.tokens.filter((t) => t.userId === userId).map((t) => ({ id: t.id, name: t.name, kind: t.kind, client: t.clientId ? db.oauthClients.find((c) => c.id === t.clientId)?.name ?? "앱" : null, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt }));
}
export async function revokeToken(userId: string, id: string) {
  return mutate((db) => {
    const t = db.tokens.find((x) => x.id === id && x.userId === userId);
    if (!t) throw new OpError("연결을 찾지 못했어요");
    db.tokens = db.tokens.filter((x) => x !== t);
  });
}

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

/** Bearer 토큰 → 누구로 돌지 (운영자 환경 변수 토큰 · 개인 토큰 · OAuth 접근 토큰) */
export async function actorFromBearer(bearer: string): Promise<Actor | null> {
  if (!bearer) return null;
  const env = process.env.STUDIO_MCP_TOKEN;
  if (env && same(sha(bearer), sha(env))) return { kind: "admin", id: "admin", name: "운영자" };
  const h = sha(bearer);
  const db = await readDb();
  const t = db.tokens.find((x) => x.hash === h);
  if (!t || (t.expiresAt && Date.parse(t.expiresAt) < Date.now())) return null;
  // 마지막 사용 시각은 5분에 한 번만 적는다 (매 호출마다 파일을 쓰지 않게)
  if (!t.lastUsedAt || Date.now() - Date.parse(t.lastUsedAt) > 5 * 60_000) void mutate((d) => { const x = d.tokens.find((y) => y.id === t.id); if (x) x.lastUsedAt = new Date().toISOString(); });
  if (t.userId === "admin") return { kind: "admin", id: "admin", name: "운영자" };
  const u = await getUser(t.userId);
  return u ? { kind: "user", id: u.id, name: u.name, email: u.email } : null;
}

// ── OAuth 2.1 (Claude·ChatGPT 커넥터) ──

export async function registerClient(input: { client_name?: unknown; redirect_uris?: unknown }): Promise<OAuthClient> {
  const uris = Array.isArray(input.redirect_uris) ? input.redirect_uris.map(String).filter((u) => /^https:\/\//.test(u) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u)).slice(0, 10) : [];
  if (!uris.length) throw new OpError("redirect_uris 가 필요해요 (https)");
  const c: OAuthClient = { id: `csc_${randomBytes(12).toString("base64url")}`, name: String(input.client_name ?? "AI 앱").slice(0, 60), redirectUris: uris, createdAt: new Date().toISOString() };
  await mutate((db) => { if (db.oauthClients.length > 500) db.oauthClients.shift(); db.oauthClients.push(c); });
  return c;
}
export async function getClient(id: string) { return (await readDb()).oauthClients.find((c) => c.id === id) ?? null; }

type Code = { clientId: string; redirectUri: string; challenge: string; userId: string; resource: string; exp: number };
const g = globalThis as unknown as { __oauthCodes?: Map<string, Code> };
const codes = (g.__oauthCodes ??= new Map());

/** 동의 뒤 인가 코드 (5분, 한 번만) */
export function issueCode(c: Omit<Code, "exp">) {
  const code = fresh("cs_code");
  codes.set(sha(code), { ...c, exp: Date.now() + 5 * 60_000 });
  return code;
}

async function issueTokens(userId: string, clientId: string) {
  const access = fresh("cs_oat"), refresh = fresh("cs_ort");
  await mutate((db) => {
    // 같은 사람·같은 앱은 한 줄 (다시 연결하면 바꿔 끼운다)
    db.tokens = db.tokens.filter((t) => !(t.kind === "oauth" && t.userId === userId && t.clientId === clientId));
    const name = db.oauthClients.find((c) => c.id === clientId)?.name ?? "AI 앱";
    db.tokens.push({ id: newId(), userId, name, hash: sha(access), refreshHash: sha(refresh), kind: "oauth", clientId, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ACCESS_TTL).toISOString() });
  });
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL / 1000, refresh_token: refresh, scope: "studio" };
}

/** 코드 → 토큰 (PKCE S256 확인) */
export async function exchangeCode(p: { code: string; client_id: string; redirect_uri: string; code_verifier: string }) {
  const k = sha(p.code);
  const c = codes.get(k);
  codes.delete(k);
  if (!c || c.exp < Date.now()) throw new OpError("invalid_grant");
  if (c.clientId !== p.client_id || c.redirectUri !== p.redirect_uri) throw new OpError("invalid_grant");
  const challenge = createHash("sha256").update(p.code_verifier ?? "").digest("base64url");
  if (!p.code_verifier || challenge !== c.challenge) throw new OpError("invalid_grant");
  return issueTokens(c.userId, c.clientId);
}

/** 새로 고침 토큰 → 새 토큰 (돌려 쓰기 방지로 새로 고침 토큰도 바꾼다) */
export async function refreshTokens(refresh: string, clientId: string) {
  const db = await readDb();
  const t = db.tokens.find((x) => x.kind === "oauth" && x.refreshHash === sha(refresh) && x.clientId === clientId);
  if (!t) throw new OpError("invalid_grant");
  return issueTokens(t.userId, clientId);
}
