import { CORS, json, serverMeta } from "@/lib/oauthmeta";

export const GET = (req: Request) => json(serverMeta(req));
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
