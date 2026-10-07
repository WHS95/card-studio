import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="w-auth">
      <LoginForm next={typeof next === "string" ? next : ""} oauth={typeof next === "string" && next.startsWith("/oauth/")} />
    </main>
  );
}
