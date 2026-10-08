"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./ui/Icon";

/** 새 서비스 창 (이름 · 영문 주소 · 계정 · 업종 · 한 줄 소개). 색·워드마크는 4단계 템플릿 탭에서 */
export default function NewService({ presets, action, open, quota }: { presets: { id: string; name: string }[]; action: (fd: FormData) => Promise<void>; open?: boolean; quota?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [slug, setSlug] = useState("");
  useEffect(() => { if (open) ref.current?.showModal(); }, [open]);
  return (
    <>
      <button type="button" className="btn primary" onClick={() => ref.current?.showModal()}><Icon name="plus" size={16} />새 서비스</button>
      <dialog ref={ref} className="dlg w-dlg" aria-labelledby="nw-t">
        <form action={action} className="w-dlg-form">
          <h2 id="nw-t">새 서비스</h2>
          <label className="fld">이름<input name="name" className="input" required maxLength={30} /></label>
          <label className="fld"><span>영문 주소 <em>소문자·숫자·- 2~30자{slug ? ` · /w/${slug}` : ""}</em></span>
            <input name="id" className="input" required pattern="[a-z0-9\-]+" minLength={2} maxLength={30} value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
          <label className="fld">인스타 계정<input name="handle" className="input" placeholder="@account" /></label>
          <label className="fld"><span>업종 <em>고르면 기둥·말투·해시태그를 시작값으로 채워요</em></span>
            <select name="industry" className="input" defaultValue=""><option value="">고르지 않음</option>{presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="fld">한 줄 소개<input name="about" className="input" maxLength={300} placeholder="무엇을 하는 서비스인지" /></label>
          <p className="small w-sub">기본 테마는 흑백이에요. 색·워드마크는 4단계 템플릿 탭에서 바꿔요.{quota ? ` ${quota}` : ""}</p>
          <div className="row w-end">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>닫기</button>
            <button className="btn primary">만들기</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
