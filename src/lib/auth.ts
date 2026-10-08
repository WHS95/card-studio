import "server-only";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getPrefs, getUser, getUserByEmail, getWorkspace } from "./store";
import type { Role, User, Workspace } from "./types";

// 로그인 두 가지:
//  1) 운영자(환경 변수 STUDIO_ID · STUDIO_PASSWORD) — 쿠키 cs_admin, 모든 서비스·모든 권한. 값이 바뀌면 기존 로그인은 풀린다. (예전 그대로)
//  2) 계정(이메일 + 비밀번호, 서비스 소유자가 만든다) — 쿠키 cs_user = 사용자id.만료.서명. 비밀번호를 바꾸면 그 계정의 로그인이 풀린다.
// 서비스 안 권한은 역할로: 소유자(전부) · 편집자(만들기·고치기) · 검수자(보기·승인·게시 표시).

const COOKIE = "cs_admin";
const USER_COOKIE = "cs_user";
const digest = (id: string, pw: string) => createHash("sha256").update(`card-studio:${id}:${pw}`).digest("hex");
function token() {
  const id = process.env.STUDIO_ID, pw = process.env.STUDIO_PASSWORD;
  if (!id || !pw) throw new Error("STUDIO_ID·STUDIO_PASSWORD 가 없어요 (.env.local)");
  return digest(id, pw);
}
export function checkLogin(id: string, pw: string) {
  const a = Buffer.from(digest(id.trim(), pw)), b = Buffer.from(token());
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function setSession() {
  (await cookies()).set(COOKIE, token(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
}
export async function clearSession() { const c = await cookies(); c.delete(COOKIE); c.delete(USER_COOKIE); }

// ── 계정 비밀번호 (scrypt) ──
export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pw, salt, 32).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string) {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const a = scryptSync(pw, salt, 32), b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
/** 처음·초기화 비밀번호 (소유자가 한 번 보고 전한다) */
export const tempPassword = () => randomBytes(9).toString("base64url");

// ── 계정 세션 (서명 쿠키, DB 없이) ──
const secret = () => createHash("sha256").update(`card-studio:session:${process.env.STUDIO_SESSION_SECRET || token()}`).digest();
const sign = (u: User, exp: number) => createHmac("sha256", secret()).update(`${u.id}.${exp}.${u.pass.slice(-16)}`).digest("hex");
export async function setUserSession(u: User) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 14;
  (await cookies()).set(USER_COOKIE, `${u.id}.${exp}.${sign(u, exp)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
}
export async function loginUser(email: string, pw: string) {
  const u = await getUserByEmail(email);
  if (!u || !verifyPassword(pw, u.pass)) return null;
  await setUserSession(u);
  return u;
}

export type Actor = { kind: "admin"; id: "admin"; name: string } | { kind: "user"; id: string; name: string; email: string };

/** 지금 로그인한 사람 (없으면 null) */
export async function getActor(): Promise<Actor | null> {
  const c = await cookies();
  if (c.get(COOKIE)?.value === token()) return { kind: "admin", id: "admin", name: (await getPrefs("admin")).displayName || "운영자" };
  const raw = c.get(USER_COOKIE)?.value;
  if (!raw) return null;
  const [id, expS, sig] = raw.split(".");
  const exp = Number(expS);
  if (!id || !sig || !(exp > Date.now())) return null;
  const u = await getUser(id);
  if (!u) return null;
  const good = Buffer.from(sign(u, exp)), got = Buffer.from(sig);
  if (good.length !== got.length || !timingSafeEqual(good, got)) return null;
  return { kind: "user", id: u.id, name: u.name, email: u.email };
}
export async function isAuthed() { return !!(await getActor()); }
export async function requireAuth(): Promise<Actor> { const a = await getActor(); if (!a) redirect("/login"); return a; }

// ── 서비스 권한 ──
export type Perm = "view" | "edit" | "approve" | "manage";
const ALLOW: Record<Role, Perm[]> = { owner: ["view", "edit", "approve", "manage"], editor: ["view", "edit"], reviewer: ["view", "approve"] };
export const can = (role: Role | null, perm: Perm) => !!role && ALLOW[role].includes(perm);
/** 서비스에서의 역할 (운영자 = 소유자처럼, 멤버가 아니면 null) */
export function roleIn(actor: Actor, w: Workspace): Role | null {
  if (actor.kind === "admin") return "owner";
  return w.members?.find((m) => m.userId === actor.id)?.role ?? null;
}
/** 화면용: 서비스가 없거나 볼 수 없으면 404, 권한이 모자라면 서비스 첫 화면으로 */
export async function requireWs(wsId: string, perm: Perm = "view") {
  const actor = await requireAuth();
  const ws = await getWorkspace(wsId);
  const role = ws && roleIn(actor, ws);
  if (!ws || !role) notFound();
  if (!can(role, perm)) redirect(`/w/${ws.id}?error=${encodeURIComponent("이 일을 할 권한이 없어요. 소유자가 역할을 바꿔 줄 수 있어요")}`);
  return { actor, ws, role };
}
/** API·server action 용: 권한이 없으면 null (호출한 쪽이 401/403 으로) */
export async function wsAccess(wsId: string, perm: Perm = "view") {
  const actor = await getActor();
  const ws = actor && (await getWorkspace(wsId));
  const role = actor && ws ? roleIn(actor, ws) : null;
  return actor && ws && can(role, perm) ? { actor, ws, role: role! } : null;
}
