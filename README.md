# 카드뉴스 스튜디오 (card-studio)

인스타그램 카드뉴스(1080×1350 캐러셀)와 릴스(1080×1920)를 **6단계 — 목적 → 자료 조사 → 주제 → 템플릿 → 제작(목록) → 검수(골라서 ZIP 내려받기)** — 로 관리하는 로컬 도구. 발행·성과(플라이휠) 탭은 잠시 닫아 두었다(코드는 `LaterPage.tsx`).
이미 쓰는 **Claude·ChatGPT 구독**을 그대로 연결해, AI 에게 아이디어·자료 조사·초안을 시킬 수 있다 (API 키 없이).

- 서비스(브랜드)마다 브리프·콘텐츠 기둥·콘텐츠 규칙·승인 체크리스트·테마 색·발행 시간대
- 단계 탭마다 상태와 '지금 할 일', 주제는 검수 대기 → 승인 → 달력, 게시물은 체크리스트를 모두 체크해야 승인
- 자료 조사 신뢰도, 성과 적을 차례(게시 7일 뒤)와 다음 기획 제안(기둥 비중·후속편 — 적용은 사람이)
- 오른쪽 AI 패널: 스튜디오 도구로 실제로 일하는 대화, AI·MCP 가 한 일은 작업 기록 카드
- 템플릿 6종: 매거진 · 소개 · 인터뷰 · 뉴스형 · 포스터형 · 릴스 자막형 — 장마다 배치·정렬·바탕·글 크기 조절, `**굵게**`·`==강조==`
- 인스타 안전 영역(그리드 3:4 잘림·UI 가림) 겹쳐 보기와 픽셀 단위 마진 검사
- 영상 장(ffmpeg 합성), 캐러셀 → 릴스 MP4, 선택: Google Veo AI 영상
- 계정·역할(소유자·편집자·검수자), 성과 기록, JSON 백업
- MCP 서버 내장 — Claude Code · Claude Desktop · Codex 가 이 스튜디오를 도구로 쓴다

## 빠른 시작

```bash
pnpm install
pnpm setup:local   # .env.local(무작위 비밀번호·토큰)과 데모 데이터를 만든다 — 비밀번호는 이때 한 번만 보여 준다
pnpm dev           # http://127.0.0.1:3200 (이 컴퓨터에서만 열린다)
```

- Node.js 20+, pnpm 10
- 영상 장·릴스를 쓰려면 ffmpeg·ffprobe (`brew install ffmpeg`). 다른 경로면 `FFMPEG_PATH`·`FFPROBE_PATH`.

## 내 Claude·ChatGPT 구독으로 쓰기

로그인 → 왼쪽 메뉴 **AI 앱 연결**에서 개인 토큰을 만들면, 아래 설정이 토큰이 채워진 채로 나온다.

| 앱 | 구독 | 연결 |
|---|---|---|
| Claude Code | Claude Pro·Max | `claude mcp add --scope user --transport http card-studio http://127.0.0.1:3200/api/mcp --header "Authorization: Bearer <토큰>"` |
| Claude Desktop | Claude | `claude_desktop_config.json` 에 `npx mcp-remote <주소> --header Authorization:${AUTH}` (화면에서 복사) |
| Codex CLI | ChatGPT 로그인 | `codex mcp add card-studio --url <주소> --bearer-token-env-var CARD_STUDIO_TOKEN` |

그다음 그 앱에서 "card-studio 에서 ○○ 서비스 브리프를 읽고 아이디어 10개 넣어 줘", "이 게시물 초안 써 줘"처럼 시키면 된다.
AI 는 토큰 주인의 역할 안에서만 일한다(지우기·인스타 업로드 도구는 없다).

- **배포하면** claude.ai·ChatGPT 웹 커넥터도 붙는다. 이 앱이 OAuth 2.1 인가 서버(동적 등록 + PKCE)를 내장하고 있다.
- 구독 로그인 토큰을 이 서버가 받아 모델을 부르는 방식은 Anthropic·OpenAI 정책상 쓰지 않는다.

## 화면 안 AI (선택) — 설정 · AI

- 연결: 이 컴퓨터에 설치·로그인된 **Claude Code**·**Codex**(구독) · **Anthropic**·**OpenAI** API 키. 여러 개를 켜 두고 작업 등급(판단·쓰기·다듬기)마다 연결·모델·노력을 고른다.
- 구독 연결은 **운영자 본인이 이 컴퓨터에서 쓸 때만** 켜진다. 스튜디오는 로그인 토큰을 받지 않고 CLI 를 실행만 한다. 함께 쓰는 계정·MCP 요청·배포한 서버에서는 API 키 연결을 쓴다(구독은 본인 사용만 — Anthropic·OpenAI 정책).
- Gemini 키를 넣으면 Veo AI 영상. 키는 `.secrets/`(git 제외)에 저장된다.

## 검사

```bash
pnpm exec tsc --noEmit && pnpm lint
python3 tests/slide_safe.py   # 안전 영역 검사 (dev 서버·Pillow 필요). 템플릿 × 서비스 × 최대 길이를 그려 밖 픽셀 0 확인
```

## 구조

- 저장: `data/studio.json` 하나(`src/lib/store.ts`). 규칙은 `src/lib/ops.ts` 한 곳(화면·MCP 공용).
- 칸 정의 하나로 검사·편집 화면·최대 길이 테스트를 만든다(`src/lib/fields.ts`, `src/lib/templates/`).
- 렌더: `next/og`(satori) + 정적 TTF(`assets/`, Noto Sans KR — SIL OFL 1.1, `assets/OFL.txt`).
- MCP: `POST /api/mcp`(Streamable HTTP). OAuth: `/.well-known/*`, `/oauth/*`.
- 로드맵: `docs/ROADMAP.md`, 바뀐 것: `CHANGELOG.md`.

## 라이선스

아직 정하지 않았다 — 정하기 전까지 저작권은 저자에게 있다. 글꼴은 SIL Open Font License 1.1.
