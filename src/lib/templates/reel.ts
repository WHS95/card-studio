import type { Template } from "../fields";
import { HL, SIZE, choiceField } from "./common";

// 릴스 9:16 (1080×1920): 위 판(로고·제목·자막) + 아래 영상, 또는 영상 가득 + 자막. 자막은 시작 초마다 바뀐다(영상으로 합성).
export const reel: Template = {
  id: "reel",
  name: "릴스 자막형",
  group: "영상",
  format: "reel",
  videoMax: 90,
  inspired: "말하는 영상 위에 판을 두고 자막을 크게 띄우는 정보 릴스",
  description: "9:16 릴스. 위 판(로고·자막) + 아래 영상 / 영상 가득 + 자막. 자막은 초마다 바뀌어요",
  maxSlides: 1,
  kinds: [
    { kind: "reel", label: "릴스", fixed: true, fields: [
      { key: "photo", label: "영상 (또는 사진)", type: "photo", video: true, tune: ["y"] },
      choiceField("layout", "배치", [["split", "위 판 + 아래 영상"], ["full", "영상 가득"]], "split"),
      choiceField("panel", "위 판 높이", [["40", "40%"], ["45", "45%"], ["50", "50%"]], "45"),
      choiceField("bg", "판 색", [["paper", "종이"], ["light", "흰색"], ["dark", "어둡게"], ["accent", "강조색"]], "paper"),
      { key: "logo", label: "판 그림 (로고·아이콘)", type: "photo" },
      { key: "title", label: "고정 제목 (선택)", type: "text", max: 30, lines: 2, optional: true, rich: true },
      { key: "subs", label: "자막", type: "items", min: 0, max: 30, item: [
        { key: "at", label: "시작", type: "number", min: 0, max: 90, step: 0.1, unit: "초" },
        { key: "t", label: "자막", type: "text", max: 36, lines: 2, rich: true },
      ] },
      SIZE, HL,
    ], blank: () => ({ kind: "reel", photo: null, layout: "split", panel: "45", bg: "paper", logo: null, title: "", subs: [{ at: 0, t: "" }], size: "m", hl: "fill" }) },
  ],
  draft: ({ title }) => ({
    photos: [],
    caption: "",
    slides: [{ kind: "reel", photo: null, layout: "split", panel: "45", bg: "paper", logo: null, title: "", subs: [{ at: 0, t: title.slice(0, 36) || "첫 자막" }, { at: 3, t: "두 번째 자막" }], size: "m", hl: "fill" }],
  }),
  sample: () => ({
    photos: [
      { url: "/samples/clip.mp4", credit: "샘플", source: "샘플", kind: "video", poster: "/samples/clip0.jpg", duration: 8 },
      { url: "/samples/logo.jpg", credit: "샘플", source: "샘플", kind: "image" },
    ],
    caption: "샘플 캡션이에요.",
    slides: [{ kind: "reel", photo: 0, layout: "split", panel: "45", bg: "paper", logo: 1, title: "", subs: [{ at: 0, t: "**설정 한 번으로**" }, { at: 2.5, t: "작업이 끊기지 않아요" }], size: "m", hl: "fill" }],
  }),
};
