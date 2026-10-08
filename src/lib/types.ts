// 카드뉴스 스튜디오의 기본 모양. 서비스(워크스페이스)마다 테마·카테고리·시간대가 있고, 게시물은 템플릿 + 장 데이터.

/** 브랜드 테마. 강조색은 채움으로만 쓰고(그 위 글자는 onAccent), 글자색으로 쓰는 건 워드마크뿐 */
export type Theme = {
  dark: string; // 어두운 바탕
  light: string; // 밝은 바탕·어두운 바탕 위 글자
  ink: string; // 밝은 바탕 위 글자
  muted: string; // 보조 글자
  accent: string; // 채움 전용
  onAccent: string; // 강조색 위 글자
  wordmark: { text: string; color: string; bg: string };
  font: { regular: string; bold: string }; // assets/ 안 정적 TTF (satori 는 가변 글꼴을 못 쓴다)
};

export type Workspace = {
  id: string;
  name: string;
  handle: string; // 인스타 계정 (예: @account)
  theme: Theme;
  categories: string[];
  slots: string[]; // 하루 시간대 (예: 07:30)
  days: number; // 달력 일수
  startDate: string | null; // 1일차 (YYYY-MM-DD)
  defaultTemplate: string;
  brief?: Brief; // 없으면 emptyBrief() (예전 저장본)
  pillars?: Pillar[];
  members?: Member[]; // 계정별 역할 (환경 변수 운영자는 늘 모든 권한)
  plan?: PlanId; // 없으면 free
  usage?: { month: string; ai: number; video?: number }; // 이번 달 AI 글 호출 수 · AI 영상 수 (YYYY-MM)
  metricsDays?: number; // 게시하고 며칠 뒤 '성과 적을 차례'에 띄울지 (없으면 7)
  dismissed?: string[]; // 성과 화면에서 '넘기기' 한 제안 (제안 키)
};

// ── 계정 · 역할 · 요금제 ──
export const ROLES = ["owner", "editor", "reviewer"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = { owner: "소유자", editor: "편집자", reviewer: "검수자" };
export type Member = { userId: string; role: Role; addedAt: string };
/** 로그인 계정. pass = scrypt$salt$hash (평문은 저장하지 않는다) */
export type User = { id: string; email: string; name: string; pass: string; createdAt: string };
export type PlanId = "free" | "pro" | "agency";

/** AI 앱 연결 토큰. userId "admin" = 환경 변수 운영자. hash = sha256(토큰) — 토큰 자체는 저장하지 않는다 */
export type ApiToken = {
  id: string; userId: string; name: string; hash: string; kind: "pat" | "oauth";
  clientId?: string; refreshHash?: string; createdAt: string; expiresAt?: string; lastUsedAt?: string;
};
/** OAuth 로 붙는 앱 (Claude·ChatGPT 커넥터가 동적 등록) */
export type OAuthClient = { id: string; name: string; redirectUris: string[]; createdAt: string };

/** 사진 또는 영상. 영상은 직접 올린 것만(/uploads/…mp4) — poster 는 첫 장면 JPG(미리보기·satori 용), duration 초 */
export type Photo = { url: string; credit: string; source: string; kind?: "image" | "video"; poster?: string; duration?: number };
export type SlideData = { kind: string } & Record<string, unknown>;
export type PostData = { slides: SlideData[]; caption: string; photos: Photo[] };

export const POST_STATUS = ["plan", "draft", "approved", "posted", "skip"] as const;
export type PostStatus = (typeof POST_STATUS)[number];
/** 상태는 정해진 길로만: 초안 → 승인 → 게시(링크). 건너뛴 기획은 다시 기획으로 */
export const NEXT_STATUS: Record<PostStatus, PostStatus[]> = { plan: ["skip"], draft: ["approved", "skip"], approved: ["posted", "draft", "skip"], posted: ["approved"], skip: ["draft"] };
export const STATUS_LABEL: Record<PostStatus, string> = { plan: "기획", draft: "초안", approved: "승인", posted: "게시", skip: "건너뜀" };

export type Post = {
  id: string;
  workspace: string;
  day: number;
  slot: string;
  template: string;
  category: string;
  title: string; // 기획 제목
  note: string; // 형식·출처 등 메모
  status: PostStatus;
  data: PostData | null;
  postedUrl: string;
  source?: string; // 가져온 곳 (예: hh:<id>) — 다시 가져올 때 같은 줄을 덮어쓴다
  archivedAt?: string; // 보관함으로 뺀 때 (달력 칸에서 빠지고 칸이 빈다, 되살릴 수 있다)
  metrics?: Metrics; // 게시 뒤 인스타 인사이트에서 옮겨 적는 성과
  review?: Review; // 승인할 때 체크한 기록 (승인 뒤 글을 고치면 지워진다)
  postedAt?: string; // 게시로 표시한 때 (성과 적을 차례 계산)
  updatedAt: string;
};

/** 승인 체크 기록: 누가 · 언제 · 무엇을 체크했나 (체크리스트 문구 그대로) */
export type Review = { by: string; at: string; checks: string[] };

/** 게시 성과 (사람이 인사이트를 보고 적는다). 저장률 = saves / reach */
export type Metrics = { reach: number; likes: number; comments: number; saves: number; shares: number; follows: number; at: string };
export const METRIC_LABEL: Record<Exclude<keyof Metrics, "at">, string> = { reach: "도달", likes: "좋아요", comments: "댓글", saves: "저장", shares: "공유", follows: "팔로우" };

/** 서비스 브리프: 무엇을 하는 서비스인지·누구에게·어떤 말투로. 초안·캡션·자료 조사(AI·MCP)의 바탕 */
export type Brief = {
  industry: string; // 업종 (presets.ts 의 id 또는 직접 적은 말)
  about: string; // 한 줄 소개
  audience: string; // 누구에게
  goals: string[]; // 목표 (팔로워·가입·판매·방문·인지)
  tone: string; // 말투
  keywords: string[]; // 꼭 넣을 말
  banned: string[]; // 쓰지 않을 말
  hashtags: string[]; // 기본 해시태그 (# 포함)
  cta: string; // 기본 행동 유도
  link: string; // 프로필 링크
  references: string[]; // 참고·경쟁 계정
  rules?: ContentRules; // 콘텐츠 규칙 (어기면 편집기에 경고, 저장은 된다)
  checklist?: string[]; // 승인 체크리스트에 서비스가 더한 항목 (기본 항목은 DEFAULT_CHECKS)
};
/** 콘텐츠 규칙: 자동으로 알 수 있는 것만 (경고만, 막지 않는다) */
export type ContentRules = { photoEvery: boolean; templateOnly: boolean; coverQuestion: boolean; ctaComment: boolean };
export const NO_RULES: ContentRules = { photoEvery: false, templateOnly: false, coverQuestion: false, ctaComment: false };
export const RULE_LABEL: Record<keyof ContentRules, { label: string; note: string }> = {
  photoEvery: { label: "모든 장에 사진·영상", note: "사진 칸이 비었거나, 사진 칸이 없는 장을 쓰면 경고" },
  templateOnly: { label: "정한 틀만 쓰기", note: "서비스 기본 틀과 다른 템플릿이면 경고" },
  coverQuestion: { label: "표지는 질문형", note: "표지 제목이 '?'로 끝나지 않으면 경고" },
  ctaComment: { label: "마지막 장 댓글 유도", note: "마지막 장 글에 '댓글'이 없으면 경고" },
};
/** 승인 체크리스트 기본 항목 (모든 서비스 공통, 뺄 수 없다) */
export const DEFAULT_CHECKS = [
  "숫자·사실마다 자료 조사에 출처가 있어요",
  "장소 이름이 나오면 실제 그 장소 사진이에요",
  "브랜드 로고·제품은 허락받은 것만 보여요",
  "쓰지 않는 말(브리프 금지어)이 없어요",
  "협찬이면 #광고를 붙였어요 (협찬이 아니면 체크)",
] as const;
export const CHECKS_MAX = 10;
/** 콘텐츠 기둥: 이 서비스에서 꾸준히 다룰 주제 묶음. 이름은 달력 카테고리와 같다 */
export type Pillar = { name: string; description: string; share: number; template: string; examples: string[] };

/** 주제(아이디어) 상태: 누가 냈든 검수 대기 → 소유자·검수자가 승인 → 달력에 넣음. 보류는 언제든 */
export const IDEA_STATUS = ["review", "approved", "planned", "dropped"] as const;
export type IdeaStatus = (typeof IDEA_STATUS)[number];
export const IDEA_LABEL: Record<IdeaStatus, string> = { review: "검수 대기", approved: "승인", planned: "제작에 넣음", dropped: "보류" };
/** 아이디어 보관함: 주제 하나. 승인한 것만 달력 칸에 넣을 수 있고, 넣으면 기획 게시물이 되고 postId 가 붙는다 */
export type Idea = {
  id: string;
  workspace: string;
  title: string;
  pillar: string; // 기둥 이름 (없으면 "")
  angle: string; // 어떤 각도로·메모
  template: string;
  status: IdeaStatus;
  research: string[]; // 자료 id
  postId?: string;
  approvedBy?: string; // 승인한 사람 이름
  approvedAt?: string;
  by: "user" | "ai" | "mcp";
  createdAt: string;
  updatedAt: string;
};
/** 자료 조사: 출처 주소 + 요약 + 메모. 게시물 근거·사실 확인용 */
export type Research = {
  id: string;
  workspace: string;
  title: string;
  url: string; // https 또는 ""
  summary: string;
  memo: string;
  tags: string[];
  confidence?: Confidence; // 없으면 보통
  by: "user" | "ai" | "mcp";
  createdAt: string;
};
/** 자료 신뢰도: 높음 = 공식·학술 원문 확인 · 보통 = 2차 요약·블로그 · 확인 필요 = 원문 대조 전 (승인 체크에 표시) */
export const CONFIDENCE = ["high", "medium", "check"] as const;
export type Confidence = (typeof CONFIDENCE)[number];
export const CONF_LABEL: Record<Confidence, string> = { high: "높음", medium: "보통", check: "확인 필요" };

/** AI·MCP 가 한 일 (AI 패널의 카드). 서비스마다 최근 것만 남긴다 */
export type Activity = { id: string; workspace: string; at: string; via: "ai" | "mcp"; who: string; tool: string; title: string; lines: string[]; ok: boolean };

/** 계정마다의 화면 설정 (운영자는 "admin") */
export type Prefs = { favorites: string[]; displayName?: string };

// ── AI 연결 · 작업별 모델 ──
/** 연결: 이 Mac 의 Claude Code·Codex(구독, 운영자 본인만) · API 키 */
export const AI_VIA = ["claude-code", "codex", "anthropic", "openai"] as const;
export type AiVia = (typeof AI_VIA)[number];
export const VIA_LABEL: Record<AiVia, string> = { "claude-code": "Claude Code (구독)", codex: "Codex (구독)", anthropic: "Anthropic API", openai: "OpenAI API" };
export const AI_TIERS = ["judge", "write", "polish"] as const;
export type AiTier = (typeof AI_TIERS)[number];
export const TIER_LABEL: Record<AiTier, { name: string; note: string; jobs: string[] }> = {
  judge: { name: "판단", note: "틀리면 게시물이 틀어지는 작업", jobs: ["주제 제안·검수 도움", "사실 확인(자료 대조)", "성과 제안", "AI 패널 대화"] },
  write: { name: "쓰기", note: "브리프·자료를 바탕으로 글을 채우는 작업", jobs: ["초안 쓰기", "캡션", "자료 요약·웹 조사"] },
  polish: { name: "다듬기", note: "글자 수·말투를 맞추는 작은 작업", jobs: ["글자 수 맞추기", "해시태그", "말투 고치기"] },
};
export type Effort = "high" | "medium" | "low";
export type TierSetting = { via: AiVia; model: string; effort: Effort };
export type AiConfig = { enabled: AiVia[]; tiers: Record<AiTier, TierSetting> };
