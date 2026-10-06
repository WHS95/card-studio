import { redirect } from "next/navigation";
import { requireWs } from "@/lib/auth";
import { flowOf } from "@/lib/flow";

/** 서비스 카드를 누르면: '지금 할 일'이 있는 단계로 (없으면 제작) */
export default async function Go({ params }: PageProps<"/w/[ws]/go">) {
  const { ws } = await params;
  const { ws: w } = await requireWs(ws, "view");
  const f = await flowOf(w);
  redirect(f.now?.href ?? `/w/${w.id}`);
}
