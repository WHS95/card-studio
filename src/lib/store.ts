import "server-only";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Activity, AiConfig, ApiToken, Idea, OAuthClient, Post, Prefs, Research, User, Workspace } from "./types";

// 1단계 저장소: data/studio.json 파일 하나 (혼자 쓰는 로컬 도구). 배포할 때 DB 로 바꾼다 — 이 파일의 함수만 바꾸면 된다.
export type Db = { workspaces: Workspace[]; posts: Post[]; ideas: Idea[]; research: Research[]; users: User[]; tokens: ApiToken[]; oauthClients: OAuthClient[]; activity: Activity[]; prefs: Record<string, Prefs>; ai?: AiConfig };
const FILE = join(process.cwd(), "data", "studio.json");
let chain: Promise<unknown> = Promise.resolve();

export async function readDb(): Promise<Db> {
  try {
    const db = JSON.parse(await readFile(FILE, "utf8")) as Partial<Db>;
    // 예전 저장본에는 없는 묶음 — 읽을 때 채운다
    // 0.6 전 아이디어 상태 'idea'(아직) = 검수 대기
    const ideas = (db.ideas ?? []).map((i) => ((i.status as string) === "idea" ? { ...i, status: "review" as const } : i));
    return { workspaces: db.workspaces ?? [], posts: db.posts ?? [], ideas, research: db.research ?? [], users: db.users ?? [], tokens: db.tokens ?? [], oauthClients: db.oauthClients ?? [], activity: db.activity ?? [], prefs: db.prefs ?? {}, ai: db.ai };
  } catch {
    return { workspaces: [], posts: [], ideas: [], research: [], users: [], tokens: [], oauthClients: [], activity: [], prefs: {} };
  }
}
/** 쓰기는 한 줄로 세워서 (동시에 두 번 써도 안 깨지게), 임시 파일에 쓴 뒤 바꿔 끼운다 */
export function mutate<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const db = await readDb();
    const out = await fn(db);
    const tmp = `${FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(db, null, 1));
    await rename(tmp, FILE);
    return out;
  });
  chain = run.catch(() => undefined);
  return run;
}

export async function listWorkspaces() { return (await readDb()).workspaces; }
export async function getWorkspace(id: string) { return (await readDb()).workspaces.find((w) => w.id === id) ?? null; }
/** 달력 게시물 (보관함으로 뺀 것 제외). 보관함은 listArchived */
export async function listPosts(ws: string) { return (await readDb()).posts.filter((p) => p.workspace === ws && !p.archivedAt).sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot)); }
export async function listArchived(ws: string) { return (await readDb()).posts.filter((p) => p.workspace === ws && p.archivedAt).sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "")); }
export async function getPost(id: string) { return (await readDb()).posts.find((p) => p.id === id) ?? null; }

export function updatePost(id: string, patch: Partial<Post>) {
  return mutate((db) => {
    const p = db.posts.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, patch, { updatedAt: new Date().toISOString() });
    return p;
  });
}
/** 칸(서비스·일차·시간대)마다 하나. 이미 있으면 그 게시물과 created=false */
export function createPost(p: Omit<Post, "id" | "updatedAt">) {
  return mutate((db) => {
    const hit = db.posts.find((x) => x.workspace === p.workspace && x.day === p.day && x.slot === p.slot && !x.archivedAt);
    if (hit) return { post: hit, created: false };
    const post: Post = { ...p, id: randomUUID(), updatedAt: new Date().toISOString() };
    db.posts.push(post);
    return { post, created: true };
  });
}
export function upsertWorkspace(w: Workspace) {
  return mutate((db) => {
    const i = db.workspaces.findIndex((x) => x.id === w.id);
    if (i >= 0) db.workspaces[i] = w; else db.workspaces.push(w);
    return w;
  });
}

export async function listIdeas(ws: string) { return (await readDb()).ideas.filter((x) => x.workspace === ws).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export async function getIdea(id: string) { return (await readDb()).ideas.find((x) => x.id === id) ?? null; }
export async function listResearch(ws: string) { return (await readDb()).research.filter((x) => x.workspace === ws).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export async function getResearch(id: string) { return (await readDb()).research.find((x) => x.id === id) ?? null; }
export const newId = () => randomUUID();
export async function getUser(id: string) { return (await readDb()).users.find((u) => u.id === id) ?? null; }
export async function getUserByEmail(email: string) { const e = email.trim().toLowerCase(); return (await readDb()).users.find((u) => u.email === e) ?? null; }
export async function listUsers(ids: string[]) { const set = new Set(ids); return (await readDb()).users.filter((u) => set.has(u.id)); }
export async function listActivity(ws: string, n = 30) { return (await readDb()).activity.filter((a) => a.workspace === ws).slice(-n).reverse(); }
export async function getPrefs(uid: string): Promise<Prefs> { return (await readDb()).prefs[uid] ?? { favorites: [] }; }
