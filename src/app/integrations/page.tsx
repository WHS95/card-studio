import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { keyStatus } from "@/lib/secrets";
import Top from "../Top";
import KeyForm from "./KeyForm";

/** AI 연동 (운영자만): Claude(글·자료 조사·초안) · Gemini(Veo 영상) 키 넣기·확인 */
export default async function Integrations() {
  const actor = await requireAuth();
  if (actor.kind !== "admin") redirect("/");
  const items = [
    { provider: "anthropic" as const, name: "Claude (Anthropic)", use: "아이디어 제안 · 웹 자료 조사 · 초안 쓰기", get: "https://console.anthropic.com/settings/keys", status: keyStatus("anthropic"), placeholder: "sk-ant-…" },
    { provider: "gemini" as const, name: "Gemini · Veo (Google)", use: "카드에 넣을 AI 영상 만들기 (Veo 3.1, 4·6·8초, 소리 포함)", get: "https://aistudio.google.com/apikey", status: keyStatus("gemini"), placeholder: "AIza…" },
  ];
  return (
    <>
      <Top />
      <main className="wrap" style={{ maxWidth: 820 }}>
        <h1 style={{ margin: 0 }}>AI 연동</h1>
        <p className="small muted" style={{ margin: 0 }}>키를 붙여 넣고 저장 → &apos;연결 확인&apos;. 키는 이 Mac 의 <code>.secrets/</code>(git 제외)에 저장되고 다시 보여 주지 않아요. <code>.env.local</code>에 같은 이름의 값이 있으면 그것이 먼저예요. 쓰는 만큼 각 회사에 요금이 나가요 (요금제의 한 달 한도로 막아요).</p>
        {items.map((it) => <KeyForm key={it.provider} {...it} />)}
      </main>
    </>
  );
}
