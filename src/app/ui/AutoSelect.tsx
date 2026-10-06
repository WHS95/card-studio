"use client";

/** 고르면 바로 그 폼을 보낸다 (신뢰도 바꾸기 등). 자바스크립트가 없으면 옆 버튼으로 */
export default function AutoSelect({ name, value, options, label }: { name: string; value: string; options: { v: string; label: string }[]; label: string }) {
  return (
    <select name={name} defaultValue={value} aria-label={label} className="input" style={{ width: "auto", minHeight: 32 }} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );
}
