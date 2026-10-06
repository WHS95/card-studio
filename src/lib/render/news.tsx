import { choice } from "../fields";
import { news } from "../templates/news";
import { AccentPill, Backdrop, Credit, Kicker, NumCircle, Pic, Rich, SAFE, SLIDE, Wordmark, estH, fit, has, hexA, photoH, photoOf, photoY, scale, str, type Ctx, type SlideProps } from "./kit";

// 뉴스형 렌더러. 사진 칸이 차 있으면(번호가 있으면) 마진 계산 때도 사진 자리를 비워 두고 글을 놓는다 → 실제 배치 그대로 검사된다.
// 글이 넘칠 것 같으면 글 크기를 줄이고(최소 62%), 그래도 넘치면 사진 높이를 줄인다.

const K = (kind: string) => news.kinds.find((k) => k.kind === kind)!;
const pick = (s: SlideProps["s"], kind: string, key: string) => choice(s, K(kind).fields.find((f) => f.key === key && f.type === "choice") as never);
const ink = (c: Ctx, dark: boolean) => (dark ? c.theme.light : c.theme.ink);
const sub = (c: Ctx, dark: boolean) => (dark ? hexA(c.theme.light, 0.72) : c.theme.muted);
const no = (c: Ctx, n: number) => c.post.slides.slice(1, n).filter((x) => x.kind !== "cta").length; // 표지 뒤 몇 번째 이야기

function Cover({ c, s }: SlideProps) {
  const [x0, y0, x1, y1] = SAFE.cover;
  const w = x1 - x0, k0 = scale(pick(s, "cover", "size")), top = pick(s, "cover", "pos") === "top";
  const logo = has(s.logo) && !top; // 로고 그림은 제목이 아래일 때 위쪽에 (워드마크 대신)
  const brand = s.brand !== false && !logo;
  const title = str(s, "title"), kicker = str(s, "kicker"), subl = str(s, "sub");
  const k = k0 * fit([[title, 78 * k0, 1.18, w], [subl, 30, 1.4, w]], (kicker ? 70 : 0) + 40, y1 - y0 - (brand ? 90 : logo ? 260 : 0));
  const block = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18, width: w }}>
      {kicker && <span style={{ display: "flex", maxWidth: "100%", padding: "6px 22px", borderRadius: 999, border: `3px solid ${c.theme.light}`, color: c.theme.light, fontSize: 26, fontWeight: 500, wordBreak: "break-all" }}>{kicker}</span>}
      <Rich c={c} text={title} size={Math.round(78 * k)} lh={1.18} weight={800} color={c.theme.light} hl={pick(s, "cover", "hl")} />
      {subl && <span style={{ fontSize: 30, fontWeight: 500, color: hexA(c.theme.light, 0.86), wordBreak: "break-all" }}>{subl}</span>}
    </div>
  );
  return (
    <>
      <Backdrop c={c} src={photoOf(c, s.photo)} y={photoY(s)} shade={top ? "full" : "low"} />
      {logo && <Pic src={photoOf(c, s.logo)} x={x0} y={y0} w={w} h={220} fit="contain" />}
      {brand && <div style={{ position: "absolute", left: x0, width: w, ...(top ? { bottom: SLIDE.h - y1 } : { top: y0 }), display: "flex", justifyContent: "center" }}><Wordmark c={c} /></div>}
      <div style={{ position: "absolute", left: x0, width: w, ...(top ? { top: y0 } : { bottom: SLIDE.h - y1 }), display: "flex" }}>{block}</div>
    </>
  );
}

function Split({ c, s, n }: SlideProps) {
  const [x0, y0, x1, y1] = SAFE.feed;
  const w = x1 - x0;
  const dark = pick(s, "split", "bg") === "dark";
  const align = pick(s, "split", "align") as "left" | "center";
  const k0 = scale(pick(s, "split", "size"));
  const inset = pick(s, "split", "layout") === "inset";
  const photo = has(s.photo), num = s.num !== false;
  const title = str(s, "title"), body = str(s, "body"), kicker = str(s, "kicker"), source = str(s, "source");
  const fixed = (kicker ? 50 : 0) + (source ? 32 : 0) + (num && !photo ? 96 : 0) + 60;
  const blocks: [string, number, number, number][] = [[title, 58 * k0, 1.25, w], [body, 34 * k0, 1.55, w]];
  let ph = photo ? photoH(s) : 0;
  let top = photo ? ph + (num ? 52 : 36) : y0;
  let k = k0 * fit(blocks, fixed, y1 - top);
  // 글 크기를 다 줄여도 넘치면 사진을 줄인다
  const need = fixed + blocks.reduce((a, [t, sz, lh, ww]) => a + estH(t, sz * (k / k0), lh, ww), 0);
  if (photo && top + need > y1) { top = Math.max(y0 + 120, y1 - need); ph = top - (num ? 52 : 36); k = k0 * fit(blocks, fixed, y1 - top); }
  const src = photoOf(c, s.photo);
  const box = inset ? { x: 120, y: 150, w: SLIDE.w - 240, h: Math.max(160, ph - 170) } : { x: 0, y: 0, w: SLIDE.w, h: ph };
  const tc = ink(c, dark), mc = sub(c, dark);
  return (
    <>
      {photo && <Pic src={src} x={box.x} y={box.y} w={box.w} h={box.h} pos={photoY(s)} radius={inset ? 8 : 0} />}
      {photo && num && <div style={{ position: "absolute", left: x0, top: (inset ? box.y + box.h : ph) - 40, display: "flex" }}><NumCircle c={c} n={no(c, n) || 1} size={80} /></div>}
      <div style={{ position: "absolute", left: x0, width: w, top, display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", gap: 14 }}>
        {source && <Credit text={source} color={mc} />}
        {num && !photo && <NumCircle c={c} n={no(c, n) || 1} size={80} />}
        {kicker && <Kicker text={kicker} color={mc} />}
        <Rich c={c} text={title} size={Math.round(58 * k)} lh={1.25} weight={800} color={tc} align={align} hl={pick(s, "split", "hl")} />
        {body && <div style={{ display: "flex", width: "100%", marginTop: 6 }}><Rich c={c} text={body} size={Math.round(34 * k)} lh={1.55} color={tc} align={align} hl={pick(s, "split", "hl")} /></div>}
      </div>
    </>
  );
}

function Full({ c, s, n }: SlideProps) {
  const [x0, y0, x1, y1] = SAFE.feed;
  const w = x1 - x0, k0 = scale(pick(s, "full", "size")), num = s.num !== false;
  const title = str(s, "title"), body = str(s, "body"), source = str(s, "source");
  const k = k0 * fit([[title, 66 * k0, 1.2, w], [body, 32 * k0, 1.55, w]], (num ? 96 : 0) + (source ? 32 : 0) + 30, y1 - y0 - 40);
  return (
    <>
      <Backdrop c={c} src={photoOf(c, s.photo)} y={photoY(s)} shade="low" />
      <div style={{ position: "absolute", left: x0, width: w, bottom: SLIDE.h - y1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
        {source && <Credit text={source} color={hexA(c.theme.light, 0.8)} />}
        {num && <NumCircle c={c} n={no(c, n) || 1} size={72} dark />}
        <Rich c={c} text={title} size={Math.round(66 * k)} lh={1.2} weight={800} color={c.theme.light} hl={pick(s, "full", "hl")} />
        {body && <Rich c={c} text={body} size={Math.round(32 * k)} lh={1.55} color={hexA(c.theme.light, 0.92)} hl={pick(s, "full", "hl")} />}
      </div>
    </>
  );
}

function Text({ c, s }: SlideProps) {
  const [x0, y0, x1, y1] = SAFE.feed;
  const w = x1 - x0, dark = pick(s, "text", "bg") === "dark", align = pick(s, "text", "align") as "left" | "center";
  const k0 = scale(pick(s, "text", "size"));
  const title = str(s, "title"), body = str(s, "body"), kicker = str(s, "kicker");
  const k = k0 * fit([[title, 64 * k0, 1.22, w], [body, 36 * k0, 1.6, w]], (kicker ? 50 : 0) + 70, y1 - y0 - 60);
  return (
    <div style={{ position: "absolute", left: x0, width: w, top: y0 + 60, display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", gap: 20 }}>
      {kicker && <Kicker text={kicker} color={sub(c, dark)} />}
      <Rich c={c} text={title} size={Math.round(64 * k)} lh={1.22} weight={800} color={ink(c, dark)} align={align} hl={pick(s, "text", "hl")} />
      <div style={{ display: "flex", width: 96, height: 6, background: ink(c, dark) }} />
      {body && <Rich c={c} text={body} size={Math.round(36 * k)} lh={1.6} color={ink(c, dark)} align={align} hl={pick(s, "text", "hl")} />}
    </div>
  );
}

function Cta({ c, s }: SlideProps) {
  const [x0, y0, x1, y1] = SAFE.feed;
  const dark = pick(s, "cta", "bg") === "dark";
  return (
    <div style={{ position: "absolute", left: x0, width: x1 - x0, top: y0, height: y1 - y0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
      <span style={{ width: "100%", fontSize: 36, fontWeight: 500, color: ink(c, dark), textAlign: "center", wordBreak: "break-all" }}>{str(s, "line")}</span>
      <Rich c={c} text={str(s, "big")} size={70} lh={1.2} weight={800} color={ink(c, dark)} align="center" hl={pick(s, "cta", "hl")} />
      <AccentPill c={c} text={str(s, "pill")} size={30} />
    </div>
  );
}

export const NEWS = { cover: Cover, split: Split, full: Full, text: Text, cta: Cta };
