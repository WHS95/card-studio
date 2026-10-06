import { requireWs } from "@/lib/auth";
import { PLANS, planOf } from "@/lib/plans";
import { TEMPLATES } from "@/lib/templates";
import { saveWorkspaceAction } from "../../../actions";
import Top from "../../../Top";

/** 서비스 설정: 이름·계정·테마 색·워드마크·카테고리·시간대·일수·1일차 */
export default async function Settings({ params, searchParams }: PageProps<"/w/[ws]/settings">) {
  const { ws } = await params;
  const { error } = await searchParams;
  const { ws: w, actor } = await requireWs(ws, "manage");
  const color = (name: string, label: string, v: string) => <label className="fld">{label}<input name={name} type="color" className="input" defaultValue={v} /></label>;
  return (
    <>
      <Top ws={w} tab="settings" />
      <main className="wrap" style={{ maxWidth: 900 }}>
        <h1 style={{ margin: 0 }}>{w.name} 설정</h1>
        {typeof error === "string" && <p className="err">{error}</p>}
        <form action={saveWorkspaceAction} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="hidden" name="ws" value={w.id} />
          <div className="row">
            <label className="fld" style={{ flex: 1 }}>서비스 이름<input name="name" className="input" defaultValue={w.name} /></label>
            <label className="fld" style={{ flex: 1 }}>인스타 계정<input name="handle" className="input" defaultValue={w.handle} /></label>
            <label className="fld">1일차<input name="startDate" type="date" className="input" defaultValue={w.startDate ?? ""} /></label>
            <label className="fld">일수<input name="days" type="number" min={1} max={90} className="input" defaultValue={w.days} /></label>
          </div>
          <div className="row">
            <label className="fld" style={{ flex: 1 }}>시간대 (쉼표로, 최대 6개, 예: 07:30, 12:30)<input name="slots" className="input" defaultValue={w.slots.join(", ")} /></label>
            <label className="fld" style={{ flex: 2 }}>카테고리 (쉼표로, 최대 20개·각 20자 — 브리프의 기둥 이름이 앞에 와요)<input name="categories" className="input" defaultValue={w.categories.join(", ")} /></label>
            <label className="fld">기본 템플릿
              <select name="defaultTemplate" className="input" defaultValue={w.defaultTemplate}>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </label>
          </div>
          <strong className="small">테마 — 강조색은 채움으로만 써요(그 위 글자는 &apos;강조색 위 글자&apos;). 글자색으로 쓰는 건 워드마크뿐이에요.</strong>
          <div className="row">
            {color("dark", "어두운 바탕", w.theme.dark)}{color("light", "밝은 바탕", w.theme.light)}{color("ink", "밝은 바탕 위 글자", w.theme.ink)}{color("muted", "보조 글자", w.theme.muted)}{color("accent", "강조색", w.theme.accent)}{color("onAccent", "강조색 위 글자", w.theme.onAccent)}
          </div>
          <div className="row">
            <label className="fld" style={{ flex: 1 }}>워드마크<input name="wordmark" className="input" maxLength={24} defaultValue={w.theme.wordmark.text} /></label>
            {color("wmColor", "워드마크 글자", w.theme.wordmark.color)}{color("wmBg", "워드마크 바탕", w.theme.wordmark.bg)}
          </div>
          <p className="small muted" style={{ margin: 0 }}>글꼴: {w.theme.font.regular} / {w.theme.font.bold} (assets/). 글꼴을 바꾸면 tests/slide_safe.py 를 다시 돌려요.</p>
          <div className="row">
            <label className="fld">요금제 {actor.kind === "admin" ? <em>결제 연결 전이라 운영자만 바꿔요</em> : <em>운영자에게 요청</em>}
              <select name="plan" className="input" defaultValue={w.plan ?? "free"} disabled={actor.kind !== "admin"}>{Object.values(PLANS).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
            <span className="small muted">지금: {planOf(w.plan).name} · 사람 {w.members?.length ?? 0}/{planOf(w.plan).members} · AI 한 달 {planOf(w.plan).aiPerMonth}번</span>
          </div>
          <button className="btn primary" style={{ alignSelf: "flex-start" }}>저장</button>
        </form>
      </main>
    </>
  );
}
