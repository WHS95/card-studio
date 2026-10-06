import { AccentPill, Backdrop, Head, Lines, NumBox, SAFE, SLIDE, Wordmark, hexA, photoH, photoOf, photoY, str, type SlideProps } from "./kit";

function Cover({ c, s }: SlideProps) {
  const [x0, , x1, y1] = SAFE.cover;
  return (
    <>
      <Backdrop c={c} src={photoOf(c, s.photo)} y={photoY(s)} shade="low" />
      <div style={{ position: "absolute", left: x0, top: SAFE.cover[1], width: x1 - x0, display: "flex", justifyContent: "center" }}><Wordmark c={c} /></div>
      <div style={{ position: "absolute", left: x0, width: x1 - x0, bottom: SLIDE.h - y1 + 16, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 20 }}>
        <AccentPill c={c} text={str(s, "category")} />
        <Lines text={str(s, "title")} align="flex-start" style={{ fontSize: 68, fontWeight: 800, color: c.theme.light, lineHeight: 1.2, letterSpacing: -2 }} />
      </div>
    </>
  );
}

function Point({ c, s, n, total }: SlideProps) {
  const [x0, , x1, y1] = SAFE.feed;
  const src = photoOf(c, s.photo);
  // 마진 계산(debug)에서는 사진을 안 그리지만, 사진을 고른 장이면 사진 있는 배치로 검사한다
  const withPhoto = !!src || (c.debug && typeof s.photo === "number");
  const no = c.post.slides.slice(0, n).filter((x) => x.kind === "point").length;
  const ph = photoH(s), fade = Math.min(320, Math.round(ph * 0.45));
  return (
    <>
      {src && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" width={SLIDE.w} height={ph} style={{ position: "absolute", left: 0, top: 0, width: SLIDE.w, height: ph, objectFit: "cover", objectPosition: `50% ${photoY(s)}%` }} />
          <div style={{ position: "absolute", left: 0, top: ph - fade, width: SLIDE.w, height: fade, backgroundImage: `linear-gradient(180deg, ${hexA(c.theme.dark, 0)} 0%, ${hexA(c.theme.dark, 1)} 100%)` }} />
        </>
      )}
      <Head c={c} n={n} total={total} light={false} />
      {withPhoto ? (
        <div style={{ position: "absolute", left: x0, width: x1 - x0, bottom: SLIDE.h - y1 + 16, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 20 }}>
          <NumBox c={c} n={no} on size={72} />
          <Lines text={str(s, "heading")} align="flex-start" style={{ fontSize: 54, fontWeight: 800, color: c.theme.light, lineHeight: 1.25, letterSpacing: -1 }} />
          {str(s, "body") && <Lines text={str(s, "body")} align="flex-start" style={{ fontSize: 32, fontWeight: 500, color: hexA(c.theme.light, 0.86), lineHeight: 1.55 }} />}
        </div>
      ) : (
        <div style={{ position: "absolute", left: x0, width: x1 - x0, top: 300, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 28 }}>
          <span style={{ display: "flex", width: 132, height: 132, borderRadius: 28, background: c.theme.accent, color: c.theme.onAccent, alignItems: "center", justifyContent: "center", fontSize: 76, fontWeight: 800, letterSpacing: -3 }}>{String(no).padStart(2, "0")}</span>
          <Lines text={str(s, "heading")} align="flex-start" style={{ fontSize: 66, fontWeight: 800, color: c.theme.light, lineHeight: 1.22, letterSpacing: -2 }} />
          <div style={{ display: "flex", width: 96, height: 6, background: c.theme.light }} />
          {str(s, "body") && <Lines text={str(s, "body")} align="flex-start" style={{ fontSize: 38, fontWeight: 500, color: hexA(c.theme.light, 0.88), lineHeight: 1.6 }} />}
        </div>
      )}
    </>
  );
}

function List({ c, s, n, total }: SlideProps) {
  const [x0, , x1] = SAFE.feed;
  const items = (s.items as { t: string; d: string }[]) ?? [];
  return (
    <>
      <Head c={c} n={n} total={total} light />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: 240, display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 56, fontWeight: 800, color: c.theme.ink, letterSpacing: -2, lineHeight: 1.2, wordBreak: "break-all", marginBottom: 16 }}>{str(s, "heading")}</span>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, padding: "12px 24px", borderRadius: 20, border: `3px solid ${c.theme.ink}`, background: c.theme.light }}>
            <NumBox c={c} n={i + 1} on={i === 0} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: c.theme.ink, wordBreak: "break-all" }}>{it.t}</span>
              {it.d && <span style={{ fontSize: 24, fontWeight: 500, color: c.theme.muted, lineHeight: 1.4, wordBreak: "break-all" }}>{it.d}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Cta({ c, s, n, total }: SlideProps) {
  const [x0, , x1] = SAFE.cover;
  return (
    <>
      <Head c={c} n={n} total={total} light={false} />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: 0, height: SLIDE.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <span style={{ width: "100%", fontSize: 36, fontWeight: 500, color: c.theme.light, textAlign: "center", wordBreak: "break-all" }}>{str(s, "line")}</span>
        <Lines text={str(s, "big")} style={{ fontSize: 64, fontWeight: 800, color: c.theme.light, textAlign: "center", lineHeight: 1.22, letterSpacing: -1 }} />
        <AccentPill c={c} text={str(s, "pill")} size={28} />
      </div>
    </>
  );
}

export const MAGAZINE = { cover: Cover, point: Point, list: List, cta: Cta };
