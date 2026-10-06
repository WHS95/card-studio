import { AccentPill, Backdrop, Head, LightPill, LightTitle, Lines, NumBox, QA, SAFE, SLIDE, Wordmark, photoOf, photoY, str, type SlideProps } from "./kit";

function Cover({ c, s }: SlideProps) {
  const [x0, , x1, y1] = SAFE.cover;
  return (
    <>
      <Backdrop c={c} src={photoOf(c, s.photo)} y={photoY(s)} shade="low" />
      <div style={{ position: "absolute", left: x0, top: SAFE.cover[1], width: x1 - x0, display: "flex", justifyContent: "center" }}><Wordmark c={c} /></div>
      <div style={{ position: "absolute", left: x0, width: x1 - x0, bottom: SLIDE.h - y1 + 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <LightPill c={c} text={str(s, "tag")} />
        <span style={{ fontSize: 34, fontWeight: 500, color: c.theme.light, textAlign: "center", wordBreak: "break-all" }}>{str(s, "sub")}</span>
        <Lines text={str(s, "hook")} style={{ fontSize: 62, fontWeight: 800, color: c.theme.light, lineHeight: 1.22, textAlign: "center", letterSpacing: -2 }} />
      </div>
    </>
  );
}

function Picks({ c, s, n, total }: SlideProps) {
  const [x0, , x1] = SAFE.feed;
  const items = (s.items as { photo: number | null; name: string; why: string }[]) ?? [];
  return (
    <>
      <Head c={c} n={n} total={total} light />
      <LightTitle c={c} small={str(s, "small")} big={str(s, "big")} />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: 500, display: "flex", flexDirection: "column", gap: 24 }}>
        {items.map((g, i) => {
          const src = photoOf(c, g.photo);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, height: 186, padding: "0 28px", borderRadius: 24, border: `3px solid ${c.theme.ink}`, background: c.theme.light }}>
              <NumBox c={c} n={i + 1} on={i === 0} size={60} />
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" width={130} height={130} style={{ width: 130, height: 130, borderRadius: 18, objectFit: "cover" }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: c.theme.ink, wordBreak: "break-all" }}>{g.name}</span>
                {g.why && <span style={{ fontSize: 28, fontWeight: 500, color: c.theme.muted, wordBreak: "break-all" }}>{g.why}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Follow({ c, s, n, total }: SlideProps) {
  const [x0, , x1] = SAFE.cover;
  return (
    <>
      <Backdrop c={c} src={photoOf(c, s.photo)} y={photoY(s)} shade="full" />
      <Head c={c} n={n} total={total} light={false} />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: 0, height: SLIDE.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
        <span style={{ width: "100%", fontSize: 60, fontWeight: 800, color: c.theme.light, textAlign: "center", wordBreak: "break-all", letterSpacing: -1 }}>{str(s, "title")}</span>
        <span style={{ width: "100%", fontSize: 40, fontWeight: 500, color: c.theme.light, textAlign: "center", wordBreak: "break-all" }}>{str(s, "line")}</span>
        <div style={{ display: "flex", marginTop: 20 }}><AccentPill c={c} text={str(s, "pill")} /></div>
      </div>
    </>
  );
}

export const INTERVIEW = { cover: Cover, qa: QA, picks: Picks, follow: Follow };
