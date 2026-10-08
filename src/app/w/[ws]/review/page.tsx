import { redirect } from "next/navigation";

// 검수 탭은 닫았다 (사용자 결정 2026-10-08: 제작을 마치면 편집기의 '검수' 버튼으로 종합 피드백·승인). 승인 대기는 제작 목록의 '초안'으로.
// 예전 화면(승인 대기 목록 + 승인 전 확인)은 v0.6.10 태그의 이 폴더에 있다.
export default async function Closed({ params, searchParams }: PageProps<"/w/[ws]/review">) {
  const { ws } = await params;
  const { p } = await searchParams;
  // 예전 링크(?p=게시물)는 그 게시물 편집기로 — 거기서 '검수'
  redirect(typeof p === "string" && /^[a-f0-9-]{8,40}$/.test(p) ? `/w/${ws}/p/${p}` : `/w/${ws}?s=draft`);
}
