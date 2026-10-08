@AGENTS.md

# 카드뉴스 스튜디오 (card-studio)

인스타 카드뉴스·릴스를 기획→초안→검수→승인→게시까지 관리하는 로컬 도구. 시작은 `README.md`, 할 일은 `docs/ROADMAP.md`.

## 실행
- `pnpm setup:local` → `pnpm dev` (http://127.0.0.1:3200). 영상은 ffmpeg·ffprobe 필요.
- `python3 tests/slide_safe.py` — 칸 길이·글꼴·렌더러를 바꾸면 0이어야 한다.

## 구조 (규칙)
- 저장 `data/studio.json`(git 제외, 데모는 `data/studio.example.json`), 규칙은 `src/lib/ops.ts` 한 곳 — 화면(`src/app/actions.ts`)과 MCP(`src/lib/mcp.ts`)가 같이 쓴다.
- 칸 정의 하나(`src/lib/fields.ts`)로 검사·편집 화면·최대 길이 테스트. 템플릿 추가 = `templates/<id>.ts` + `render/<id>.tsx` + 두 index 등록 + `tests/slide_safe.py` TEMPLATES.
- 안전 영역(`render/kit.tsx` SAFE): 피드 (60,175)~(1020,1175), 표지 (175,175)~(905,1175), 릴스 (60,250)~(940,1540, 대략).
- 강조색은 채움으로만(그 위 글자는 onAccent). 도구 화면은 흑백만, 서비스 색은 카드 안에서만.
- 로그인 `src/lib/auth.ts`: 운영자(환경 변수) + 계정(이메일·scrypt) + 역할(소유자·편집자·검수자). 화면은 `requireWs`, API·action 은 `wsAccess`.
- MCP 는 토큰 주인 권한으로 돈다(`mcp.ts` GUARD). 토큰은 sha256 만 저장(`src/lib/tokens.ts`). OAuth 2.1(동적 등록·PKCE)은 `/oauth/*`.
- 단계(`src/lib/flow.ts`): 목적·자료 조사·주제·템플릿·제작(목록)·검수(골라서 ZIP) — 위 탭 상태와 '지금 할 일'. 발행·성과는 `LATER` 로 잠시 닫음(화면은 `LaterPage.tsx`). 화면 틀 `src/app/ui/Shell.tsx`.
- 주제는 review → approved(소유자·검수자) → 달력. 초안 → 승인은 승인 체크리스트(`DEFAULT_CHECKS` + 서비스 항목)를 모두 체크해야(`Post.review` 기록). 콘텐츠 규칙(`src/lib/rules.ts`)은 경고만.
- 성과 제안(`ops.insights`): 성과 적은 게시물 7편부터, 기둥 비중 ±10%p · 후속편 — 적용은 사람이.
- AI(`src/lib/llm.ts`): Claude Code·Codex(구독 — 운영자 본인·로컬만, 토큰을 받지 않음) · Anthropic·OpenAI API 키, 작업 등급별 모델. AI 패널은 MCP 도구로 일하고 `logActivity` 로 기록. 패널 Claude Code 는 `--tools ""`로 스튜디오 MCP 만 쓴다. 편집기 AI 초안은 `/api/ai/draft`(NDJSON)로 장마다 흘려 받아 흐린 칸 → 글 → 미리보기 순으로 보여 준다(`askStream`·`draftPostStream`). 사진은 `search_photos`(위키미디어 공용, 자유 라이선스).
- 상태는 `NEXT_STATUS` 길로만(초안→승인→게시, 게시는 인스타 링크 필수). 게시물은 지우지 않고 보관함으로.
- 일부러 없는 것: 삭제 도구, 인스타 업로드.

## 규칙
- 무료 사진은 주소+출처, 장소 이름이 나오면 그 장소의 실제 사진만, 브랜드 로고·제품 사진은 허락받은 것만, 협찬은 #광고.
- AI 가 만든 초안의 날짜·숫자·장소는 사람이 확인한 뒤 승인한다. AI 영상은 인스타 'AI 정보' 표시.
