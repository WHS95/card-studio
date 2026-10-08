"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "../../../ui/Icon";

export type ReviewRow = { id: string; title: string; meta: string; thumb: string; warn: number; status: "draft" | "approved" };

/** 6 검수 목록: 누르면 오른쪽에 확인 창, 체크하면 고른 것만 ZIP 하나로 내려받기 */
export default function ReviewList({ ws, rows, cur }: { ws: string; rows: ReviewRow[]; cur?: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const all = rows.length > 0 && picked.length === rows.length;
  const flip = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const href = `/api/ws/${ws}/zip?ids=${picked.join(",")}`;
  return (
    <div className="mk-list">
      <div className="mk-pickbar">
        <label className="mk-pickall"><input type="checkbox" checked={all} onChange={() => setPicked(all ? [] : rows.map((r) => r.id))} disabled={!rows.length} />전체</label>
        <span className="small muted">{picked.length ? `${picked.length}개 골랐어요` : "내려받을 게시물을 체크해요"}</span>
        {picked.length
          ? <a className="btn primary" href={href} download>고른 {picked.length}개 ZIP으로 내려받기</a>
          : <button type="button" className="btn" disabled>고른 게시물 ZIP으로 내려받기</button>}
      </div>
      {rows.map((p) => (
        <div key={p.id} className="mk-row mk-pick mk-pickrow" aria-current={p.id === cur ? "true" : undefined}>
          <input type="checkbox" className="mk-check" aria-label={`${p.title} 고르기`} checked={picked.includes(p.id)} onChange={() => flip(p.id)} />
          <Link href={`/w/${ws}/review?p=${p.id}${p.status === "approved" ? "&s=approved" : ""}`} className="mk-pickmain">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mk-thumb mk-thumb-lg" src={p.thumb} alt="" loading="lazy" />
            <span className="mk-row-main"><b className="mk-row-title">{p.title}</b><span className="small muted">{p.meta}</span></span>
            {p.status === "draft"
              ? <span className="mk-flag"><Icon name={p.warn ? "warn" : "check"} size={14} />{p.warn ? `규칙 경고 ${p.warn}` : "경고 없음"}</span>
              : <span className="mk-flag"><Icon name="check" size={14} />승인됨</span>}
          </Link>
        </div>
      ))}
      <p className="small muted" style={{ margin: 0 }}>ZIP = 게시물마다 폴더 · 장별 PNG(영상 장은 MP4) + caption.txt · 인스타에는 직접 올려요</p>
    </div>
  );
}
