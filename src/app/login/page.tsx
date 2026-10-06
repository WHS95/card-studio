import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="wrap" style={{ maxWidth: 380, paddingTop: 80 }}>
      <b style={{ letterSpacing: 3 }}>카드뉴스 스튜디오</b>
      <h1 style={{ margin: 0 }}>로그인</h1>
      {typeof next === "string" && next.startsWith("/oauth/") && <p className="hint">AI 앱(Claude·ChatGPT) 연결을 위해 먼저 로그인해 주세요.</p>}
      <LoginForm next={typeof next === "string" ? next : ""} />
    </main>
  );
}
