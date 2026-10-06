import { OpError } from "@/lib/ops";
import { CORS, json } from "@/lib/oauthmeta";
import { registerClient } from "@/lib/tokens";

// 동적 클라이언트 등록 (RFC 7591): Claude·ChatGPT 커넥터가 처음 연결할 때 한 번 부른다. 공개 클라이언트(PKCE), 비밀값 없음
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const c = await registerClient(body ?? {});
    return json({ client_id: c.id, client_name: c.name, redirect_uris: c.redirectUris, token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], client_id_issued_at: Math.floor(Date.parse(c.createdAt) / 1000) }, 201);
  } catch (e) {
    return json({ error: "invalid_client_metadata", error_description: e instanceof OpError ? e.message : "등록하지 못했어요" }, 400);
  }
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
