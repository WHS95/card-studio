import Link from "next/link";
import { requireAuth, roleIn } from "@/lib/auth";
import { listPosts, listWorkspaces } from "@/lib/store";
import { TEMPLATES } from "@/lib/templates";
import { PRESETS } from "@/lib/presets";
import { createWorkspaceAction } from "./actions";
import Top from "./Top";

/** 서비스 목록 + 새 서비스 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const actor = await requireAuth();
  const { error } = await searchParams;
  const ws = (await listWorkspaces()).filter((w) => roleIn(actor, w));
  const counts = await Promise.all(ws.map(async (w) => (await listPosts(w.id)).filter((p) => p.data).length));
  return (
    <>
      <Top />
      <main className="wrap">
        <h1 style={{ margin: 0 }}>서비스</h1>
        <div className="grid-ws">
          {ws.map((w, i) => (
            <Link key={w.id} href={`/w/${w.id}`} className="card" style={{ textDecoration: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ alignSelf: "flex-start", padding: "4px 12px", borderRadius: 999, background: w.theme.wordmark.bg, color: w.theme.wordmark.color, fontWeight: 800, letterSpacing: 3, fontSize: 13 }}>{w.theme.wordmark.text}</span>
              <strong>{w.name}</strong>
              <span className="small muted">{w.handle} · 하루 {w.slots.length}개 × {w.days}일 · 초안 이상 {counts[i]}개</span>
              <span className="row">{[w.theme.dark, w.theme.light, w.theme.accent].map((c) => <span key={c} className="swatch" style={{ background: c }} />)}</span>
            </Link>
          ))}
        </div>
        <form action={createWorkspaceAction} className="card newws">
          <strong style={{ gridColumn: "1 / -1" }}>새 서비스</strong>
          <label className="fld">서비스 이름<input name="name" className="input" required maxLength={30} /></label>
          <label className="fld">주소용 영문 (예: my-brand)<input name="id" className="input" required pattern="[a-z0-9-]+" maxLength={30} /></label>
          <label className="fld">인스타 계정<input name="handle" className="input" placeholder="@account" /></label>
          <label className="fld">업종 <em>기둥·말투 시작값</em>
            <select name="industry" className="input" defaultValue=""><option value="">고르지 않음</option>{PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
          <label className="fld">강조색<input name="accent" type="color" className="input" defaultValue="#D9D9D9" /></label>
          <label className="fld" style={{ gridColumn: "1 / -1" }}>한 줄 소개 (선택)<input name="about" className="input" maxLength={300} placeholder="무엇을 하는 서비스인지 한 줄로" /></label>
          <button className="btn primary">만들고 브리프 쓰기</button>
        </form>
        {typeof error === "string" && <p className="err">{error}</p>}
        <p className="small muted">템플릿 {TEMPLATES.length}개: {TEMPLATES.map((t) => `${t.name}(${t.description})`).join(" · ")}</p>
      </main>
    </>
  );
}
