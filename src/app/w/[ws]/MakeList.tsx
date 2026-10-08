"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "../../ui/Icon";

export type MakeRow = { id: string; title: string; meta: string; thumb: string | null; warn: number; when: string; status: string; label: string };

/** 5 제작 목록: 줄을 누르면 편집기, 글이 있는 게시물은 체크해서 ZIP 하나로 내려받기 (검수 탭에서 옮겨 옴) */
export default function MakeList({ ws, rows, empty }: { ws: string; rows: MakeRow[]; empty: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const can = rows.filter((r) => r.thumb).map((r) => r.id);
  const got = picked.filter((id) => can.includes(id));
  const all = can.length > 0 && got.length === can.length;
  const flip = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div className="mk-plist">
      {can.length > 0 && (
        <div className="mk-pickbar">
          <label className="mk-pickall"><input type="checkbox" checked={all} onChange={() => setPicked(all ? [] : can)} />전체</label>
          <span className="small muted">{got.length ? `${got.length}개 골랐어요` : "내려받을 게시물을 체크해요 · 승인한 것만 보려면 위 '승인'"}</span>
          {got.length
            ? <a className="btn primary" href={`/api/ws/${ws}/zip?ids=${got.join(",")}`} download>고른 {got.length}개 ZIP으로 내려받기</a>
            : <button type="button" className="btn" disabled>고른 게시물 ZIP으로 내려받기</button>}
        </div>
      )}
      {rows.map((p) => (
        <div key={p.id} className="mk-row mk-prow mk-pickrow" data-s={p.status}>
          {p.thumb
            ? <input type="checkbox" className="mk-check" aria-label={`${p.title} 고르기`} checked={got.includes(p.id)} onChange={() => flip(p.id)} />
            : <span className="mk-check" aria-hidden />}
          <Link href={`/w/${ws}/p/${p.id}`} className="mk-pickmain">
            {p.thumb
              // eslint-disable-next-line @next/next/no-img-element
              ? <img className="mk-thumb" src={p.thumb} alt="" loading="lazy" />
              : <span className="mk-thumb mk-thumb-empty" aria-hidden>기획</span>}
            <span className="mk-row-main">
              <b className="mk-row-title">{p.title}</b>
              <span className="small muted">{p.meta}</span>
            </span>
            <span className="mk-pmeta">
              {p.warn ? <span className="mk-flag" title={`규칙 경고 ${p.warn}`}><Icon name="warn" size={14} />경고 {p.warn}</span> : null}
              <span className="mk-when small muted">{p.when}</span>
              <span className="mk-pill" data-s={p.status}>{p.label}</span>
            </span>
          </Link>
        </div>
      ))}
      {!rows.length && <p className="hint">{empty}</p>}
      {can.length > 0 && <p className="small muted" style={{ margin: 0 }}>ZIP = 게시물마다 폴더 · 장별 PNG(영상 장은 MP4) + caption.txt · 인스타에는 직접 올려요</p>}
    </div>
  );
}
