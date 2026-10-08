import { requireAuth } from "@/lib/auth";
import { keyStatus } from "@/lib/secrets";
import { aiConfig, localCliAllowed, modelsOf, viaStatus } from "@/lib/llm";
import { getPrefs } from "@/lib/store";
import { AI_VIA, type AiVia } from "@/lib/types";
import { WideShell } from "../ui/Shell";
import KeyForm from "../integrations/KeyForm";
import ProfileForm from "./ProfileForm";
import AiSettings from "./AiSettings";

/** 설정: 표시 이름 · AI 연결(이 Mac 의 Claude Code·Codex / API 키) · 작업별 모델 · API 키 (AI 부분은 운영자만 바꾼다) */
export default async function Settings() {
  const actor = await requireAuth();
  const admin = actor.kind === "admin";
  const name = admin ? (await getPrefs("admin")).displayName || "운영자" : actor.name;
  const [cfg, status] = await Promise.all([aiConfig(), viaStatus(actor)]);
  const models = Object.fromEntries(await Promise.all(AI_VIA.map(async (v) => [v, status[v].ok ? await modelsOf(v) : []] as const))) as Record<AiVia, { id: string; label: string }[]>;
  const keys = [
    { provider: "anthropic" as const, name: "Anthropic API 키", use: "Claude 모델을 API 로 불러요 · 쓴 만큼 요금이 나가요 · 함께 쓰는 계정도 이 키를 써요", get: "https://console.anthropic.com/settings/keys", status: keyStatus("anthropic"), placeholder: "sk-ant-…" },
    { provider: "openai" as const, name: "OpenAI API 키", use: "GPT 모델을 API 로 불러요 · 쓴 만큼 요금이 나가요 · 함께 쓰는 계정도 이 키를 써요", get: "https://platform.openai.com/api-keys", status: keyStatus("openai"), placeholder: "sk-…" },
    { provider: "gemini" as const, name: "Gemini · Veo (Google)", use: "카드에 넣을 AI 영상 만들기 (Veo 3.1)", get: "https://aistudio.google.com/apikey", status: keyStatus("gemini"), placeholder: "AIza…" },
  ];
  return (
    <WideShell active="settings">
      <h1 className="w-1100 w-h1-lg">설정</h1>
      <section className="sect w-lg"><h2>프로필</h2><ProfileForm name={name} /></section>
      {admin ? (
        <>
          <AiSettings cfg={cfg} status={status} models={models} cli={localCliAllowed(actor)} />
          <section className="sect w-lg w-keys"><h2>API 키</h2>
            <p className="small muted w-m0">키는 이 Mac 의 .secrets/(git 제외)에 저장하고 다시 보여 주지 않아요. .env.local 에 값이 있으면 그 값을 먼저 써요.</p>
            {keys.map((k) => <KeyForm key={k.provider} {...k} />)}
          </section>
        </>
      ) : (
        <section className="sect w-lg"><h2>AI</h2><p className="small muted" style={{ margin: 0 }}>AI 연결은 운영자가 정해요. 지금 연결: {cfg.enabled.filter((v) => v === "anthropic" || v === "openai").join(", ") || "없음"} (함께 쓰는 계정은 API 키 연결만 써요). 내 Claude·ChatGPT 구독으로 쓰려면 <a href="/connect">AI 앱 연결</a>에서 연결해요.</p></section>
      )}
    </WideShell>
  );
}
