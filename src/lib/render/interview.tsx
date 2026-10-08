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
  const [x0, , x1, y1] = SAFE.feed;
  const items = (s.items as { photo: number | null; name: string; why: string }[]) ?? [];
  // 항목 수에 맞춰 안전 영역 아래까지 채운다 (매거진 목록과 같은 방식) — 줄 높이를 나눠 사진·글을 키운다. 1개면 높이를 막아 가운데로
  const top = 500, gap = 24, k = Math.max(1, items.length);
  const rowH = Math.min(k === 1 ? 360 : 9999, Math.floor((y1 - top - gap * (k - 1)) / k));
  const img = Math.min(k >= 3 ? 140 : 260, rowH - 44); // 3개면 글 자리를 남기려고 사진을 작게
  const sz = k === 1 ? { name: 56, why: 36, box: 76 } : k === 2 ? { name: 48, why: 32, box: 68 } : { name: 40, why: 28, box: 60 };
  return (
    <>
      <Head c={c} n={n} total={total} light />
      <LightTitle c={c} small={str(s, "small")} big={str(s, "big")} />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top, height: y1 - top, display: "flex", flexDirection: "column", gap, justifyContent: k === 1 ? "center" : "flex-start" }}>
        {items.map((g, i) => {
          const src = photoOf(c, g.photo);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 28, height: rowH, padding: "0 28px", borderRadius: 24, border: `3px solid ${c.theme.ink}`, background: c.theme.light }}>
              <NumBox c={c} n={i + 1} on={i === 0} size={sz.box} />
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" width={img} height={img} style={{ width: img, height: img, borderRadius: 20, objectFit: "cover" }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <span style={{ fontSize: sz.name, fontWeight: 800, color: c.theme.ink, letterSpacing: -1, lineHeight: 1.25, wordBreak: "break-all" }}>{g.name}</span>
                {g.why && <span style={{ fontSize: sz.why, fontWeight: 500, color: c.theme.muted, lineHeight: 1.4, wordBreak: "break-all" }}>{g.why}</span>}
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
