"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";

// 위 오른쪽 '내보내기' 메뉴. 실제로 내려받는 건 서비스 백업(JSON) 하나 — 게시물 ZIP 은 게시물마다 7 발행 탭·편집기에 있다.
export default function ExportMenu({ ws }: { ws: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div className="xmenu-wrap" ref={box}>
      <button ref={btn} type="button" className="tool" aria-haspopup="menu" aria-expanded={open} aria-controls="xmenu" title="내보내기" onClick={() => setOpen((o) => !o)}>
        <Icon name="export" /><span className="tool-t">내보내기</span>
      </button>
      {open && (
        <div id="xmenu" role="menu" aria-label="내보내기" className="xmenu">
          <a role="menuitem" href={`/api/ws/${ws}/export`} className="xmenu-it" onClick={() => setOpen(false)}>
            <b>서비스 백업 (JSON)</b><span>브리프·기둥·게시물·주제·자료 전부</span>
          </a>
          <Link role="menuitem" href={`/w/${ws}/publish`} className="xmenu-it" onClick={() => setOpen(false)}>
            <b>승인·게시된 게시물 ZIP</b><span>7 발행 탭에서 게시물마다 PNG·MP4·caption.txt</span>
          </Link>
        </div>
      )}
    </div>
  );
}
