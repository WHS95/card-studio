import { choice } from "../fields";
import { reel } from "../templates/reel";
import { Pic, Rich, SAFE, fit, has, hexA, photoOf, photoY, scale, str, type SlideProps } from "./kit";

// 릴스 렌더러 (1080×1920). 영상 자리는 영상 합성 때 비워 두고(videoHole), 자막은 c.sub 번째만 그린다.
// 판 색은 장 바탕(renderSlide 의 bg)이라, 마진 계산 때도 판 위 글이 바탕과 구별된다.

const K = reel.kinds[0];
const pick = (s: SlideProps["s"], key: string) => choice(s, K.fields.find((f) => f.key === key && f.type === "choice") as never);
export type Sub = { at: number; t: string };
export const subsOf = (s: SlideProps["s"]): Sub[] => ((Array.isArray(s.subs) ? s.subs : []) as Sub[]).filter((x) => x && typeof x.t === "string").sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
/** 위 판 높이 (px) — 배치가 영상 가득이면 0 */
export const panelOf = (s: SlideProps["s"]) => (pick(s, "layout") === "full" ? 0 : Math.round((1920 * Number(pick(s, "panel"))) / 100));

function Reel({ c, s }: SlideProps) {
  const [x0, y0, x1, y1] = SAFE.reel;
  const w = x1 - x0, k0 = scale(pick(s, "size")), hl = pick(s, "hl");
  const panel = panelOf(s);
  const bg = pick(s, "bg");
  const ink = bg === "dark" ? c.theme.light : bg === "accent" ? c.theme.onAccent : c.theme.ink;
  const subs = subsOf(s);
  const sub = c.sub >= 0 ? subs[c.sub]?.t ?? "" : "";
  const title = str(s, "title");
  const src = photoOf(c, s.photo);
  if (panel) {
    const logo = has(s.logo);
    const textTop = logo ? Math.max(y0 + 240, panel - 300) : y0;
    const k = k0 * fit([[title, 40 * k0, 1.3, w], [sub, 58 * k0, 1.25, w]], 40, panel - 40 - textTop);
    return (
      <>
        {/* 아래 영상 (사진이면 사진) */}
        {src && <Pic src={src} x={0} y={panel} w={1080} h={1920 - panel} pos={photoY(s)} />}
        {!src && !c.debug && <div style={{ position: "absolute", left: 0, top: panel, width: 1080, height: 1920 - panel, background: hexA(c.theme.dark, 0.9) }} />}
        {logo && <Pic src={photoOf(c, s.logo)} x={x0 + 140} y={y0} w={w - 280} h={Math.max(120, textTop - y0 - 30)} fit="contain" />}
        <div style={{ position: "absolute", left: x0, width: w, top: textTop, height: panel - 40 - textTop, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 14 }}>
          {title && <Rich c={c} text={title} size={Math.round(40 * k)} lh={1.3} weight={500} color={ink} align="center" hl={hl} />}
          {sub && <Rich c={c} text={sub} size={Math.round(58 * k)} lh={1.25} weight={800} color={ink} align="center" hl={hl} />}
        </div>
      </>
    );
  }
  // 영상 가득: 제목은 위, 자막은 아래 (읽히게 어두운 상자). 상자 폭은 고정 — 내용 폭 상자 안 100% 글은 satori 가 멈춘다
  const k = k0 * fit([[sub, 56 * k0, 1.25, w - 60]], 40, 420);
  const box = { padding: "16px 28px", borderRadius: 18, background: hexA(c.theme.dark, 0.62) };
  return (
    <>
      {src && <Pic src={src} x={0} y={0} w={1080} h={1920} pos={photoY(s)} />}
      {title && <div style={{ position: "absolute", left: x0, width: w, top: y0, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", width: "100%", ...box }}><Rich c={c} text={title} size={Math.round(46 * k0)} lh={1.25} weight={800} color={c.theme.light} align="center" hl={hl} /></div>
      </div>}
      {sub && <div style={{ position: "absolute", left: x0, width: w, bottom: 1920 - y1, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", width: "100%", ...box }}><Rich c={c} text={sub} size={Math.round(56 * k)} lh={1.25} weight={800} color={c.theme.light} align="center" hl={hl} /></div>
      </div>}
    </>
  );
}

export const REEL = { reel: Reel };
