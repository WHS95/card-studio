import { CORS, json, resourceMeta } from "@/lib/oauthmeta";

// /.well-known/oauth-protected-resource (와 …/api/mcp 처럼 뒤에 경로가 붙은 형태)
export const GET = (req: Request) => json(resourceMeta(req));
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
