import { choice } from "../fields";
import { poster } from "../templates/poster";
import { AccentPill, Pic, Rich, SAFE, Tape, fit, has, hexA, hlMode, photoOf, photoY, scale, str, type Ctx, type SlideProps } from "./kit";

// 포스터형 렌더러: 종이·흰·어두운 바탕, 기운 테이프 제목, ==강조== 낱말(기본 강조색 글자), 굵은 줄, 옆 그림, (01) 리워드 칸.

const K = (kind: string) => poster.kinds.find((k) => k.kind === kind)!;
const pick = (s: SlideProps["s"], kind: string, key: string) => choice(s, K(kind).fields.find((f) => f.key === key && f.type === "choice") as never);
const isDark = (s: SlideProps["s"], kind: string) => pick(s, kind, "bg") === "dark";
const ink = (c: Ctx, dark: boolean) => (dark ? c.theme.light : c.theme.ink);
/** 어두운 바탕에서는 테이프를 밝게 뒤집는다 */
function TapeOn({ c, text, dark, size }: { c: Ctx; text: string; dark: boolean; size?: number }) {
  const t = dark ? { ...c, theme: { ...c.theme, dark: c.theme.light, light: c.theme.ink } } : c;
  return <Tape c={t} text={text} size={size} />;
}

function Cover({ c, s }: SlideProps) {
  const [x0, y0, x1, y1] = SAFE.cover;
  const w = x1 - x0, dark = isDark(s, "cover"), hl = pick(s, "cover", "hl");
  const top = str(s, "top"), title = str(s, "title"), bottom = str(s, "bottom");
  const photo = has(s.photo);
  const k = fit([[title, 72, 1.2, w], [top, 32, 1.4, w]], 120, photo ? 380 : 700);
  return (
    <>
      {photo && <Pic src={photoOf(c, s.photo)} x={150} y={600} w={780} h={420} pos={photoY(s)} radius={14} />}
      <div style={{ position: "absolute", left: x0, width: w, top: y0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        {top && <Rich c={c} text={top} size={32} weight={800} color={ink(c, dark)} align="center" hl={hl} />}
        <TapeOn c={c} text={str(s, "tape")} dark={dark} size={60} />
        {title && <div style={{ display: "flex", width: "100%", marginTop: 8 }}><Rich c={c} text={title} size={Math.round(72 * k)} lh={1.2} weight={800} color={ink(c, dark)} align="center" hl={hl} /></div>}
      </div>
      {bottom && <div style={{ position: "absolute", left: x0, width: w, bottom: 1350 - y1, display: "flex" }}><Rich c={c} text={bottom} size={32} color={ink(c, dark)} align="center" hl={hl} /></div>}
    </>
  );
}

function Point({ c, s }: SlideProps) {
  const [x0, y0, x1, y1] = SAFE.feed;
  const dark = isDark(s, "point"), hl = pick(s, "point", "hl"), k0 = scale(pick(s, "point", "size"));
  const photo = has(s.photo), right = pick(s, "point", "img") === "right";
  const head = str(s, "head"), body = str(s, "body"), slogan = str(s, "slogan");
  const bodyW = photo && right ? 560 : x1 - x0;
  const imgH = photo && !right ? 300 : 0;
  const k = k0 * fit([[head, 54 * k0, 1.3, x1 - x0], [body, 32 * k0, 1.6, bodyW]], 126 + (slogan ? 80 : 0) + imgH + 40, y1 - y0);
  return (
    <>
      {photo && (right
        ? <Pic src={photoOf(c, s.photo)} x={640} y={560} w={400} h={480} pos={photoY(s)} radius={14} />
        : <Pic src={photoOf(c, s.photo)} x={x0} y={y1 - (slogan ? 80 : 0) - imgH} w={x1 - x0} h={imgH - 20} pos={photoY(s)} radius={14} />)}
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: y0 + 26, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 22 }}>
        {/* 기운 테이프의 모서리가 안전 영역 밖으로 나가지 않게 안쪽으로 */}
        <div style={{ display: "flex", paddingLeft: 14, maxWidth: x1 - x0 - 28 }}><TapeOn c={c} text={str(s, "tape")} dark={dark} size={58} /></div>
        <Rich c={c} text={head} size={Math.round(54 * k)} lh={1.3} weight={800} color={ink(c, dark)} hl={hl} />
        {body && <div style={{ display: "flex", width: bodyW, marginTop: 12 }}><Rich c={c} text={body} size={Math.round(32 * k)} lh={1.6} color={ink(c, dark)} hl={hl} /></div>}
      </div>
      {slogan && <span style={{ position: "absolute", left: x0, width: x1 - x0, bottom: 1350 - y1, fontSize: 46, fontWeight: 800, color: ink(c, dark), letterSpacing: -1, wordBreak: "break-all" }}>{slogan}</span>}
    </>
  );
}

function Items({ c, s }: SlideProps) {
  const [x0, y0, x1, y1] = SAFE.feed;
  const dark = isDark(s, "items"), hl = hlMode(c, pick(s, "items", "hl"));
  const items = (Array.isArray(s.items) ? s.items : []) as { label: string; sub: string; photo: unknown }[];
  const top = str(s, "top"), bottom = str(s, "bottom");
  // 항목이 많으면 그림을 낮게 (5개 = 3줄)
  const ph = items.length > 4 ? 84 : items.length > 2 ? 170 : 300;
  const cw = Math.floor((x1 - x0 - 30) / 2);
  return (
    <>
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: y0, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {top && <Rich c={c} text={top} size={32} weight={800} color={ink(c, dark)} align="center" hl={hl} />}
        <TapeOn c={c} text={str(s, "tape")} dark={dark} size={56} />
      </div>
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: y0 + 190, display: "flex", flexWrap: "wrap", columnGap: 30, rowGap: items.length > 4 ? 14 : 22 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", width: cw, gap: 6 }}>
            <span style={{ display: "flex", fontSize: 26, fontWeight: 500, ...(hl === "fill" ? { alignSelf: "flex-start", padding: "0 10px", borderRadius: 8, background: c.theme.accent, color: c.theme.onAccent } : { color: c.theme.accent }) }}>({String(i + 1).padStart(2, "0")})</span>
            <span style={{ fontSize: 30, fontWeight: 800, color: ink(c, dark), lineHeight: 1.25, wordBreak: "break-all" }}>{it.label}</span>
            {it.sub && <span style={{ fontSize: 22, fontWeight: 500, color: dark ? hexA(c.theme.light, 0.7) : c.theme.muted, wordBreak: "break-all" }}>{it.sub}</span>}
            {has(it.photo) && <div style={{ display: "flex", position: "relative", width: cw, height: ph, marginTop: 6 }}><Pic src={photoOf(c, it.photo)} x={0} y={0} w={cw} h={ph} radius={12} /></div>}
          </div>
        ))}
      </div>
      {bottom && <div style={{ position: "absolute", left: x0, width: x1 - x0, bottom: 1350 - y1, display: "flex" }}><Rich c={c} text={bottom} size={34} color={ink(c, dark)} align="center" hl={hl} /></div>}
    </>
  );
}

function Cta({ c, s }: SlideProps) {
  const [x0, y0, x1, y1] = SAFE.feed;
  const dark = isDark(s, "cta"), center = pick(s, "cta", "align") === "center";
  return (
    <div style={{ position: "absolute", left: x0, width: x1 - x0, top: y0, height: y1 - y0, display: "flex", flexDirection: "column", alignItems: center ? "center" : "flex-start", justifyContent: "center", gap: 30 }}>
      <TapeOn c={c} text={str(s, "tape")} dark={dark} size={56} />
      <Rich c={c} text={str(s, "big")} size={66} lh={1.22} weight={800} color={ink(c, dark)} align={center ? "center" : "left"} hl={pick(s, "cta", "hl")} />
      <AccentPill c={c} text={str(s, "pill")} size={30} />
    </div>
  );
}

export const POSTER = { cover: Cover, point: Point, items: Items, cta: Cta };
