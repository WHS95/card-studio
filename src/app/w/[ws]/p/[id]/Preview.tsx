"use client";

import { useEffect, useState } from "react";

// 미리보기 위에 겹치는 '인스타에서 가려지는 영역'. 숫자는 1080×1350(릴스 1080×1920) 기준 (src/lib/render/kit.tsx SAFE 와 같음)
const W = 1080;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
export type Fmt = "feed" | "reel";
const HOF = { feed: 1350, reel: 1920 } as const;
export const ZONES = {
  grid: 33.75, // 프로필 그리드 3:4 → 좌우 약 34px씩 잘림 (표지만)
  cover: [175, 175, 905, 1175],
  feed: [60, 175, 1020, 1175],
  reel: [60, 250, 940, 1540],
  reelGrid: 240, // 릴스도 프로필 그리드에서 3:4 로 잘림 → 위아래 약 240px
} as const;
// 인스타 화면 요소 위치 (기기마다 조금씩 달라서 '대략')
const UI = {
  counter: [930, 36, 1046, 104],
  tag: [32, 1244, 112, 1324],
  sound: [968, 1244, 1048, 1324],
} as const;
// 릴스 화면 요소 (대략): 위 머리글 · 오른쪽 버튼 · 아래 계정·캡션
const REEL_UI = {
  head: [0, 0, 1080, 200],
  buttons: [950, 980, 1070, 1720],
  caption: [30, 1580, 920, 1900],
} as const;

export type Layers = { grid: boolean; safe: boolean; ui: boolean };
export type Check = { n: number; zone: "cover" | "feed" | "reel"; outside: number; ok: boolean };

function Box({ r, label, cls, H = 1350 }: { r: readonly number[]; label?: string; cls: string; H?: number }) {
  const [x0, y0, x1, y1] = r;
  return <div className={`ov ${cls}`} style={{ left: pct(x0, W), top: pct(y0, H), width: pct(x1 - x0, W), height: pct(y1 - y0, H) }}>{label && <em>{label}</em>}</div>;
}

/** 한 장 위 겹침 */
export function Overlay({ n, total, layers, video, big, fmt = "feed" }: { n: number; total: number; layers: Layers; video: boolean; big?: boolean; fmt?: Fmt }) {
  const cover = n === 0;
  if (fmt === "reel") {
    const H = HOF.reel;
    return (
      <div className={`ovs${big ? " big" : ""}`} aria-hidden>
        {layers.grid && <>
          <div className="ov crop" style={{ left: 0, top: 0, width: "100%", height: pct(ZONES.reelGrid, H) }} />
          <div className="ov crop" style={{ left: 0, bottom: 0, width: "100%", height: pct(ZONES.reelGrid, H) }} />
        </>}
        {layers.safe && <Box r={ZONES.reel} H={H} cls="safe" label={big ? "릴스 안전 영역 (대략)" : undefined} />}
        {layers.ui && <>
          <Box r={REEL_UI.head} H={H} cls="ui" label={big ? "머리글" : undefined} />
          <Box r={REEL_UI.buttons} H={H} cls="ui" label={big ? "버튼" : undefined} />
          <Box r={REEL_UI.caption} H={H} cls="ui" label={big ? "계정·캡션" : undefined} />
        </>}
      </div>
    );
  }
  return (
    <div className={`ovs${big ? " big" : ""}`} aria-hidden>
      {layers.grid && cover && <>
        <div className="ov crop" style={{ left: 0, top: 0, width: pct(ZONES.grid, W), height: "100%" }} />
        <div className="ov crop" style={{ right: 0, top: 0, width: pct(ZONES.grid, W), height: "100%" }} />
      </>}
      {layers.safe && <Box r={cover ? ZONES.cover : ZONES.feed} cls="safe" label={big ? (cover ? "표지 안전 영역 (그리드 3:4 기준, 넉넉하게)" : "안쪽 장 안전 영역") : undefined} />}
      {layers.ui && <>
        {total > 1 && <Box r={UI.counter} cls="ui" label={big ? `${n + 1}/${total}` : undefined} />}
        <Box r={UI.tag} cls="ui" label={big ? "태그" : undefined} />
        {video && <Box r={UI.sound} cls="ui" label={big ? "소리" : undefined} />}
      </>}
    </div>
  );
}

export function LayerToggles({ layers, onChange }: { layers: Layers; onChange: (l: Layers) => void }) {
  const t = (k: keyof Layers, label: string, title: string) => (
    <button type="button" className={`chip${layers[k] ? " on" : ""}`} aria-pressed={layers[k]} title={title} onClick={() => onChange({ ...layers, [k]: !layers[k] })}>{label}</button>
  );
  return <div className="ed-layers" role="group" aria-label="겹쳐 보기">{t("safe", "안전 영역", "글·장식을 이 안에 두면 가려지지 않아요")}{t("grid", "그리드 3:4", "프로필 그리드에서 잘리는 부분 (표지)")}{t("ui", "인스타 UI", "인스타 화면 요소 자리 (대략)")}</div>;
}

/** 크게 보기: 인스타 피드 모양 + 겹침 + 영상 미리보기 */
export function Modal({ handle, imgs, n, total, caption, layers, setLayers, isVideo, renderVideo, onClose, onMove, fmt = "feed" }: {
  fmt?: Fmt; handle: string; imgs: Record<number, string>; n: number; total: number; caption: string; layers: Layers; setLayers: (l: Layers) => void;
  isVideo: (n: number) => boolean; renderVideo: (n: number) => Promise<string | null>; onClose: () => void; onMove: (n: number) => void;
}) {
  const [vid, setVid] = useState<{ n: number; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowLeft" && n > 0) onMove(n - 1); if (e.key === "ArrowRight" && n < total - 1) onMove(n + 1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [n, total, onClose, onMove]);
  const play = async () => { setBusy(true); const u = await renderVideo(n); setBusy(false); if (u) setVid({ n, url: u }); };
  const showVid = vid && vid.n === n;
  return (
    <div className="modal ed-modal" role="dialog" aria-modal aria-label={`크게 보기 ${n + 1}/${total}`} onClick={onClose}>
      <div className="ed-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ed-mhead">
          <b>크게 보기 · {n + 1}/{total}</b>
          <LayerToggles layers={layers} onChange={setLayers} />
          <button type="button" className="btn" onClick={onClose}>닫기 Esc</button>
        </div>
        <div className="ed-mbody">
          <button type="button" className="btn ed-mnav" aria-label="이전 장" disabled={n === 0} onClick={() => onMove(n - 1)}>←</button>
          <div className="igpost">
            <div className="ighead"><span className="av" /><b>{handle.replace(/^@/, "") || "account"}</b></div>
            <div className="igmedia" data-fmt={fmt}>
              {showVid ? <video src={vid.url} controls autoPlay playsInline style={{ width: "100%", display: "block" }} />
                : imgs[n] ? <img src={imgs[n]} alt={`${n + 1}번째 장`} /> : <div className="wait">그리는 중</div>}
              <Overlay n={n} total={total} layers={layers} video={isVideo(n)} big fmt={fmt} />
            </div>
            <div className="dots">{Array.from({ length: total }, (_, i) => <span key={i} className={i === n ? "on" : ""} />)}</div>
            <p className="igcap"><b>{handle.replace(/^@/, "")}</b> {more || caption.length <= 125 ? caption : <>{caption.slice(0, 125)}… <button onClick={() => setMore(true)}>더 보기</button></>}</p>
          </div>
          <button type="button" className="btn ed-mnav" aria-label="다음 장" disabled={n >= total - 1} onClick={() => onMove(n + 1)}>→</button>
        </div>
        {isVideo(n) && <div className="ed-row ed-mplay"><button type="button" className="btn" onClick={play} disabled={busy}>{busy ? "영상 만드는 중 (수십 초)" : showVid ? "영상 다시 만들기" : "▶ 영상으로 보기"}</button><span>글 + 영상을 합친 실제 MP4예요</span></div>}
        <p className="ed-mfoot">영상 장이면 여기서 재생돼요 · ←/→ 로 장 넘기기 · &apos;더 보기&apos; 위치는 기기마다 조금 달라요 (약 125자·2줄)</p>
      </div>
    </div>
  );
}
