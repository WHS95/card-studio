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
  const [x0, , x1, y1] = SAFE.feed;
  const items = (s.items as { t: string; d: string }[]) ?? [];
  // 항목 수에 맞춰 줄이 안전 영역 아래까지 채우게 (빈 공간 없이). 적을수록 글·번호를 키우고, 설명이 없으면 더 키운다. 1개면 줄 높이를 막아 가운데로
  const k = Math.max(1, items.length);
  const base = k <= 2 ? { t: 52, d: 34, box: 84, pad: 32 } : k === 3 ? { t: 46, d: 30, box: 76, pad: 28 } : k === 4 ? { t: 40, d: 28, box: 68, pad: 24 } : { t: 36, d: 26, box: 62, pad: 22 };
  const bare = items.every((it) => !it.d);
  const sz = bare ? { ...base, t: base.t + 10, box: base.box + 8 } : base;
  return (
    <>
      <Head c={c} n={n} total={total} light />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: 240, height: y1 - 240, display: "flex", flexDirection: "column", gap: 26 }}>
        <span style={{ fontSize: 56, fontWeight: 800, color: c.theme.ink, letterSpacing: -2, lineHeight: 1.2, wordBreak: "break-all" }}>{str(s, "heading")}</span>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16, justifyContent: k === 1 ? "center" : "flex-start" }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", flex: 1, ...(k === 1 ? { maxHeight: 420 } : {}), alignItems: "center", gap: 28, padding: `12px ${sz.pad}px`, borderRadius: 24, border: `3px solid ${c.theme.ink}`, background: c.theme.light }}>
              <NumBox c={c} n={i + 1} on={i === 0} size={sz.box} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <span style={{ fontSize: sz.t, fontWeight: 800, color: c.theme.ink, letterSpacing: -1, lineHeight: 1.25, wordBreak: "break-all" }}>{it.t}</span>
                {it.d && <span style={{ fontSize: sz.d, fontWeight: 500, color: c.theme.muted, lineHeight: 1.4, wordBreak: "break-all" }}>{it.d}</span>}
              </div>
            </div>
          ))}
        </div>
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
