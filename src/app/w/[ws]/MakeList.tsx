"use client";

import Link from "next/link";
import Icon from "../../ui/Icon";
import BulkBar, { BulkCheck, type BulkOp } from "../../ui/BulkBar";
import { bulkPostsAction } from "../../actions";

export type MakeRow = { id: string; title: string; meta: string; thumb: string | null; warn: number; when: string; status: string; label: string };

/** 5 제작 목록: 줄을 누르면 편집기. 줄 앞을 체크해 한꺼번에 — 글이 있는 것은 ZIP, 편집 권한이면 지우기·보관함·초안으로·건너뛰기 (승인은 편집기 '검수'에서 하나씩) */
export default function MakeList({ ws, rows, empty, back, canEdit }: { ws: string; rows: MakeRow[]; empty: string; back: string; canEdit: boolean }) {
  const hasData = new Set(rows.filter((r) => r.thumb).map((r) => r.id));
  const ops: BulkOp[] = canEdit ? [
    { op: "draft", label: "초안·기획으로" },
    { op: "skip", label: "건너뛰기" },
    { op: "archive", label: "보관함으로 빼기" },
    { op: "remove", label: "지우기", ask: "고른 게시물 {n}개를 지울까요? 글·장·캡션이 모두 사라지고 되돌릴 수 없어요. 게시한 게시물은 지우지 않아요." },
  ] : [];
  return (
    <div className="mk-plist">
      {rows.map((p) => (
        <div key={p.id} className="mk-row mk-prow mk-pickrow bulk-row" data-s={p.status}>
          <BulkCheck group="posts" id={p.id} label={p.title} />
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
      {rows.length > 0 && (
        <BulkBar group="posts" action={bulkPostsAction} hidden={{ ws, back }} ops={ops}
          note={canEdit ? "줄 앞을 체크해 골라요 · 승인은 편집기의 '검수'에서" : "내려받을 게시물을 체크해요"}
          extra={(ids) => {
            const z = ids.filter((id) => hasData.has(id));
            return z.length
              ? <a className="btn primary" href={`/api/ws/${ws}/zip?ids=${z.join(",")}`} download>{z.length}개 ZIP으로 내려받기</a>
              : <button type="button" className="btn" disabled>ZIP으로 내려받기</button>;
          }} />
      )}
      {!rows.length && <p className="hint">{empty}</p>}
      {hasData.size > 0 && <p className="small muted" style={{ margin: 0 }}>ZIP에는 게시물마다 폴더로 장별 PNG(영상 장은 MP4)와 caption.txt가 담겨요. 글이 있는 게시물만 담고, 인스타에는 직접 올려요</p>}
    </div>
  );
}
