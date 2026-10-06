import type { Template } from "../fields";

// 매거진 (ai.trend.kr 형) — 표지 사진 + 카테고리 + 두 줄 제목 / 설명(번호·소제목·본문, 사진 선택) / 목록 / 마무리
export const magazine: Template = {
  id: "magazine",
  name: "매거진",
  description: "정보·팁·소식. 표지 사진 + 큰 제목, 안쪽은 번호 설명과 목록",
  maxSlides: 10,
  kinds: [
    { kind: "cover", label: "표지", fixed: true, fields: [
      { key: "photo", label: "사진", type: "photo", video: true, tune: ["y"] },
      { key: "category", label: "카테고리 (강조)", type: "text", max: 14 },
      { key: "title", label: "제목", type: "text", max: 24, lines: 2 },
    ], blank: () => ({ kind: "cover", photo: null, category: "", title: "" }) },
    { kind: "point", label: "설명", fields: [
      { key: "photo", label: "사진", type: "photo", video: true, tune: ["h", "y"] },
      { key: "heading", label: "소제목", type: "text", max: 22, lines: 2 },
      { key: "body", label: "본문", type: "text", max: 150, lines: 6, optional: true },
    ], blank: () => ({ kind: "point", photo: null, heading: "", body: "" }) },
    { kind: "list", label: "목록", light: true, fields: [
      { key: "heading", label: "목록 제목", type: "text", max: 22 },
      { key: "items", label: "항목", type: "items", min: 1, max: 5, item: [
        { key: "t", label: "항목", type: "text", max: 18 },
        { key: "d", label: "설명", type: "text", max: 36, optional: true },
      ] },
    ], blank: () => ({ kind: "list", heading: "", items: [{ t: "", d: "" }] }) },
    { kind: "cta", label: "마무리", fields: [
      { key: "line", label: "첫 줄", type: "text", max: 30 },
      { key: "big", label: "큰 글", type: "text", max: 24, lines: 2 },
      { key: "pill", label: "강조 버튼", type: "text", max: 30 },
    ], blank: () => ({ kind: "cta", line: "도움이 됐다면", big: "저장해 두고\n꺼내 보세요", pill: "팔로우" }) },
  ],
  draft: ({ title, category, handle }) => ({
    photos: [],
    caption: "",
    slides: [
      { kind: "cover", photo: null, category, title: title.slice(0, 24) },
      { kind: "point", photo: null, heading: "첫 번째 이야기", body: "" },
      { kind: "cta", line: "도움이 됐다면", big: "저장해 두고\n꺼내 보세요", pill: `${handle} 팔로우`.slice(0, 30) },
    ],
  }),
};
