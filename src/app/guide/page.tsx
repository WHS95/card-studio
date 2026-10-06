import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { TEMPLATES } from "@/lib/templates";
import { CAPTION_MAX, PHOTOS_MAX, VIDEO_DUR } from "@/lib/fields";
import Top from "../Top";

// 사용 가이드: 처음 쓰는 운영자가 순서대로 따라 하면 첫 게시물까지 가게. 화면이 바뀌면 여기도 같이 고친다.

const STEPS: [string, string, string][] = [
  ["서비스 만들기", "서비스 목록에서 이름·주소용 영문·업종을 정해요. 업종을 고르면 콘텐츠 기둥·말투·해시태그 시작값이 채워져요.", "/"],
  ["브리프 쓰기", "무엇을 하는 서비스인지, 누구에게, 어떤 말투로. 꼭 넣을 말·쓰지 않을 말·기본 해시태그·CTA도 여기서 정해요.", "brief"],
  ["기둥 정하기", "꾸준히 다룰 주제 3~5개와 비중(합 100%). 기둥 이름이 달력 카테고리가 돼요.", "brief"],
  ["자료 조사", "숫자·사실은 출처 주소와 함께 모아요. AI(키가 있을 때)나 Claude Code(MCP)로 웹 조사를 맡길 수 있어요.", "research"],
  ["아이디어 모으기", "기둥 예시를 눌러 꺼내거나 직접 적어요. 자료를 연결하면 게시물 메모에 출처가 붙어요.", "ideas"],
  ["달력에 넣기", "아이디어 → '달력에 넣기'. 빈 칸에 기획 게시물이 생기고 편집기로 가요.", "ideas"],
  ["템플릿·초안", "형태(뉴스형·포스터형·릴스 등)를 고르고 장마다 글·사진·배치를 채워요. AI 초안도 있어요.", "/templates"],
  ["검수", "가려지는 영역 겹쳐 보기 + 마진 계산(장별 ✓). 크게 보기로 인스타 피드처럼 넘겨 봐요.", ""],
  ["승인 → 게시", "사람이 보고 승인. 인스타에는 직접 올리고, 올린 링크를 붙여 '게시 표시'해요.", ""],
];

const FAQ: [string, string][] = [
  ["**굵게**, ==강조==는 어떻게 보여요?", "별 두 개로 감싼 말은 굵게, 등호 두 개로 감싼 말은 강조예요. 장마다 '강조 표시'에서 강조색 채움(브랜드 기본)과 강조색 글자 중 골라요."],
  ["글이 넘치면?", "새 템플릿(뉴스형·포스터형·릴스)은 글이 많으면 글 크기를 줄이고, 그래도 넘치면 사진 높이를 줄여요. 그래도 마진 계산에 '밖 n'이 뜨면 글을 줄여 주세요."],
  ["영상은 어떻게 넣어요?", `편집기 '직접 올리기'로 MP4·MOV를 올리고, 영상 가능한 사진 칸에서 골라요. 캐러셀 한 장은 ${VIDEO_DUR.min}~${VIDEO_DUR.max}초, 릴스는 90초까지. 영상 장은 MP4로 내려받아요.`],
  ["릴스 자막 시간은?", "릴스 자막형의 '자막' 항목마다 시작 초를 적어요. 다음 자막의 시작 초까지 보이고, 영상으로 합칠 때 그대로 들어가요."],
  ["무료 사진은?", "이미지 주소로만 쓰고 출처를 적어요(캡션 복사 때 자동으로 붙어요). 장소 이름이 나오면 그 장소의 실제 사진만. 브랜드 로고·제품 사진은 허락받은 것만."],
  ["샘플 그림이 들어간 채로 올려도 돼요?", "아니요. '샘플로 시작'의 그림은 자리 표시용 추상 그림이에요. 실제 사진으로 바꿔 주세요."],
  ["협찬 게시물은?", "캡션에 #광고를 꼭 넣어요."],
  ["여러 사람이 같이 쓰려면?", "서비스 소유자가 '함께 쓰기'에서 이메일과 역할을 정해 더해요. 편집자는 만들고 고치기, 검수자는 보고 승인·게시 표시만 해요. 처음 더하는 사람에게는 임시 비밀번호가 한 번 보이니 직접 전해 주세요."],
  ["요금제 한도는?", "무료는 함께 쓰는 사람 2명·AI 한 달 20번·서비스 1개. 결제 연결 전이라 요금제는 운영자가 바꿔요 (요금제 화면 참고)."],
  ["AI 영상은 어떻게 만들어요?", "운영자가 'AI 연동'에서 Gemini 키를 넣으면, 편집기 사진·영상의 'AI 영상 만들기(Google Veo)'에서 만드는 방식(글로만 · 첫 장면 사진 · 처음·끝 사진 · 참고 사진 · 이어 붙이기)을 골라 4·6·8초 영상을 만들어요(1~3분). 처음·끝 / 참고 사진 / 이어 붙이기는 Fast·기본 모델, 8초만 돼요. 다 되면 사진·영상에 더해지고, 영상 가능한 칸에서 골라 써요. 출처에 'AI 생성'이 붙고, 인스타에 올릴 땐 'AI 정보' 표시를 켜요."],
  ["Claude·ChatGPT 구독으로 쓸 수 있어요?", "네. '내 계정 › AI 앱 연결'의 연결 주소를 Claude(설정 › 커넥터) 또는 ChatGPT(개발자 모드 앱)에 더하고 로그인·동의하면, 그 대화에서 이 스튜디오를 시킬 수 있어요. AI 사용료는 내 구독에서 나가요. 이 Mac 주소(127.0.0.1)는 바깥에서 안 닿아서 배포·터널 주소가 필요해요."],
  ["AI 키가 없어요", "Claude Code 에 연결된 MCP(card-studio)로 같은 일을 해요: 브리프 읽기 → 자료 조사 → 아이디어 → 초안 → 마진 확인. 승인은 늘 사람이 해요."],
];

export default async function Guide() {
  await requireAuth();
  const groups = [...new Set(TEMPLATES.map((t) => t.group ?? "카드뉴스"))];
  return (
    <>
      <Top />
      <main className="wrap" style={{ maxWidth: 960 }}>
        <h1 style={{ margin: 0 }}>사용 가이드</h1>
        <p className="small muted" style={{ margin: 0 }}>처음이라면 위에서부터 순서대로. 각 서비스 달력 위에도 &apos;시작하기&apos; 체크리스트가 떠요.</p>

        <section className="block" id="start">
          <strong>처음 게시물까지 9단계</strong>
          <ol className="guide-steps">
            {STEPS.map(([h, d, to], i) => (
              <li key={i}><b>{h}</b> — {d}{to.startsWith("/") && <> <Link href={to} className="small">열기 →</Link></>}{to && !to.startsWith("/") && <span className="small muted"> (서비스 안 &apos;{to === "brief" ? "브리프" : to === "ideas" ? "아이디어" : "자료 조사"}&apos; 탭)</span>}</li>
            ))}
          </ol>
        </section>

        <section className="block" id="templates">
          <strong>템플릿 고르기</strong>
          <table className="plain">
            <thead><tr><th>템플릿</th><th>이럴 때</th><th>판</th></tr></thead>
            <tbody>{groups.flatMap((g) => TEMPLATES.filter((t) => (t.group ?? "카드뉴스") === g).map((t) => (
              <tr key={t.id}><td><Link href={`/templates#${t.id}`}><b>{t.name}</b></Link><br /><span className="muted">{g}</span></td><td>{t.description}</td><td>{t.format === "reel" ? "9:16" : "4:5"} · {t.maxSlides}장</td></tr>
            )))}</tbody>
          </table>
          <p className="small muted" style={{ margin: 0 }}>장마다 &apos;조절&apos; 칸(배치·정렬·바탕·번호·글 크기·강조 표시)으로 같은 템플릿 안에서 모양을 바꿔요.</p>
        </section>

        <section className="block" id="editor">
          <strong>편집기 단축키·규칙</strong>
          <ul className="guide-list">
            <li>⌘S 저장 · ⌘Z 되돌리기 · ⇧⌘Z 다시 (입력 칸 안에서는 브라우저 기본)</li>
            <li>저장 안 된 고침이 있으면 상태 버튼이 꺼져요 — 화면과 다른 버전이 승인되지 않게.</li>
            <li>승인된 게시물 글을 고치면 다시 초안이 돼요. 게시된 것은 게시 취소 뒤 고쳐요.</li>
            <li>캡션 {CAPTION_MAX}자 · 해시태그 30개 · 사진·영상 {PHOTOS_MAX}개까지. &apos;기본 해시태그 넣기&apos;는 브리프 값을 써요.</li>
            <li>겹쳐 보기: 그리드 3:4 잘림 · 안전 영역 · 인스타 UI(대략). 릴스는 위 머리글·오른쪽 버튼·아래 캡션 자리.</li>
          </ul>
        </section>

        <section className="block" id="faq">
          <strong>자주 묻는 것</strong>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p className="small" style={{ margin: "6px 0 0" }}>{a}</p></details>)}
        </section>
      </main>
    </>
  );
}
