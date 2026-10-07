"use client";

import { useRouter } from "next/navigation";

/** 갤러리 테마 고르기: 흑백 기본 또는 서비스 (그 서비스 색·워드마크로 다시 그림, 시작할 서비스도 이것) */
export default function ThemePick({ list, value, f }: { list: { id: string; name: string }[]; value: string; f: string }) {
  const router = useRouter();
  const go = (ws: string) => { const q = new URLSearchParams(); if (ws) q.set("ws", ws); if (f) q.set("f", f); router.push(`/templates${q.size ? `?${q}` : ""}`); };
  return (
    <label className="w-theme">테마
      <select className="input" value={value} onChange={(e) => go(e.target.value)}>
        <option value="">흑백 기본</option>
        {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </label>
  );
}
