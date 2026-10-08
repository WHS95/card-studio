"use client";

/** 지우기처럼 되돌릴 수 없는 일을 하는 제출 버튼 — 누르면 한 번 묻고, '취소'를 고르면 보내지 않는다 */
export default function ConfirmButton({ ask, children, className = "btn", name, value }: { ask: string; children: React.ReactNode; className?: string; name?: string; value?: string }) {
  return (
    <button className={className} name={name} value={value} formNoValidate onClick={(e) => { if (!confirm(ask)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
