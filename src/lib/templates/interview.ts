import type { Template } from "../fields";

// 인터뷰 카드 (사람 한 명 소개) — 표지(계정·소개·훅) / 질문 답 / 추천 목록(사진 선택) / 팔로우
export const interview: Template = {
  id: "interview",
  name: "인터뷰 카드",
  description: "사람 한 명을 질문 3개와 추천 목록으로 소개",
  maxSlides: 8,
  kinds: [
    { kind: "cover", label: "표지", fixed: true, fields: [
      { key: "photo", label: "사진", type: "photo", video: true, tune: ["y"] },
      { key: "tag", label: "계정", type: "text", max: 30 },
      { key: "sub", label: "작은 줄", type: "text", max: 20 },
      { key: "hook", label: "한 줄 소개 (크게)", type: "text", max: 40, lines: 2 },
    ], blank: () => ({ kind: "cover", photo: null, tag: "@", sub: "님을 소개해요", hook: "" }) },
    { kind: "qa", label: "질문", fields: [
      { key: "photo", label: "사진", type: "photo", video: true, tune: ["y"] },
      { key: "q", label: "질문", type: "text", max: 24 },
      { key: "a", label: "답", type: "text", max: 200, lines: 6 },
    ], blank: () => ({ kind: "qa", photo: null, q: "", a: "" }) },
    { kind: "picks", label: "추천 목록", light: true, fields: [
      { key: "small", label: "작은 제목", type: "text", max: 30 },
      { key: "big", label: "큰 제목", type: "text", max: 12 },
      { key: "items", label: "추천", type: "items", min: 1, max: 3, item: [
        { key: "photo", label: "사진", type: "photo" },
        { key: "name", label: "이름", type: "text", max: 18 },
        { key: "why", label: "이유", type: "text", max: 36, optional: true },
      ] },
    ], blank: () => ({ kind: "picks", small: "", big: "이걸 추천해요", items: [{ photo: null, name: "", why: "" }] }) },
    { kind: "follow", label: "팔로우", fields: [
      { key: "photo", label: "사진", type: "photo", video: true, tune: ["y"] },
      { key: "title", label: "계정", type: "text", max: 30 },
      { key: "line", label: "한 줄", type: "text", max: 24 },
      { key: "pill", label: "강조 버튼", type: "text", max: 30 },
    ], blank: () => ({ kind: "follow", photo: null, title: "@", line: "팔로우하고 같이 걸어요", pill: "소개받고 싶다면 프로필 링크에서" }) },
  ],
  draft: ({ title }) => ({
    photos: [],
    caption: "",
    slides: [
      { kind: "cover", photo: null, tag: "@", sub: "님을 소개해요", hook: title.slice(0, 40) },
      { kind: "qa", photo: null, q: "시작한 계기", a: "답을 적어 주세요" },
      { kind: "qa", photo: null, q: "가장 좋아하는 곳", a: "답을 적어 주세요" },
      { kind: "follow", photo: null, title: "@", line: "팔로우하고 같이 걸어요", pill: "소개받고 싶다면 프로필 링크에서" },
    ],
  }),
};
