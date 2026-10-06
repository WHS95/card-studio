"use client";

import { useState } from "react";
import { PHOTOS_MAX, VIDEO_DUR, type Field, type TextField } from "@/lib/fields";
import type { Photo, SlideData } from "@/lib/types";

type Rec = Record<string, unknown>;
const lines = (s: string) => s.split("\n").length;
export const thumbOf = (p: Photo) => (p.kind === "video" ? p.poster ?? "" : p.url);

export function TextInput({ f, v, onChange }: { f: TextField; v: unknown; onChange: (v: string) => void }) {
  const s = typeof v === "string" ? v : "";
  const max = f.lines ?? 1;
  const over = s.length > f.max || lines(s) > max;
  return (
    <label className="fld">
      <span>{f.label} <em style={over ? { color: "#111111", textDecoration: "underline" } : undefined}>{s.length}/{f.max}{max > 1 ? ` · ${lines(s)}/${max}줄` : ""}{f.optional ? " · 선택" : ""}</em></span>
      {max > 1
        ? <textarea className="input" rows={Math.min(max, 6)} value={s} onChange={(e) => onChange(e.target.value)} />
        : <input className="input" value={s} onChange={(e) => onChange(e.target.value.replace(/\n/g, ""))} />}
      {f.hint && <em>{f.hint}</em>}
      {f.rich && <em>**굵게** · ==강조== 로 낱말을 돋보이게 해요</em>}
    </label>
  );
}

export function FieldInput({ f, v, photos, onChange }: { f: Field; v: unknown; photos: Photo[]; onChange: (v: unknown) => void }) {
  if (f.type === "text") return <TextInput f={f} v={v} onChange={onChange} />;
  if (f.type === "toggle") return <label className="row small" style={{ fontWeight: 700 }}><input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} />{f.label}</label>;
  if (f.type === "choice") {
    const cur = typeof v === "string" && f.options.some((o) => o.v === v) ? v : f.default;
    return (
      <div className="fld">{f.label}
        <div className="seg" role="radiogroup" aria-label={f.label}>
          {f.options.map((o) => <button key={o.v} type="button" role="radio" aria-checked={cur === o.v} onClick={() => onChange(o.v)}>{o.label}</button>)}
        </div>
      </div>
    );
  }
  if (f.type === "number") {
    const n = typeof v === "number" ? v : f.min;
    return <label className="fld">{f.label} <em>{f.min}~{f.max}{f.unit ?? ""}</em><input className="input" type="number" min={f.min} max={f.max} step={f.step} value={n} onChange={(e) => onChange(Math.min(f.max, Math.max(f.min, Number(e.target.value) || 0)))} /></label>;
  }
  if (f.type === "photo") return (
    <div className="fld">{f.label}{f.video ? <em>사진·영상</em> : <em>사진만</em>}
      <div className="pics">
        <button type="button" aria-pressed={v === null || v === undefined} onClick={() => onChange(null)}>없음</button>
        {photos.map((p, i) => {
          const vid = p.kind === "video";
          if (vid && !f.video) return null;
          return (
            <button key={i} type="button" aria-pressed={v === i} onClick={() => onChange(i)} title={vid ? `영상 ${Math.round(p.duration ?? 0)}초` : `사진 ${i + 1}`}>
              <img src={thumbOf(p)} alt={`${vid ? "영상" : "사진"} ${i + 1}`} />{vid && <i className="play">▶</i>}
            </button>
          );
        })}
      </div>
    </div>
  );
  const items = Array.isArray(v) ? (v as Rec[]) : [];
  // 새 항목의 꼭 채울 글은 [칸 이름]으로 (빈 칸 하나로 미리보기·저장이 멈추지 않게)
  const blank = () => Object.fromEntries(f.item.map((x) => [x.key, x.type === "text" ? (x.optional ? "" : `[${x.label}]`.slice(0, x.max)) : x.type === "toggle" ? false : x.type === "choice" ? x.default : x.type === "number" ? x.min : null]));
  return (
    <div className="fld">{f.label} <em>{items.length}/{f.max}</em>
      <div className="items">
        {items.map((it, j) => (
          <div key={j} className="row" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {f.item.map((sub) => <FieldInput key={sub.key} f={sub} v={it[sub.key]} photos={photos} onChange={(nv) => onChange(items.map((x, k) => (k === j ? { ...x, [sub.key]: nv } : x)))} />)}
            </div>
            <span className="col">
              <button type="button" className="btn" aria-label="위로" disabled={j === 0} onClick={() => { const a = [...items]; [a[j - 1], a[j]] = [a[j], a[j - 1]]; onChange(a); }}>↑</button>
              <button type="button" className="btn" disabled={items.length <= f.min} onClick={() => onChange(items.filter((_, k) => k !== j))}>빼기</button>
            </span>
          </div>
        ))}
        <button type="button" className="btn" disabled={items.length >= f.max} onClick={() => onChange([...items, blank()])}>+ {f.label}</button>
      </div>
    </div>
  );
}

/** 영상 장: 시작·길이(3~60초)·소리 */
export function VideoTune({ s, video, onChange, max = VIDEO_DUR.max }: { s: SlideData; video: Photo; onChange: (patch: Rec) => void; max?: number }) {
  const total = video.duration ?? VIDEO_DUR.min;
  const start = typeof s.videoStart === "number" ? s.videoStart : 0;
  const maxDur = Math.max(VIDEO_DUR.min, Math.min(max, Math.floor((total - start) * 10) / 10));
  const dur = typeof s.videoDur === "number" ? s.videoDur : Math.min(VIDEO_DUR.default, total);
  return (
    <div className="tune">
      <label className="fld">영상 시작 {start.toFixed(1)}초 <em>전체 {total.toFixed(1)}초</em>
        <input type="range" min={0} max={Math.max(0, total - VIDEO_DUR.min)} step={0.1} value={start}
          onChange={(e) => { const st = Number(e.target.value); onChange({ videoStart: st, videoDur: Math.min(dur, Math.floor((total - st) * 10) / 10) }); }} /></label>
      <label className="fld">길이 {dur.toFixed(1)}초 <em>{max > VIDEO_DUR.max ? "릴스" : "인스타 한 장"} {VIDEO_DUR.min}~{max}초</em>
        <input type="range" min={VIDEO_DUR.min} max={maxDur} step={0.1} value={Math.min(dur, maxDur)} onChange={(e) => onChange({ videoDur: Number(e.target.value) })} /></label>
      <label className="row small" style={{ fontWeight: 700 }}><input type="checkbox" checked={s.videoMute === true} onChange={(e) => onChange({ videoMute: e.target.checked })} />소리 빼기</label>
    </div>
  );
}

/** 올리기: 본문 그대로 PUT (진행률 표시). 사진 8MB·영상 300MB */
function upload(ws: string, file: File, onProgress: (p: number) => void): Promise<{ photo?: Photo; error?: string }> {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open("PUT", `/api/upload/${ws}`);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    x.onload = () => { try { resolve(JSON.parse(x.responseText)); } catch { resolve({ error: "올리지 못했어요" }); } };
    x.onerror = () => resolve({ error: "올리지 못했어요" });
    x.send(file);
  });
}

/** 사진·영상: 무료 사진 주소(+출처) 또는 직접 올리기(사진·영상). 무료 사진은 내려받지 않고 주소로만 */
export function Media({ ws, photos, onChange, veo = false }: { ws: string; photos: Photo[]; onChange: (p: Photo[], removed?: number) => void; veo?: boolean }) {
  const [url, setUrl] = useState("");
  const [credit, setCredit] = useState("");
  const [msg, setMsg] = useState("");
  const full = photos.length >= PHOTOS_MAX;
  const add = () => {
    let u: URL;
    try { u = new URL(url); } catch { return setMsg("주소가 맞지 않아요"); }
    if (u.protocol !== "https:") return setMsg("https 주소만 돼요");
    if (/unsplash\.com\/photos\//.test(url)) return setMsg("Unsplash는 사진 페이지가 아니라 이미지 주소(images.unsplash.com/…)를 넣어 주세요");
    const src = /unsplash\.com/.test(u.hostname) ? "Unsplash" : u.hostname;
    onChange([...photos, { url: url.replace(/fm=webp/, "fm=jpg"), credit: credit.trim().slice(0, 60), source: src, kind: "image" }]);
    setUrl(""); setCredit(""); setMsg("");
  };
  const pick = async (files: FileList | null) => {
    let list = [...photos];
    for (const file of Array.from(files ?? []).slice(0, PHOTOS_MAX - photos.length)) {
      setMsg(`${file.name} 올리는 중 0%`);
      const r = await upload(ws, file, (p) => setMsg(`${file.name} 올리는 중 ${p}%${p === 100 ? " · 확인 중" : ""}`));
      if (r.error || !r.photo) return setMsg(r.error ?? "올리지 못했어요");
      list = [...list, r.photo];
      onChange(list);
    }
    setMsg("");
  };
  return (
    <div className="block">
      <div className="bh"><strong>사진·영상 {photos.length}/{PHOTOS_MAX}</strong><span className="small muted">장마다 아래에서 골라 써요 · 영상은 직접 올린 것만</span></div>
      {photos.map((p, i) => (
        <div key={i} className="photo-row">
          <span className="thumb"><img src={thumbOf(p)} alt="" />{p.kind === "video" && <i className="play">▶ {Math.round(p.duration ?? 0)}초</i>}</span>
          <input className="input" placeholder="출처 (예: 촬영자 이름)" value={p.credit} onChange={(e) => onChange(photos.map((x, j) => (j === i ? { ...x, credit: e.target.value.slice(0, 60) } : x)))} />
          <button type="button" className="btn" onClick={() => onChange(photos.filter((_, j) => j !== i), i)}>빼기</button>
        </div>
      ))}
      <div className="row">
        <input className="input" style={{ flex: 2, minWidth: 200 }} placeholder="무료 사진 주소 (https://images.unsplash.com/…)" value={url} onChange={(e) => setUrl(e.target.value)} disabled={full} />
        <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="출처" value={credit} onChange={(e) => setCredit(e.target.value)} disabled={full} />
        <button type="button" className="btn" onClick={add} disabled={full || !url}>더하기</button>
        <label className="btn" style={full ? { opacity: .4 } : undefined}>직접 올리기<input type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime" multiple hidden disabled={full} onChange={(e) => { pick(e.target.files); e.target.value = ""; }} /></label>
      </div>
      {msg && <p className={/중/.test(msg) ? "small" : "err"} style={{ margin: 0 }}>{msg}</p>}
      <VeoBox ws={ws} enabled={veo} photos={photos} full={full} onDone={(p) => onChange([...photos, p])} />
    </div>
  );
}

const VEO_MODELS = [["veo-3.1-lite-generate-preview", "Lite (싸고 빠름)"], ["veo-3.1-fast-generate-preview", "Fast"], ["veo-3.1-generate-preview", "기본 (가장 좋음)"]] as const;
const VEO_MODES = [
  ["text", "글로만", "설명만으로 만들어요"],
  ["image", "첫 장면 사진", "올린 사진에서 시작해 움직여요"],
  ["frames", "처음·끝 사진", "두 사진 사이를 이어 움직여요 · 8초 · Fast·기본"],
  ["reference", "참고 사진", "제품·인물·장소 모습을 유지해요 (최대 3장) · 8초 · Fast·기본"],
  ["extend", "이어 붙이기", "Veo 로 만든 영상 뒤에 7초 더 · 만든 지 2일 안 · 720p · Fast·기본"],
] as const;
type VeoMode = (typeof VEO_MODES)[number][0];

/** AI 영상 (Google Veo): 방식을 골라 글(+사진)로 → MP4 (소리 포함) → 이 게시물 사진·영상에 더해진다. 1~3분쯤 걸린다 */
function VeoBox({ ws, enabled, photos, full, onDone }: { ws: string; enabled: boolean; photos: Photo[]; full: boolean; onDone: (p: Photo) => void }) {
  const [mode, setMode] = useState<VeoMode>("text");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(VEO_MODELS[0][0]);
  const [aspect, setAspect] = useState<"9:16" | "16:9">("9:16");
  const [duration, setDuration] = useState(8);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const [ext, setExt] = useState("");
  const [extOk, setExtOk] = useState<string[] | null>(null);
  const [state, setState] = useState<{ busy: boolean; msg: string; err?: boolean }>({ busy: false, msg: "" });
  const frames = photos.filter((p) => p.kind !== "video" && p.url.startsWith(`/uploads/${ws}/`));
  const veoVideos = photos.filter((p) => p.kind === "video" && p.source === "Google Veo");
  const heavy = mode === "frames" || mode === "reference" || mode === "extend";
  const pickMode = async (m: VeoMode) => {
    setMode(m);
    if (m === "frames" || m === "reference" || m === "extend") { setDuration(8); if (model.includes("lite")) setModel(VEO_MODELS[1][0]); }
    if (m === "extend") {
      const r = await fetch(`/api/veo/${ws}?extendable=${encodeURIComponent(veoVideos.map((v) => v.url).join(","))}`).then((x) => x.json()).catch(() => ({ urls: [] }));
      setExtOk(r.urls ?? []); setExt(r.urls?.[0] ?? "");
    }
  };
  const label = (u: string) => `${photos.findIndex((p) => p.url === u) + 1}번`;
  const ready = prompt.trim().length >= 5 && (mode === "text" || (mode === "image" && first) || (mode === "frames" && first && last) || (mode === "reference" && refs.length > 0) || (mode === "extend" && ext));
  if (!enabled) return <p className="small muted" style={{ margin: 0 }}>AI 영상(Veo): 운영자가 &apos;AI 연동&apos;에서 Gemini 키를 넣으면 여기서 글로 영상을 만들 수 있어요.</p>;
  const go = async () => {
    setState({ busy: true, msg: "시작하는 중" });
    const body = { prompt, mode, model, aspect, duration, firstFrame: first || undefined, lastFrame: last || undefined, references: mode === "reference" ? refs : undefined, extendFrom: mode === "extend" ? ext : undefined };
    const r = await fetch(`/api/veo/${ws}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({ error: "시작하지 못했어요" }));
    if (!r.ok || !j.job) return setState({ busy: false, msg: j.error ?? "시작하지 못했어요", err: true });
    setState({ busy: true, msg: j.message });
    for (;;) {
      await new Promise((res) => setTimeout(res, 5000));
      const s = await fetch(`/api/veo/${ws}?job=${j.job}`).then((x) => x.json()).catch(() => null);
      if (!s) continue;
      if (s.status === "running") { setState({ busy: true, msg: s.message }); continue; }
      if (s.status === "error") return setState({ busy: false, msg: s.message, err: true });
      onDone(s.photo);
      return setState({ busy: false, msg: "영상을 더했어요. 영상 가능한 사진 칸에서 골라 쓰세요 (캡션 출처에 'AI 생성'이 붙어요)" });
    }
  };
  const photoSelect = (value: string, set: (v: string) => void, title: string) => (
    <label className="fld">{title}<select className="input" value={value} onChange={(e) => set(e.target.value)}><option value="">고르기</option>{frames.map((p) => <option key={p.url} value={p.url}>{label(p.url)} 사진</option>)}</select></label>
  );
  return (
    <details>
      <summary className="small" style={{ fontWeight: 700, cursor: "pointer" }}>AI 영상 만들기 (Google Veo)</summary>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        <div className="fld">만드는 방식
          <div className="seg" role="radiogroup" aria-label="만드는 방식">{VEO_MODES.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => pickMode(v)}>{l}</button>)}</div>
          <em>{VEO_MODES.find((m) => m[0] === mode)![2]}</em>
        </div>
        {(mode === "image" || mode === "frames") && (frames.length ? <div className="row">{photoSelect(first, setFirst, "첫 장면")}{mode === "frames" && photoSelect(last, setLast, "끝 장면")}</div> : <p className="small muted" style={{ margin: 0 }}>먼저 위 &apos;직접 올리기&apos;로 사진을 올려 주세요.</p>)}
        {mode === "reference" && (frames.length ? (
          <div className="fld">참고 사진 <em>{refs.length}/3 · 제품·인물·장소처럼 모습이 유지돼야 하는 것</em>
            <div className="row">{frames.map((p) => (
              <label key={p.url} className="chip"><input type="checkbox" checked={refs.includes(p.url)} disabled={!refs.includes(p.url) && refs.length >= 3} onChange={(e) => setRefs(e.target.checked ? [...refs, p.url] : refs.filter((u) => u !== p.url))} />{label(p.url)} 사진</label>
            ))}</div>
          </div>) : <p className="small muted" style={{ margin: 0 }}>먼저 위 &apos;직접 올리기&apos;로 사진을 올려 주세요.</p>)}
        {mode === "extend" && (extOk === null ? <span className="small">확인하는 중</span> : extOk.length ? (
          <label className="fld">이어 붙일 영상<select className="input" value={ext} onChange={(e) => setExt(e.target.value)}>{extOk.map((u) => <option key={u} value={u}>{label(u)} 영상 (Veo)</option>)}</select></label>
        ) : <p className="small muted" style={{ margin: 0 }}>이어 붙일 수 있는 영상이 없어요. 이 게시물에서 Veo 로 만든 지 2일 안의 영상만 돼요.</p>)}
        <label className="fld">{mode === "extend" ? "이어서 무슨 일이 일어나는지" : "어떤 영상인지"} <em>장면·움직임·카메라·분위기를 구체적으로 (영어도 돼요)</em>
          <textarea className="input" rows={3} maxLength={1500} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="예: 아침 햇살이 드는 카페 카운터에서 바리스타가 핸드드립을 내리는 손, 김이 피어오름, 천천히 다가가는 카메라" /></label>
        <div className="row">
          <label className="fld">모델<select className="input" value={model} onChange={(e) => setModel(e.target.value)}>{VEO_MODELS.map(([v, l]) => <option key={v} value={v} disabled={heavy && v.includes("lite")}>{l}</option>)}</select></label>
          <label className="fld">비율 <em>4:5 카드엔 9:16 이 덜 잘려요</em><select className="input" value={aspect} onChange={(e) => setAspect(e.target.value as "9:16" | "16:9")}><option value="9:16">9:16 세로</option><option value="16:9">16:9 가로</option></select></label>
          <div className="fld">길이<div className="seg">{[4, 6, 8].map((d) => <button key={d} type="button" aria-checked={duration === d} role="radio" disabled={heavy && d !== 8} onClick={() => setDuration(d)}>{d}초</button>)}</div></div>
        </div>
        <div className="row">
          <button type="button" className="btn primary" disabled={state.busy || full || !ready} onClick={go}>{state.busy ? "만드는 중…" : "영상 만들기"}</button>
          {state.msg && <span className={state.err ? "err" : "small"}>{state.msg}</span>}
        </div>
        <span className="small muted">요금이 나가는 기능이에요 (요금제의 한 달 영상 수로 막아요). 실제 사람·브랜드를 흉내 내지 말고, 인스타에 올릴 땐 &apos;AI 정보&apos; 표시를 켜요.</span>
      </div>
    </details>
  );
}
