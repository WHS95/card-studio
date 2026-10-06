import "server-only";
import { baseUrl } from "./baseurl";

// OAuth 2.1 메타데이터 (MCP 권한 사양: 보호 자원 RFC 9728 + 인가 서버 RFC 8414). 이 스튜디오가 둘 다 맡는다.
export const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, mcp-protocol-version", "access-control-allow-methods": "GET, POST, OPTIONS" };
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...CORS, "cache-control": "no-store" } });

export function resourceMeta(req: Request) {
  const b = baseUrl(req);
  return { resource: `${b}/api/mcp`, authorization_servers: [b], scopes_supported: ["studio"], bearer_methods_supported: ["header"], resource_name: "카드뉴스 스튜디오" };
}
export function serverMeta(req: Request) {
  const b = baseUrl(req);
  return {
    issuer: b,
    authorization_endpoint: `${b}/oauth/authorize`,
    token_endpoint: `${b}/oauth/token`,
    registration_endpoint: `${b}/oauth/register`,
    scopes_supported: ["studio"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    authorization_response_iss_parameter_supported: true,
  };
}
