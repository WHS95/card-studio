import type { Template } from "../fields";
import { ALIGN, BG_POSTER, HL, SIZE, choiceField } from "./common";

// 포스터형 (러닝·이벤트 브랜드 계정의 종이 질감 캐러셀): 테이프 제목 + 강조 낱말 + 굵은 줄 + 옆 그림 / 번호 붙은 리워드 목록.
export const poster: Template = {
  id: "poster",
  name: "포스터형",
  group: "카드뉴스",
  inspired: "러닝·이벤트 브랜드 계정의 종이 바탕 + 테이프 제목 캐러셀",
  description: "종이 바탕, 기운 테이프 제목, 강조 낱말, 옆 그림, (01)(02) 리워드 목록",
  maxSlides: 10,
  kinds: [
    { kind: "cover", label: "표지", fixed: true, fields: [
      { key: "top", label: "윗줄", type: "text", max: 30, optional: true, rich: true },
      { key: "tape", label: "테이프 제목", type: "text", max: 12 },
      { key: "title", label: "큰 글", type: "text", max: 30, lines: 2, rich: true },
      { key: "photo", label: "가운데 그림", type: "photo", video: true, tune: ["y"] },
      { key: "bottom", label: "아랫줄", type: "text", max: 40, lines: 2, optional: true, rich: true },
      BG_POSTER, HL,
    ], blank: () => ({ kind: "cover", top: "", tape: "", title: "", photo: null, bottom: "", bg: "paper", hl: "text" }) },
    { kind: "point", label: "설명", fields: [
      { key: "tape", label: "테이프 제목", type: "text", max: 12 },
      { key: "head", label: "제목", type: "text", max: 30, lines: 2, rich: true },
      { key: "body", label: "본문", type: "text", max: 200, lines: 9, optional: true, rich: true, hint: "빈 줄로 문단을 나눠요" },
      { key: "photo", label: "그림", type: "photo", video: true, tune: ["y"] },
      choiceField("img", "그림 자리", [["right", "오른쪽"], ["bottom", "아래"]], "right"),
      { key: "slogan", label: "맺음 한 줄 (굵게)", type: "text", max: 30, optional: true },
      BG_POSTER, SIZE, HL,
    ], blank: () => ({ kind: "point", tape: "", head: "", body: "", photo: null, img: "right", slogan: "", bg: "paper", size: "m", hl: "text" }) },
    { kind: "items", label: "리워드 목록", fields: [
      { key: "top", label: "윗줄", type: "text", max: 30, optional: true, rich: true },
      { key: "tape", label: "테이프 제목", type: "text", max: 12 },
      { key: "items", label: "항목", type: "items", min: 2, max: 5, item: [
        { key: "label", label: "이름", type: "text", max: 16 },
        { key: "sub", label: "작은 설명", type: "text", max: 20, optional: true },
        { key: "photo", label: "그림", type: "photo" },
      ] },
      { key: "bottom", label: "아랫줄", type: "text", max: 40, lines: 2, optional: true, rich: true },
      BG_POSTER, HL,
    ], blank: () => ({ kind: "items", top: "", tape: "", items: [{ label: "", sub: "", photo: null }, { label: "", sub: "", photo: null }], bottom: "", bg: "paper", hl: "text" }) },
    { kind: "cta", label: "마무리", fields: [
      { key: "tape", label: "테이프 제목", type: "text", max: 12 },
      { key: "big", label: "큰 글", type: "text", max: 30, lines: 2, rich: true },
      { key: "pill", label: "강조 버튼", type: "text", max: 30 },
      BG_POSTER, ALIGN, HL,
    ], blank: () => ({ kind: "cta", tape: "지금 참여", big: "", pill: "프로필 링크", bg: "paper", align: "center", hl: "text" }) },
  ],
  draft: ({ title, category }) => ({
    photos: [],
    caption: "",
    slides: [
      { kind: "cover", top: category.slice(0, 30), tape: title.slice(0, 12), title: "", photo: null, bottom: "", bg: "paper", hl: "text" },
      { kind: "point", tape: "핵심", head: title.slice(0, 30), body: "본문을 적어 주세요.\n\n**굵게** 쓰고 싶은 줄은 별 두 개로 감싸요.", photo: null, img: "right", slogan: "", bg: "paper", size: "m", hl: "text" },
      { kind: "cta", tape: "지금 참여", big: "프로필 링크에서\n==신청==하세요", pill: "프로필 링크", bg: "paper", align: "center", hl: "text" },
    ],
  }),
  sample: () => ({
    photos: [
      { url: "/samples/paper-shape.jpg", credit: "샘플", source: "샘플", kind: "image" },
      { url: "/samples/glow.jpg", credit: "샘플", source: "샘플", kind: "image" },
      { url: "/samples/grid.jpg", credit: "샘플", source: "샘플", kind: "image" },
    ],
    caption: "샘플 캡션이에요.",
    slides: [
      { kind: "cover", top: "==10월 한 달== 함께 하는", tape: "챌린지 오픈", title: "나만의 기준으로\n끝까지 해 보기", photo: 0, bottom: "**지금 신청**하면 기록증을 드려요", bg: "paper", hl: "text" },
      { kind: "point", tape: "완주의 기준,", head: "꼭 ==42.195km==일 필요 있나요?", body: "5K도 좋고, 10K도 좋아요.\n이번 챌린지에서는\n**내가 직접 결승선을 정합니다.**\n\n거리보다 중요한 건\n**내가 정한 거리를\n끝까지 해 보는 것.**", photo: 0, img: "right", slogan: "RUN YOUR LIFE", bg: "paper", size: "m", hl: "text" },
      { kind: "items", top: "==완주한 분 모두== 받을 수 있는", tape: "완주 리워드", items: [{ label: "모바일 기록증", sub: "앱으로 보내드려요", photo: 1 }, { label: "할인 쿠폰", sub: "5,000원", photo: 2 }, { label: "완주 키링", sub: "선착순", photo: 0 }], bottom: "**못 와도, 완주는 완주니까!**", bg: "paper", hl: "text" },
      { kind: "cta", tape: "지금 참여", big: "프로필 링크에서\n==신청==하세요", pill: "프로필 링크", bg: "paper", align: "center", hl: "fill" },
    ],
  }),
};
