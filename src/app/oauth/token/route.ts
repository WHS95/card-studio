import { OpError } from "@/lib/ops";
import { CORS, json } from "@/lib/oauthmeta";
import { exchangeCode, refreshTokens } from "@/lib/tokens";

// 토큰 발급: authorization_code(+PKCE) · refresh_token. 본문은 form-urlencoded (JSON 도 받는다)
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  const p: Record<string, string> = ct.includes("json") ? ((await req.json().catch(() => ({}))) as Record<string, string>) : Object.fromEntries(new URLSearchParams(await req.text()));
  try {
    if (p.grant_type === "authorization_code") return json(await exchangeCode({ code: p.code, client_id: p.client_id, redirect_uri: p.redirect_uri, code_verifier: p.code_verifier }));
    if (p.grant_type === "refresh_token") return json(await refreshTokens(p.refresh_token, p.client_id));
    return json({ error: "unsupported_grant_type" }, 400);
  } catch (e) {
    return json({ error: e instanceof OpError ? e.message : "invalid_request" }, 400);
  }
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
