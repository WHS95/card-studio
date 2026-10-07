"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PHOTO_H, formatOf, slideVideo, validatePost, type Field, type SlideKind } from "@/lib/fields";
import { TEMPLATES, templateOf } from "@/lib/templates";
import { NEXT_STATUS, STATUS_LABEL, type ContentRules, type Photo, type Post, type PostData, type SlideData } from "@/lib/types";
import { ruleWarnings } from "@/lib/rules";
import { aiDraftAction, savePostAction, setStatusAction, type SaveState } from "../../../../actions";
import { FieldInput, Media, VideoTune } from "./Parts";
import { LayerToggles, Modal, Overlay, type Check, type Layers } from "./Preview";
import AskAi from "../../../../AskAi";
import { copyText } from "@/lib/client/copy";
import Icon from "../../../../ui/Icon";
import Manage from "./Manage";
import MetricsForm from "./MetricsForm";

type Ws = { id: string; handle: string; categories: string[]; slots: string[]; startDate: string | null; hashtags: string[]; cta: string; ai: boolean; veo: boolean; canEdit: boolean; canApprove: boolean; rules?: ContentRules; defaultTemplate: string };
type Rec = Record<string, unknown>;

/** 사진을 빼면 장마다 가리키던 번호를 고친다 (빠진 사진 → 없음, 뒤 번호 → 하나 앞으로) */
function shiftPhotos(fields: Field[], obj: Rec, removed: number): Rec {
  const out: Rec = { ...obj };
  for (const f of fields) {
    if (f.type === "photo" && typeof out[f.key] === "number") { const v = out[f.key] as number; out[f.key] = v === removed ? null : v > removed ? v - 1 : v; }
    if (f.type === "items" && Array.isArray(out[f.key])) out[f.key] = (out[f.key] as Rec[]).map((it) => shiftPhotos(f.item, it, removed));
  }
  return out;
}

/** 새 장의 꼭 채울 글 칸이 비어 있으면 [칸 이름]으로 채운다 — 빈 장 하나 때문에 전체 미리보기·저장이 멈추지 않게 */
function withPlaceholders(fields: Field[], obj: Rec): Rec {
  const out: Rec = { ...obj };
  for (const f of fields) {
    if (f.type === "text" && !f.optional && !String(out[f.key] ?? "").trim()) out[f.key] = `[${f.label.replace(/\s*\(.*\)$/, "")}]`.slice(0, f.max);
    if (f.type === "items" && Array.isArray(out[f.key])) out[f.key] = (out[f.key] as Rec[]).map((it) => withPlaceholders(f.item, it));
  }
  return out;
}

const HASHTAG_MAX = 30;
const clock = () => Date.now(); // 이벤트 안에서만 부른다
const tags = (s: string) => s.match(/#[^\s#]+/g) ?? [];

/** empty = 옮기거나 복제할 수 있는 빈 칸 (null 이면 게시물 관리 숨김: 보관함에 있거나 편집 권한 없음) */
export default function Editor({ ws, post, empty }: { ws: Ws; post: Post; empty: string[] | null }) {
  const [sel, setSel] = useState(0); // 가운데에서 고치는 장
  const [template, setTemplate] = useState(post.template);
  const t = templateOf(template);
  const fmt = formatOf(t);
  const [title, setTitle] = useState(post.title);
  const [category, setCategory] = useState(post.category);
  const [data, setData] = useState<PostData>(() => post.data ?? t.draft({ title: post.title, category: post.category, handle: ws.handle }));
  const [dirty, setDirty] = useState(!post.data);
  // 마지막으로 저장된 모양 (되돌려서 저장한 때와 같아지면 '저장됨'으로)
  const savedSnap = useRef(post.data ? [post.template, post.title, post.category, JSON.stringify(post.data)].join("\n") : "");
  const [hist, setHist] = useState<{ past: PostData[]; future: PostData[] }>({ past: [], future: [] });
  const lastPush = useRef(0);
  const err = useMemo(() => validatePost(t, data), [t, data]);
  const kindOf = useCallback((k: string) => t.kinds.find((x) => x.kind === k) as SlideKind, [t]);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, save, saving] = useActionState(async (prev: SaveState, fd: FormData) => {
    const r = await savePostAction(prev, fd);
    if (r?.ok) { setDirty(false); savedSnap.current = ["template", "title", "category", "data"].map((k) => String(fd.get(k) ?? "")).join("\n"); }
    return r;
  }, undefined);

  /** 고치기 + 되돌리기 기록 (같은 칸을 연달아 칠 때는 0.8초 안이면 한 번으로) */
  const edit = (fn: (d: PostData) => PostData) => {
    if (!ws.canEdit) return; // 검수자는 보기만
    const now = clock();
    if (now - lastPush.current > 800) setHist((h) => ({ past: [...h.past.slice(-49), data], future: [] }));
    else setHist((h) => ({ ...h, future: [] }));
    lastPush.current = now;
    setData((d) => fn(structuredClone(d)));
    setDirty(true);
  };
  const isDirty = (d: PostData) => [template, title, category, JSON.stringify(d)].join("\n") !== savedSnap.current;
  const undo = () => {
    if (!hist.past.length) return;
    setHist({ past: hist.past.slice(0, -1), future: [data, ...hist.future] });
    const d = hist.past[hist.past.length - 1];
    setData(d); setDirty(isDirty(d)); lastPush.current = 0;
  };
  const redo = () => {
    if (!hist.future.length) return;
    setHist({ past: [...hist.past, data], future: hist.future.slice(1) });
    setData(hist.future[0]); setDirty(isDirty(hist.future[0])); lastPush.current = 0;
  };
  const setSlide = (i: number, patch: Rec) => edit((d) => { d.slides[i] = { ...d.slides[i], ...patch }; return d; });

  // ⌘S 저장 · ⌘Z 되돌리기 · ⇧⌘Z 다시 · 저장 안 하고 나가면 묻기
  const keys = useRef({ undo, redo, save: () => {} });
  useEffect(() => { keys.current = { undo, redo, save: () => { if (!err && !saving) formRef.current?.requestSubmit(); } }; });
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const inText = (e.target as HTMLElement)?.matches?.("input, textarea");
      if (e.key === "s") { e.preventDefault(); keys.current.save(); }
      else if (e.key === "z" && !inText) { e.preventDefault(); if (e.shiftKey) keys.current.redo(); else keys.current.undo(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    // 화면 안 링크(← 달력, 위 탭)로 나갈 때도 묻는다
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.href.includes("/api/") || e.metaKey || e.ctrlKey) return;
      if (!confirm("저장하지 않은 고침이 있어요. 나갈까요?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", h);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", h); document.removeEventListener("click", click, true); };
  }, [dirty]);

  const videoAt = useCallback((n: number): Photo | null => { const s = data.slides[n]; const k = s && kindOf(s.kind); return k ? slideVideo(k.fields, s, data.photos) : null; }, [data, kindOf]);

  // 실시간 미리보기: 바뀐 장만 다시 그린다 (장 내용 + 사진 + 순서가 같으면 그대로)
  const [imgs, setImgs] = useState<Record<number, string>>({});
  const cache = useRef(new Map<string, string>());
  useEffect(() => {
    if (err) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      data.slides.forEach((s, n) => {
        const key = JSON.stringify([template, n, data.slides.length, s, data.photos]);
        const hit = cache.current.get(key);
        if (hit) { setImgs((m) => ({ ...m, [n]: hit })); return; }
        fetch("/api/render", { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ ws: ws.id, template, data, n }) })
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => { if (!b) return; const u = URL.createObjectURL(b); cache.current.set(key, u); setImgs((m) => ({ ...m, [n]: u })); })
          .catch(() => {});
      });
    }, 350);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [data, template, err, ws.id]);

  // 인스타 마진 계산: 사진을 뺀 글·장식이 안전 영역 밖으로 나갔는지 (서버에서 픽셀로 센다)
  const [checks, setChecks] = useState<Check[] | null>(null);
  useEffect(() => {
    if (err) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/render", { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ ws: ws.id, template, data, mode: "check" }) })
        .then((r) => (r.ok ? r.json() : null)).then((j) => j && setChecks(j.slides)).catch(() => {});
    }, 900);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [data, template, err, ws.id]);

  const renderVideo = async (n: number) => {
    const r = await fetch("/api/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ws: ws.id, template, data, n, mode: "video" }) });
    if (!r.ok) { alert(await r.text()); return null; }
    return URL.createObjectURL(await r.blob());
  };

  const [layers, setLayers] = useState<Layers>({ grid: false, safe: false, ui: false });
  const [open, setOpen] = useState<number | null>(null);

  const credits = data.photos.filter((p) => p.credit).map((p) => `${p.credit}${p.source ? ` (${p.source})` : ""}`);
  const fullCaption = data.caption + (credits.length ? `\n\n사진: ${credits.join(", ")}` : "");
  const tagCount = tags(data.caption).length;
  const [copied, setCopied] = useState(false);
  const copy = async () => { setCopied((await copyText(fullCaption)) ? true : (alert("이 브라우저에서는 복사가 막혀 있어요. 캡션 칸에서 직접 선택해 복사해 주세요."), false)); setTimeout(() => setCopied(false), 1500); };

  const switchTemplate = (id: string) => {
    if (id === template) return;
    if (!confirm("템플릿을 바꾸면 지금 장 내용이 새 틀의 기본 문구로 바뀌어요. 사진과 캡션은 그대로예요. (⌘Z로 되돌릴 수 없어요)")) return;
    const next = templateOf(id).draft({ title, category, handle: ws.handle });
    setTemplate(id);
    setData({ ...next, photos: data.photos, caption: data.caption });
    setHist({ past: [], future: [] });
    setSel(0);
    setDirty(true);
  };

  const last = data.slides.length - 1;
  const cur = Math.max(0, Math.min(sel, last));
  const move = (i: number, by: number) => { edit((d) => { const j = i + by; [d.slides[i], d.slides[j]] = [d.slides[j], d.slides[i]]; return d; }); setSel(i + by); };
  const canMove = (i: number, by: number) => { const j = i + by; return j >= 0 && j < data.slides.length && !kindOf(data.slides[i].kind)?.fixed && !kindOf(data.slides[j].kind)?.fixed; };
  const duplicate = (i: number) => { edit((d) => { d.slides.splice(i + 1, 0, structuredClone(d.slides[i])); return d; }); setSel(i + 1); };
  const remove = (i: number) => { edit((d) => { d.slides.splice(i, 1); return d; }); setSel(Math.max(0, Math.min(i, last - 1))); };
  const addRef = useRef<HTMLDetailsElement>(null);
  const addKind = (k: SlideKind) => {
    const lastK = kindOf(data.slides[last].kind);
    // 마무리 장이 맨 끝이면 그 앞에 넣는다
    const at = last > 0 && lastK === t.kinds[t.kinds.length - 1] && k !== lastK ? last : data.slides.length;
    edit((d) => { d.slides.splice(at, 0, withPlaceholders(k.fields, k.blank()) as SlideData); return d; });
    setSel(at);
    if (addRef.current) addRef.current.open = false;
  };
  const saved = (post.data || state?.ok) && !dirty;
  const savedLen = post.data?.slides.length ?? data.slides.length;
  const warns = ruleWarnings(ws.rules, ws.defaultTemplate, template, data);
  const reasons = (n: number) => warns.filter((w) => w.slide === n + 1).map((w) => WARN_SHORT[w.rule] ?? "규칙");

  const s = data.slides[cur];
  const k = s && kindOf(s.kind);
  const vid = videoAt(cur);
  const tune = k?.fields.find((f) => f.type === "photo" && f.tune && typeof s[f.key] === "number");
  const firstPart = data.caption.split("\n").filter((x) => x.trim()).slice(0, 2).join(" ");
  const moreCut = firstPart.length > 125 || data.caption.split("\n").filter((x) => x.trim()).length > 2;
  const saveBtn = (cls: string) => (
    <button type="submit" form="ed-save" className={cls} disabled={!!err || saving || !ws.canEdit} title="⌘S">{saving ? "저장하는 중" : <>저장<span className="ed-kbd"> ⌘S</span></>}</button>
  );

  return (
    <div className="ed-root">
      <form id="ed-save" ref={formRef} action={save} hidden>
        <input type="hidden" name="id" value={post.id} />
        <input type="hidden" name="template" value={template} />
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="data" value={JSON.stringify(data)} />
      </form>

      <div className="ed-top">
        <Link href={`/w/${ws.id}`} className="ed-back">← 달력</Link>
        <b className="ed-title">D{post.day} {post.slot} · {title || "제목 없음"}</b>
        <span className="ed-pill">{STATUS_LABEL[post.status]}</span>
        <span className="ed-meta">{dirty ? <b>저장 안 됨</b> : "저장됨"} · {t.name} · {category}</span>
        <div className="ed-actions">
          <span className="ed-state">{dirty ? "저장 안 됨" : "저장됨"}</span>
          <button type="button" className="btn ed-undo" onClick={undo} disabled={!hist.past.length} title="⌘Z">되돌리기</button>
          <button type="button" className="btn ed-redo" onClick={redo} disabled={!hist.future.length} title="⇧⌘Z">다시</button>
          {saveBtn("btn ed-save")}
          <StatusBar post={post} dirty={dirty} canEdit={ws.canEdit} canApprove={ws.canApprove} wsId={ws.id} />
        </div>
      </div>
      {(err || state?.error || (state?.ok && !dirty) || !ws.canEdit) && (
        <div className="ed-msgs">
          {!ws.canEdit && <span className="small muted">검수자는 보고 승인만 해요 (고치기는 편집자·소유자)</span>}
          {err ? <span className="err">{err}</span> : state?.error ? <span className="err">{state.error}</span> : state?.ok && !dirty ? <span className="small">저장했어요</span> : null}
        </div>
      )}

      <div className="ed-grid">
        {warns.length > 0 && (
          <div className="ed-warn" role="status">
            <Icon name="warn" size={16} />
            <b>규칙 경고 {warns.length}</b>
            <span className="ed-warn-t">{warns.map((w) => w.text).join(" · ")}</span>
            <span className="ed-warn-r">저장은 돼요 · 승인 창에도 떠요</span>
          </div>
        )}

        <nav className="ed-list" aria-label="장 목록">
          {data.slides.map((sl, n) => {
            const kk = kindOf(sl.kind);
            const c = checks?.[n];
            const why = [...reasons(n), ...(c && !err && !c.ok ? [`밖 ${c.outside}`] : [])];
            return (
              <button key={n} type="button" className="ed-slide" aria-current={n === cur ? "true" : undefined} onClick={() => setSel(n)} title={`${n + 1}장 고치기`}>
                <span className="ed-sthumb" data-fmt={fmt}>{imgs[n] ? <img src={imgs[n]} alt="" /> : null}{videoAt(n) && <i className="play">▶</i>}</span>
                <span className="ed-sinfo">
                  <b>{n + 1} {kk?.label ?? "없는 종류"}</b>
                  <span>{why.length ? `⚠ ${why.join(" · ")}` : c && !err ? "✓" : ""}</span>
                </span>
              </button>
            );
          })}
          {ws.canEdit && (
            <details className="ed-add" ref={addRef}>
              <summary className="btn">+ 장 더하기</summary>
              <div className="ed-add-menu">
                {t.kinds.filter((x) => !x.fixed).map((x) => (
                  <button key={x.kind} type="button" className="btn" disabled={data.slides.length >= t.maxSlides} onClick={() => addKind(x)}>{x.label}</button>
                ))}
              </div>
            </details>
          )}
          <span className="ed-count">{data.slides.length}/{t.maxSlides}장</span>
        </nav>

        <fieldset className="ed-mid" disabled={!ws.canEdit}>
          {!k ? <section className="ed-card ed-fields"><p className="err">{cur + 1}번째 장: 이 템플릿에 없는 종류예요</p></section> : (
            <section className="ed-card ed-fields" aria-label={`${cur + 1}장 칸`}>
              <h2>{cur + 1}장 · {k.label}{vid && <span className="badge">영상</span>}</h2>
              {k.fields.map((f) => <FieldInput key={`${cur}-${f.key}`} f={f} v={s[f.key]} photos={data.photos} onChange={(v) => setSlide(cur, { [f.key]: v })} />)}
              {tune && tune.type === "photo" && (
                <div className="tune">
                  {tune.tune!.includes("h") && <label className="fld">{vid ? "영상" : "사진"} 높이 {Number(s.photoH ?? PHOTO_H.default)}% <em>나머지가 검은 글 칸</em>
                    <input type="range" min={PHOTO_H.min} max={PHOTO_H.max} value={Number(s.photoH ?? PHOTO_H.default)} onChange={(e) => setSlide(cur, { photoH: Number(e.target.value) })} /></label>}
                  {tune.tune!.includes("y") && <label className="fld">{vid ? "영상" : "사진"} 위치 {Number(s.photoY ?? 50)}% <em>위 ↔ 아래</em>
                    <input type="range" min={0} max={100} value={Number(s.photoY ?? 50)} onChange={(e) => setSlide(cur, { photoY: Number(e.target.value) })} /></label>}
                </div>
              )}
              {vid && <VideoTune s={s} video={vid} max={t.videoMax} onChange={(p) => setSlide(cur, p)} />}
              {!k.fixed ? (
                <div className="ed-row">
                  <button type="button" className="btn" aria-label="위로" title="위로" disabled={!canMove(cur, -1)} onClick={() => move(cur, -1)}>↑</button>
                  <button type="button" className="btn" aria-label="아래로" title="아래로" disabled={!canMove(cur, 1)} onClick={() => move(cur, 1)}>↓</button>
                  <button type="button" className="btn" disabled={data.slides.length >= t.maxSlides} onClick={() => duplicate(cur)}>복제</button>
                  <button type="button" className="btn" disabled={data.slides.length <= 1} onClick={() => remove(cur)}>빼기</button>
                </div>
              ) : <p className="ed-note">이 장은 자리가 정해져 있어요 (옮기기·빼기 없음)</p>}
            </section>
          )}

          <Media ws={ws.id} veo={ws.veo && ws.canEdit} photos={data.photos} onChange={(photos, removed) => edit((d) => {
            if (removed !== undefined) d.slides = d.slides.map((x) => shiftPhotos(kindOf(x.kind)?.fields ?? [], x, removed) as SlideData);
            d.photos = photos; return d;
          })} />

          <details className="ed-card ed-plan">
            <summary><h2>기획 · AI 초안</h2><span className="ed-note">제목 · 카테고리 · 템플릿</span></summary>
            <label className="fld">기획 제목<input className="input" value={title} maxLength={80} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></label>
            <div className="ed-two">
              <label className="fld">카테고리
                <select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setDirty(true); }}>
                  {[...new Set([category, ...ws.categories])].filter(Boolean).map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="fld">템플릿
                <select className="input" value={template} onChange={(e) => switchTemplate(e.target.value)}>{TEMPLATES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              </label>
            </div>
            <AiDraft ws={ws} postId={post.id} onDraft={async (extra) => {
              const r = await aiDraftAction({ post: post.id, template, title, category, current: data, extra });
              if (r?.ok) { const d = r.ok; edit(() => d); }
              return r?.error ?? null;
            }} />
          </details>
        </fieldset>

        <div className="ed-right">
          <section className="ed-card ed-prev">
            <h2>미리보기 · {cur + 1}장<span className="ed-sub">{fmt === "reel" ? "1080×1920 릴스" : "1080×1350"}</span></h2>
            <button type="button" className="frame ed-bigframe" data-fmt={fmt} onClick={() => setOpen(cur)} aria-label={`${cur + 1}번째 장 크게 보기`}>
              {imgs[cur] ? <img src={imgs[cur]} alt="" /> : <div className="wait">그리는 중</div>}
              <Overlay n={cur} total={data.slides.length} layers={layers} video={!!vid} fmt={fmt} />
              {vid && <i className="play">▶ 영상</i>}
            </button>
            <div className="ed-row">
              <LayerToggles layers={layers} onChange={setLayers} />
              <button type="button" className="btn" onClick={() => setOpen(cur)}>크게 보기</button>
            </div>
            <p className="ed-margin">
              {err ? <span className="err">미리보기를 멈췄어요: {err}</span>
                : !checks ? "인스타 마진: 계산 중"
                : <>인스타 마진: {checks.map((c, i) => <span key={i} className={c.ok ? undefined : "ed-bad"}>{i > 0 ? " · " : ""}{c.n} {c.ok ? "✓" : `밖 ${c.outside}`}</span>)}</>}
            </p>
          </section>

          <section className="ed-card ed-cap">
            <h2>캡션<button type="button" className="btn ed-hbtn" onClick={copy}>{copied ? "복사했어요" : "캡션 복사"}</button></h2>
            <textarea className="input" aria-label="캡션" rows={8} readOnly={!ws.canEdit} value={data.caption} maxLength={2200} onChange={(e) => edit((d) => { d.caption = e.target.value; return d; })} />
            <p className="ed-note">
              {data.caption.length}/2200 · 해시태그 <b className={tagCount > HASHTAG_MAX ? "ed-bad" : undefined}>{tagCount}/{HASHTAG_MAX}</b>
              {firstPart && <> · &apos;더 보기&apos; 전: {firstPart.slice(0, 125)}{moreCut ? "…" : ""}</>} · 사진 출처는 끝에 자동
            </p>
            {tagCount > HASHTAG_MAX && <p className="err">인스타는 해시태그 {HASHTAG_MAX}개까지만 받아요</p>}
            {ws.hashtags.length > 0 && ws.canEdit && <div className="ed-row">
              <button type="button" className="btn" onClick={() => edit((d) => { const have = new Set(tags(d.caption)); const add = ws.hashtags.filter((h) => !have.has(h)); if (add.length) d.caption = `${d.caption.trimEnd()}${d.caption.trim() ? "\n\n" : ""}${add.join(" ")}`.slice(0, 2200); return d; })}>기본 해시태그 넣기</button>
              {ws.cta && <button type="button" className="btn" onClick={() => edit((d) => { if (!d.caption.includes(ws.cta)) d.caption = `${d.caption.trimEnd()}${d.caption.trim() ? "\n\n" : ""}${ws.cta}`.slice(0, 2200); return d; })}>기본 CTA 넣기</button>}
              <span className="ed-note">브리프에서 정한 값</span>
            </div>}
          </section>

          <section className="ed-card ed-out">
            <h2>내려받기 · 게시물 관리</h2>
            <div className="ed-row">
              {saved && cur < savedLen
                ? <a className="btn" href={`/api/posts/${post.id}/slide/${cur + 1}?download=1`}>이 장 {vid ? "MP4" : "PNG"}</a>
                : <button type="button" className="btn" disabled>이 장 {vid ? "MP4" : "PNG"}</button>}
              {saved ? <a className="btn" href={`/api/posts/${post.id}/zip`}>전체 ZIP</a> : <button type="button" className="btn" disabled>전체 ZIP</button>}
              {fmt === "feed" && (saved
                ? <a className="btn" href={`/api/posts/${post.id}/reel?secs=3`} title="장마다 3초, 9:16 MP4 (소리 없음 — 인스타에서 음악을 골라요). 장 수만큼 시간이 걸려요">릴스 MP4로</a>
                : <button type="button" className="btn" disabled>릴스 MP4로</button>)}
            </div>
            {!saved && <p className="ed-note">저장한 뒤 내려받을 수 있어요</p>}
            {empty && <Manage ws={ws.id} id={post.id} posted={post.status === "posted"} empty={empty} />}
            <p className="ed-note ed-pre">
              {post.note ? `자료 연결: ${post.note}` : "자료 연결: 없음"}
              {post.status !== "posted" && " · 게시 뒤엔 여기에 '게시 성과'(도달·좋아요·댓글·저장·공유·팔로우) 칸이 생겨요."}
            </p>
            {post.status === "posted" && <div id="metrics"><MetricsForm id={post.id} m={post.metrics} /></div>}
          </section>
        </div>
      </div>
      {open !== null && open < data.slides.length && (
        <Modal handle={ws.handle} imgs={imgs} n={open} total={data.slides.length} caption={fullCaption} layers={layers} setLayers={setLayers}
          isVideo={(n) => !!videoAt(n)} renderVideo={renderVideo} onClose={() => setOpen(null)} onMove={setOpen} fmt={fmt} />
      )}
    </div>
  );
}

const WARN_SHORT: Record<string, string> = { photoEvery: "사진", coverQuestion: "질문", ctaComment: "댓글" };
const STATUS_BTN: Record<string, string> = { approved: "승인하기", posted: "게시 표시", draft: "초안으로", skip: "건너뛰기" };

/** 상태 바꾸기: 저장 안 된 고침이 있으면 막는다 (화면과 다른 버전이 승인되지 않게) */
function StatusBar({ post, dirty, canEdit, canApprove, wsId }: { post: Post; dirty: boolean; canEdit: boolean; canApprove: boolean; wsId: string }) {
  const [st, act, pending] = useActionState(setStatusAction, undefined);
  // 역할에 맞는 버튼만: 승인·게시 표시·게시 취소 = 검수 권한, 나머지 = 편집 권한 (서버도 같은 규칙)
  const next = NEXT_STATUS[post.status].filter((s) => (s === "approved" || s === "posted" || post.status === "posted" ? canApprove : canEdit));
  // 저장된 내용이 있는데 고친 게 저장 안 됐으면 막는다 (내용 없는 기획·건너뜀은 그대로 바꿀 수 있다)
  const block = dirty && !!post.data;
  return (
    <form action={act} className="ed-status">
      <input type="hidden" name="id" value={post.id} />
      {block && next.length > 0 && <span className="small muted">저장한 뒤 상태를 바꿔요</span>}
      {st?.error && <span className="err">{st.error}</span>}
      {post.status === "approved" && <input name="postedUrl" className="input posted-url" required pattern="https://(www\.)?instagram\.com/(p|reel)/.+" placeholder="게시 링크 (https://www.instagram.com/p/…)" />}
      {post.postedUrl && <a href={post.postedUrl} target="_blank" rel="noreferrer" className="small">게시물 보기</a>}
      {next.map((s) => s === "approved" && post.status === "draft" ? (
        block ? <button key={s} type="button" className="btn primary" disabled>승인…</button>
          : <Link key={s} className="btn primary" href={`/w/${wsId}/review?p=${post.id}`}>승인…</Link>
      ) : (
        <button key={s} name="status" value={s} disabled={block || pending} formNoValidate={s !== "posted"} className={s === "approved" || s === "posted" ? "btn primary" : "btn"}>{post.status === "posted" && s === "approved" ? "게시 취소" : post.status === "skip" && !post.data ? "기획으로" : STATUS_BTN[s]}</button>
      ))}
    </form>
  );
}

/** AI 초안: 기획 제목·메모·자료로 장 글과 캡션을 채운다 (⌘Z 로 되돌릴 수 있고, 저장은 사람이) */
function AiDraft({ ws, postId, onDraft }: { ws: Ws; postId: string; onDraft: (extra: string) => Promise<string | null> }) {
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // 스튜디오에 Claude 키가 없으면: 내 Claude·ChatGPT 구독(커넥터)에서 초안을 쓰게
  if (!ws.ai) return ws.canEdit ? (
    <div className="block">
      <div className="bh"><strong>AI 초안</strong><span className="small muted">다 되면 이 화면을 새로 고침하세요</span></div>
      <AskAi label="내 Claude·ChatGPT 구독으로 초안 쓰기" prompt={`카드뉴스 스튜디오 게시물 ${postId} 를 get_post 로 읽고, 그 서비스 브리프(get_brief)와 메모·자료에 맞춰 템플릿 칸 정의(list_templates)대로 장 글과 캡션을 써서 update_post 로 넣어 줘. 글자 수 제한을 지키고, 사진 칸은 그대로 두고, 넣은 뒤 check_safe_zone 으로 확인해 줘.`} />
    </div>
  ) : null;
  const go = async () => {
    if (!confirm("AI가 장 글과 캡션을 새로 써요. 지금 글은 바뀌지만 ⌘Z로 되돌릴 수 있어요. 할까요?")) return;
    setBusy(true); setMsg("");
    const e = await onDraft(extra);
    setBusy(false); setMsg(e ?? "초안을 넣었어요. 사실·숫자를 확인한 뒤 저장해 주세요.");
  };
  return (
    <div className="block">
      <div className="bh"><strong>AI 초안</strong><span className="small muted">브리프 · 기획 제목 · 메모(자료 출처)를 바탕으로</span></div>
      <div className="row">
        <input className="input" style={{ flex: 1, minWidth: 200 }} value={extra} maxLength={500} onChange={(e) => setExtra(e.target.value)} placeholder="덧붙일 요청 (예: 5장으로, 숫자 위주로)" />
        <button type="button" className="btn" onClick={go} disabled={busy}>{busy ? "쓰는 중 (30초쯤)" : "AI로 채우기"}</button>
      </div>
      {msg && <p className={/넣었어요/.test(msg) ? "ok" : "err"}>{msg}</p>}
    </div>
  );
}
