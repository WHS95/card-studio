import { AccentPill, Backdrop, Head, LightPill, LightTitle, Lines, NumBox, QA, SAFE, SLIDE, Wordmark, photoOf, photoY, str, type SlideProps } from "./kit";

function Cover({ c, s }: SlideProps) {
  const [x0, , x1, y1] = SAFE.cover;
  return (
    <>
      <Backdrop c={c} src={photoOf(c, s.photo)} y={photoY(s)} shade="low" />
      <div style={{ position: "absolute", left: x0, top: SAFE.cover[1], width: x1 - x0, display: "flex", justifyContent: "center" }}><Wordmark c={c} /></div>
      <div style={{ position: "absolute", left: x0, width: x1 - x0, bottom: SLIDE.h - y1, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <AccentPill c={c} text={str(s, "label")} size={28} />
        <Lines text={str(s, "title")} style={{ fontSize: 76, fontWeight: 800, color: c.theme.light, lineHeight: 1.15, textAlign: "center", letterSpacing: -2 }} />
        {str(s, "sub") && <Lines text={str(s, "sub")} style={{ fontSize: 34, fontWeight: 500, color: c.theme.light, lineHeight: 1.45, textAlign: "center" }} />}
      </div>
    </>
  );
}

function Rows({ c, s, n, total }: SlideProps) {
  const [x0, , x1] = SAFE.feed;
  const rows = (s.rows as { k: string; v: string; chips?: boolean }[]) ?? [];
  return (
    <>
      <Head c={c} n={n} total={total} light />
      <LightTitle c={c} small={str(s, "small")} big={str(s, "big")} />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: 500, display: "flex", flexDirection: "column", padding: "8px 32px", borderRadius: 24, border: `3px solid ${c.theme.ink}` }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 24, padding: r.chips ? "12px 0" : "16px 0", borderTop: i === 0 ? "none" : `2px solid ${c.theme.muted}33` }}>
            <span style={{ width: 170, flexShrink: 0, fontSize: 28, fontWeight: 500, color: c.theme.muted, paddingTop: 6, wordBreak: "break-all" }}>{r.k}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1 }}>
              {r.chips
                ? r.v.split(/[,·]/).map((t) => t.trim()).filter(Boolean).slice(0, 6).map((t, j) => (
                    <span key={j} style={{ display: "flex", padding: "2px 12px", borderRadius: 10, border: `3px solid ${c.theme.ink}`, background: j === 0 ? c.theme.accent : c.theme.light, color: j === 0 ? c.theme.onAccent : c.theme.ink, fontSize: 24, fontWeight: 800, wordBreak: "break-all" }}>{t}</span>
                  ))
                : <span style={{ fontSize: 32, fontWeight: 800, color: c.theme.ink, wordBreak: "break-all" }}>{r.v}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Ranked({ c, s, n, total }: SlideProps) {
  const [x0, , x1] = SAFE.feed;
  const items = (s.items as { t: string }[]) ?? [];
  return (
    <>
      <Head c={c} n={n} total={total} light />
      <LightTitle c={c} small={str(s, "small")} big={str(s, "big")} />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: 500, display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, height: 96, padding: "0 28px", borderRadius: 22, border: `3px solid ${c.theme.ink}`, background: c.theme.light }}>
            <NumBox c={c} n={i + 1} on={i === 0} />
            <span style={{ fontSize: 40, fontWeight: 800, color: c.theme.ink, wordBreak: "break-all" }}>{m.t}</span>
            {i === 0 && str(s, "first") && <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 26, fontWeight: 500, color: c.theme.muted }}>{str(s, "first")}</span>}
          </div>
        ))}
        {str(s, "note") && <span style={{ marginTop: 6, fontSize: 28, fontWeight: 500, color: c.theme.ink, lineHeight: 1.45, wordBreak: "break-all" }}>{str(s, "note")}</span>}
      </div>
    </>
  );
}

function Join({ c, s, n, total }: SlideProps) {
  const [x0, , x1] = SAFE.cover;
  return (
    <>
      <Backdrop c={c} src={photoOf(c, s.photo)} y={photoY(s)} shade="full" />
      <Head c={c} n={n} total={total} light={false} />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: 0, height: SLIDE.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
        <span style={{ width: "100%", fontSize: 40, fontWeight: 500, color: c.theme.light, textAlign: "center", wordBreak: "break-all" }}>{str(s, "line1")}</span>
        <Lines text={str(s, "title")} style={{ fontSize: 64, fontWeight: 800, color: c.theme.light, textAlign: "center", letterSpacing: -1, lineHeight: 1.2 }} />
        <LightPill c={c} text={str(s, "pill1")} />
        <AccentPill c={c} text={str(s, "pill2")} />
      </div>
    </>
  );
}

export const INTRO = { cover: Cover, qa: QA, rows: Rows, ranked: Ranked, join: Join };
