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

// 목록 장은 항목 수에 맞춰 안전 영역 아래(SAFE y1)까지 채운다 — 적을수록 글을 키우고, 1개면 높이를 막아 가운데로 (매거진 목록과 같은 방식)
const LIST_TOP = 500;

function Rows({ c, s, n, total }: SlideProps) {
  const [x0, , x1, y1] = SAFE.feed;
  const rows = (s.rows as { k: string; v: string; chips?: boolean }[]) ?? [];
  const k = Math.max(1, rows.length);
  const sz = k <= 2 ? { k: 34, v: 44, chip: 32 } : k === 3 ? { k: 32, v: 40, chip: 30 } : k === 4 ? { k: 30, v: 36, chip: 27 } : { k: 28, v: 32, chip: 24 };
  return (
    <>
      <Head c={c} n={n} total={total} light />
      <LightTitle c={c} small={str(s, "small")} big={str(s, "big")} />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: LIST_TOP, height: y1 - LIST_TOP, display: "flex", flexDirection: "column", justifyContent: k === 1 ? "center" : "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", ...(k === 1 ? { height: 280 } : { flex: 1 }), padding: "8px 32px", borderRadius: 24, border: `3px solid ${c.theme.ink}` }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", flex: 1, alignItems: "center", gap: 24, padding: "12px 0", borderTop: i === 0 ? "none" : `2px solid ${c.theme.muted}33` }}>
              <span style={{ width: 190, flexShrink: 0, fontSize: sz.k, fontWeight: 500, color: c.theme.muted, wordBreak: "break-all" }}>{r.k}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, flex: 1 }}>
                {r.chips
                  ? r.v.split(/[,·]/).map((t) => t.trim()).filter(Boolean).slice(0, 6).map((t, j) => (
                      <span key={j} style={{ display: "flex", padding: "4px 14px", borderRadius: 12, border: `3px solid ${c.theme.ink}`, background: j === 0 ? c.theme.accent : c.theme.light, color: j === 0 ? c.theme.onAccent : c.theme.ink, fontSize: sz.chip, fontWeight: 800, wordBreak: "break-all" }}>{t}</span>
                    ))
                  : <span style={{ fontSize: sz.v, fontWeight: 800, color: c.theme.ink, lineHeight: 1.3, wordBreak: "break-all" }}>{r.v}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Ranked({ c, s, n, total }: SlideProps) {
  const [x0, , x1, y1] = SAFE.feed;
  const items = (s.items as { t: string }[]) ?? [];
  const k = Math.max(1, items.length);
  const sz = k <= 2 ? { t: 56, box: 84, first: 32 } : k === 3 ? { t: 50, box: 76, first: 30 } : k === 4 ? { t: 44, box: 68, first: 28 } : { t: 40, box: 60, first: 26 };
  const note = str(s, "note");
  return (
    <>
      <Head c={c} n={n} total={total} light />
      <LightTitle c={c} small={str(s, "small")} big={str(s, "big")} />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: LIST_TOP, height: y1 - LIST_TOP, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16, justifyContent: k === 1 ? "center" : "flex-start" }}>
          {items.map((m, i) => (
            <div key={i} style={{ display: "flex", flex: 1, ...(k === 1 ? { maxHeight: 260 } : {}), alignItems: "center", gap: 26, padding: "0 32px", borderRadius: 24, border: `3px solid ${c.theme.ink}`, background: c.theme.light }}>
              <NumBox c={c} n={i + 1} on={i === 0} size={sz.box} />
              <span style={{ fontSize: sz.t, fontWeight: 800, color: c.theme.ink, letterSpacing: -1, wordBreak: "break-all" }}>{m.t}</span>
              {i === 0 && str(s, "first") && <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: sz.first, fontWeight: 500, color: c.theme.muted }}>{str(s, "first")}</span>}
            </div>
          ))}
        </div>
        {note && <span style={{ fontSize: 30, fontWeight: 500, color: c.theme.ink, lineHeight: 1.45, wordBreak: "break-all" }}>{note}</span>}
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
