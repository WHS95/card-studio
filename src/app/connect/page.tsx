import { headers } from "next/headers";
import { requireAuth } from "@/lib/auth";
import { baseUrl } from "@/lib/baseurl";
import { listTokens } from "@/lib/tokens";
import { WideShell } from "../ui/Shell";
import ConnectApps from "../account/ConnectApps";

/** AI 앱 연결: 내 Claude·ChatGPT·Claude Code 에 이 스튜디오를 붙여(MCP) 내 구독으로 작업 */
export default async function Connect() {
  const actor = await requireAuth();
  const base = baseUrl(new Request("http://x", { headers: await headers() }));
  const rows = await listTokens(actor.kind === "admin" ? "admin" : actor.id);
  return (
    <WideShell active="connect" narrow>
      <h1>AI 앱 연결</h1>
      <ConnectApps mcpUrl={`${base}/api/mcp`} local={/^http:\/\/(127\.0\.0\.1|localhost)/.test(base)} rows={rows} />
    </WideShell>
  );
}
