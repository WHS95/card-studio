// 로컬 첫 준비: pnpm setup:local
//  1) .env.local 이 없으면 무작위 값으로 만든다 (운영자 비밀번호·MCP 토큰은 여기서 한 번만 보여 준다)
//  2) data/studio.json 이 없으면 데모 데이터(data/studio.example.json, 'STUDIO' 서비스)를 깐다
//  3) ffmpeg·ffprobe 가 있는지 알려 준다 (영상 장·릴스에 필요)
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const rnd = (n) => randomBytes(n).toString("base64url");
if (!existsSync(".env.local")) {
  const pw = rnd(12), token = rnd(24);
  writeFileSync(".env.local", [
    "# pnpm setup:local 이 만든 값 — 바꿔도 된다 (바꾸면 기존 로그인이 풀린다)",
    "STUDIO_ID=admin",
    `STUDIO_PASSWORD=${pw}`,
    `STUDIO_MCP_TOKEN=${token}`,
    `STUDIO_SESSION_SECRET=${rnd(32)}`,
    "# 선택: AI 연동은 화면(운영자 > AI 연동)에서 넣어도 된다",
    "# ANTHROPIC_API_KEY=",
    "# GEMINI_API_KEY=",
    "",
  ].join("\n"), { mode: 0o600 });
  console.log("✓ .env.local 을 만들었어요 — 지금 한 번만 보여요:");
  console.log(`  로그인 아이디 admin / 비밀번호 ${pw}`);
  console.log(`  운영자 MCP 토큰 ${token}`);
} else console.log("· .env.local 이 이미 있어요 (그대로 둠)");

mkdirSync("data", { recursive: true });
if (!existsSync("data/studio.json")) { copyFileSync("data/studio.example.json", "data/studio.json"); console.log("✓ 데모 데이터(STUDIO 서비스)를 깔았어요"); }
else console.log("· data/studio.json 이 이미 있어요 (그대로 둠)");

for (const bin of ["ffmpeg", "ffprobe"]) {
  try { execFileSync(bin, ["-version"], { stdio: "ignore" }); console.log(`✓ ${bin} 있음`); }
  catch { console.log(`! ${bin} 이 없어요 — 영상 장·릴스를 쓰려면 설치하세요 (macOS: brew install ffmpeg)`); }
}
console.log("\n다음: pnpm dev → http://127.0.0.1:3200");
