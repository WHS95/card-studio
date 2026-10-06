import { INSTRUCTIONS, TOOLS, callTool } from "@/lib/mcp";
import { actorFromBearer } from "@/lib/tokens";
import { baseUrl } from "@/lib/baseurl";
import type { Actor } from "@/lib/auth";

// MCP (Streamable HTTP, 상태 없음·JSON 응답). Authorization: Bearer <토큰>
//  · STUDIO_MCP_TOKEN = 운영자 (예전 그대로: claude mcp add … --header "Authorization: Bearer …")
//  · 개인 토큰(cs_pat_…) = 그 계정 권한 — '내 계정 > AI 앱 연결'에서 만든다
//  · OAuth 접근 토큰 = Claude.ai·ChatGPT 커넥터가 '연결' 때 받는 것 (그 계정 권한)
// 토큰이 없거나 틀리면 401 + WWW-Authenticate 로 OAuth 안내(/.well-known/oauth-protected-resource)

type Msg = { jsonrpc: "2.0"; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const bearer = (req: Request) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
// 다른 사이트에서 브라우저로 부르는 것 막기 (DNS 리바인딩)
// 브라우저에서 오는 요청은 이 Mac·Claude·ChatGPT 주소만 (토큰이 늘 필요하다)
const badOrigin = (req: Request) => { const o = req.headers.get("origin"); return !!o && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$|^https:\/\/([a-z0-9-]+\.)*(claude\.ai|anthropic\.com|chatgpt\.com|openai\.com)$/.test(o); };

async function handle(m: Msg, actor: Actor) {
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: m.id ?? null, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id: m.id ?? null, error: { code, message } });
  switch (m.method) {
    case "initialize": {
      const asked = String(m.params?.protocolVersion ?? "");
      return ok({ protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: "card-studio", version: "0.5.0" }, instructions: INSTRUCTIONS });
    }
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": return ok(await callTool(String(m.params?.name ?? ""), (m.params?.arguments ?? {}) as Record<string, unknown>, actor));
    default: return err(-32601, `없는 메서드: ${m.method}`);
  }
}

export async function POST(req: Request) {
  if (badOrigin(req)) return new Response("forbidden", { status: 403 });
  const actor = await actorFromBearer(bearer(req));
  if (!actor) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "로그인이 필요해요 (토큰이 없거나 만료)" } }, {
    status: 401, headers: { "WWW-Authenticate": `Bearer resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource"` },
  });
  const body = (await req.json().catch(() => null)) as Msg | Msg[] | null;
  if (!body) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON 이 아니에요" } }, { status: 400 });
  const list = Array.isArray(body) ? body : [body];
  const replies = [];
  for (const m of list) if (m.method && m.id !== undefined && m.id !== null) replies.push(await handle(m, actor)); // id 없는 건 알림 → 답 없음
  if (!replies.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? replies : replies[0]);
}

const no = () => new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
export const GET = no;
export const DELETE = no;
