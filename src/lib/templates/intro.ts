import type { Template } from "../fields";

// 소개 (모임·가게·서비스) — 표지(라벨·이름·한 줄) / 질문 답 / 이런 분께(줄) / 순위 목록 / 참여 방법
export const intro: Template = {
  id: "intro",
  name: "소개 카드",
  description: "모임·가게·서비스 하나를 여러 장으로 소개 (질문 답·이런 분께·순위·참여 방법)",
  maxSlides: 8,
  kinds: [
    { kind: "cover", label: "표지", fixed: true, fields: [
      { key: "photo", label: "사진", type: "photo", video: true, tune: ["y"] },
      { key: "label", label: "라벨 (강조)", type: "text", max: 20 },
      { key: "title", label: "이름", type: "text", max: 40, lines: 2 },
      { key: "sub", label: "한 줄 소개", type: "text", max: 70, lines: 3, optional: true },
    ], blank: () => ({ kind: "cover", photo: null, label: "", title: "", sub: "" }) },
    { kind: "qa", label: "질문", fields: [
      { key: "photo", label: "사진", type: "photo", video: true, tune: ["y"] },
      { key: "q", label: "질문", type: "text", max: 24 },
      { key: "a", label: "답", type: "text", max: 300, lines: 8 },
    ], blank: () => ({ kind: "qa", photo: null, q: "", a: "" }) },
    { kind: "rows", label: "이런 분께", light: true, fields: [
      { key: "small", label: "작은 제목", type: "text", max: 24 },
      { key: "big", label: "큰 제목", type: "text", max: 12 },
      { key: "rows", label: "줄", type: "items", min: 1, max: 5, item: [
        { key: "k", label: "이름", type: "text", max: 8 },
        { key: "v", label: "내용", type: "text", max: 44 },
        { key: "chips", label: "쉼표로 칩 나누기", type: "toggle" },
      ] },
    ], blank: () => ({ kind: "rows", small: "", big: "이런 분께 맞아요", rows: [{ k: "", v: "", chips: false }] }) },
    { kind: "ranked", label: "순위 목록", light: true, fields: [
      { key: "small", label: "작은 제목", type: "text", max: 24 },
      { key: "big", label: "큰 제목", type: "text", max: 12 },
      { key: "items", label: "항목", type: "items", min: 1, max: 5, item: [{ key: "t", label: "이름", type: "text", max: 20 }] },
      { key: "first", label: "1번 옆 표시", type: "text", max: 10, optional: true },
      { key: "note", label: "아래 한 줄", type: "text", max: 60, optional: true },
    ], blank: () => ({ kind: "ranked", small: "", big: "자주 가는 곳", items: [{ t: "" }], first: "대표", note: "" }) },
    { kind: "join", label: "참여 방법", fields: [
      { key: "photo", label: "사진", type: "photo", video: true, tune: ["y"] },
      { key: "line1", label: "첫 줄", type: "text", max: 30 },
      { key: "title", label: "이름", type: "text", max: 40, lines: 2 },
      { key: "pill1", label: "흰 버튼", type: "text", max: 24 },
      { key: "pill2", label: "강조 버튼", type: "text", max: 40 },
    ], blank: () => ({ kind: "join", photo: null, line1: "지금 함께할 분을 찾고 있어요", title: "", pill1: "", pill2: "" }) },
  ],
  draft: ({ title, category, handle }) => ({
    photos: [],
    caption: "",
    slides: [
      { kind: "cover", photo: null, label: category || "이번 주의 소개", title: title.slice(0, 40), sub: "" },
      { kind: "qa", photo: null, q: "어떤 곳인가요?", a: "소개를 적어 주세요." },
      { kind: "join", photo: null, line1: "지금 함께할 분을 찾고 있어요", title: title.slice(0, 40), pill1: "참여는 DM으로", pill2: `${handle}`.slice(0, 40) },
    ],
  }),
};
