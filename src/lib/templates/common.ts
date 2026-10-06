import type { ChoiceField, ToggleField } from "../fields";

// 인기 형태 템플릿이 같이 쓰는 조절 칸 (장마다 고른다)
const C = (key: string, label: string, options: [string, string][], def: string): ChoiceField => ({ key, label, type: "choice", options: options.map(([v, l]) => ({ v, label: l })), default: def });

export const ALIGN = C("align", "정렬", [["left", "왼쪽"], ["center", "가운데"]], "left");
export const SIZE = C("size", "글 크기", [["s", "작게"], ["m", "보통"], ["l", "크게"]], "m");
export const HL = C("hl", "==강조== 표시", [["fill", "강조색 채움"], ["text", "강조색 글자"]], "fill");
export const BG_LD = C("bg", "바탕", [["light", "밝게"], ["dark", "어둡게"]], "light");
export const BG_POSTER = C("bg", "바탕", [["paper", "종이"], ["light", "흰색"], ["dark", "어둡게"]], "paper");
export const NUM: ToggleField = { key: "num", label: "번호 원 보이기", type: "toggle" };
export { C as choiceField };
