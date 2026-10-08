import { redirect } from "next/navigation";

// insights 탭은 잠시 닫았다 (사용자 결정 2026-10-08: 나중에 도입). 화면 코드는 LaterPage.tsx 에 그대로 — 다시 열려면 이 파일을 지우고 LaterPage.tsx 를 page.tsx 로, flow.ts LATER 에서 빼기.
export default async function Later({ params }: PageProps<"/w/[ws]/insights">) {
  const { ws } = await params;
  redirect(`/w/${ws}/review`);
}
