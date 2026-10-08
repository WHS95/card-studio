import type { Template } from "../fields";
import { ALIGN, BG_LD, HL, NUM, SIZE, choiceField } from "./common";

// 뉴스·매거진형 (요즘 많이 저장되는 정보 캐러셀): 표지(사진 가득 + 큰 제목) / 사진 위·글 아래 / 사진 가득 + 아래 글 / 글만 / 마무리.
// 사진 칸은 모두 영상도 된다. 장마다 배치·정렬·바탕·번호·출처·글 크기를 고른다.
export const news: Template = {
  id: "news",
  name: "뉴스형",
  group: "카드뉴스",
  inspired: "AI·테크 뉴스 계정, 스타트업 매거진 계정의 '사진 위·글 아래' 캐러셀",
  description: "사진(영상) 위·글 아래 기사형. 번호 원·출처·윗줄·굵게/강조, 20장까지",
  maxSlides: 20,
  kinds: [
    { kind: "cover", label: "표지", fixed: true, fields: [
      { key: "photo", label: "사진", type: "photo", video: true, tune: ["y"] },
      { key: "logo", label: "위 로고 그림 (선택, 워드마크 대신)", type: "photo" },
      { key: "kicker", label: "윗줄 (테두리 알약)", type: "text", max: 24, optional: true, hint: "예: AI TRENDS | CODE" },
      { key: "title", label: "제목", type: "text", max: 30, lines: 3, rich: true },
      { key: "sub", label: "작은 줄", type: "text", max: 40, optional: true },
      choiceField("pos", "제목 위치", [["bottom", "아래"], ["top", "위"]], "bottom"),
      SIZE, HL,
      { key: "brand", label: "워드마크 보이기", type: "toggle" },
    ], blank: () => ({ kind: "cover", photo: null, logo: null, kicker: "", title: "", sub: "", pos: "bottom", size: "m", brand: true }) },
    { kind: "split", label: "사진 위·글 아래", fields: [
      { key: "photo", label: "사진", type: "photo", video: true, tune: ["h", "y"] },
      choiceField("layout", "사진 배치", [["full", "꽉 차게"], ["inset", "안쪽 상자"]], "full"),
      { key: "source", label: "사진 출처 (작게)", type: "text", max: 30, optional: true, hint: "예: X / @account" },
      { key: "kicker", label: "윗줄", type: "text", max: 30, optional: true, hint: "예: AI NEWS | 브랜드 (| 로 나눔)" },
      { key: "title", label: "제목", type: "text", max: 32, lines: 2, rich: true },
      { key: "body", label: "본문", type: "text", max: 180, lines: 6, optional: true, rich: true },
      NUM, BG_LD, ALIGN, SIZE, HL,
    ], blank: () => ({ kind: "split", photo: null, layout: "full", source: "", kicker: "", title: "", body: "", num: true, bg: "light", align: "left", size: "m", hl: "fill" }) },
    { kind: "full", label: "사진 가득·아래 글", fields: [
      { key: "photo", label: "사진", type: "photo", video: true, tune: ["y"] },
      { key: "source", label: "사진 출처 (작게)", type: "text", max: 24, optional: true },
      { key: "title", label: "제목", type: "text", max: 24, lines: 2, rich: true },
      { key: "body", label: "본문", type: "text", max: 120, lines: 4, optional: true, rich: true },
      NUM, SIZE, HL,
    ], blank: () => ({ kind: "full", photo: null, source: "", title: "", body: "", num: true, size: "m", hl: "fill" }) },
    { kind: "text", label: "글만", fields: [
      { key: "kicker", label: "윗줄", type: "text", max: 30, optional: true },
      { key: "title", label: "제목", type: "text", max: 32, lines: 2, rich: true },
      { key: "body", label: "본문", type: "text", max: 260, lines: 10, optional: true, rich: true },
      BG_LD, ALIGN, SIZE, HL,
    ], blank: () => ({ kind: "text", kicker: "", title: "", body: "", bg: "light", align: "left", size: "m", hl: "fill" }) },
    { kind: "cta", label: "마무리", fields: [
      { key: "line", label: "첫 줄", type: "text", max: 30 },
      { key: "big", label: "큰 글", type: "text", max: 24, lines: 2, rich: true },
      { key: "pill", label: "강조 버튼", type: "text", max: 30 },
      BG_LD, HL,
    ], blank: () => ({ kind: "cta", line: "저장해 두고 꺼내 보세요", big: "", pill: "팔로우", bg: "dark", hl: "fill" }) },
  ],
  draft: ({ title, category, handle }) => ({
    photos: [],
    caption: "",
    slides: [
      { kind: "cover", photo: null, kicker: category.slice(0, 24), title: title.slice(0, 30), sub: "", pos: "bottom", size: "m", brand: true },
      { kind: "split", photo: null, layout: "full", source: "", kicker: category.slice(0, 30), title: "첫 번째 소식", body: "본문을 적어 주세요. **굵게**와 ==강조==를 쓸 수 있어요.", num: true, bg: "light", align: "left", size: "m", hl: "fill" },
      { kind: "cta", line: "저장해 두고 꺼내 보세요", big: `${handle || "팔로우"}`.slice(0, 24), pill: "팔로우", bg: "dark", hl: "fill" },
    ],
  }),
  sample: () => ({
    photos: [
      { url: "/samples/wave.jpg", credit: "샘플", source: "샘플", kind: "image" },
      { url: "/samples/grid.jpg", credit: "샘플", source: "샘플", kind: "image" },
      { url: "/samples/glow.jpg", credit: "샘플", source: "샘플", kind: "image" },
      { url: "/samples/clip.mp4", credit: "샘플", source: "샘플", kind: "video", poster: "/samples/clip0.jpg", duration: 8 },
    ],
    caption: "샘플 캡션이에요.",
    slides: [
      { kind: "cover", photo: 0, kicker: "WEEKLY | NEWS", title: "이번 주 알아 두면 좋은\n소식 ==5가지==", sub: "1분이면 다 읽어요", pos: "bottom", size: "m", brand: true },
      { kind: "split", photo: 1, layout: "full", source: "샘플 이미지", kicker: "NEWS | 브랜드", title: "누구나 쉽게 쓰는\n==새 기능==", body: "새 기능이 공개됐어요. **설정 한 번이면** 바로 쓸 수 있고,\n작업 시간이 크게 줄었다는 반응이에요.", num: true, bg: "light", align: "left", size: "m", hl: "text" },
      { kind: "split", photo: 2, layout: "inset", source: "", kicker: "", title: "기준은 세 가지예요", body: "1. **깊이 있는 실력**\n2. **적당함에 안주하지 않는 태도**\n3. **함께 일하는 마음**", num: false, bg: "light", align: "center", size: "m", hl: "fill" },
      { kind: "full", photo: 3, source: "@sample", title: "셀카 한 장 = 입장권", body: "사진 한 장 올리면 나랑 닮은 캐릭터가 뚝딱.\n**한마디 남기면** 꽃길로 입장해요.", num: true, size: "m", hl: "fill" },
      { kind: "text", kicker: "SUMMARY", title: "한 줄로 정리하면", body: "작게 시작해서 **꾸준히** 쌓는 것.\n\n==오늘 하나만== 해 보세요.", bg: "dark", align: "left", size: "l", hl: "fill" },
      { kind: "cta", line: "도움이 됐다면", big: "저장하고\n==팔로우==", pill: "프로필 링크에서 더 보기", bg: "dark", hl: "fill" },
    ],
  }),
};
