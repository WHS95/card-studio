/**
 * 복사: 클립보드 API → 안 되면(앱 안 브라우저·http 주소·권한 거부) 숨긴 글 칸 + execCommand("copy").
 * 둘 다 안 되면 false — 부르는 쪽이 '직접 선택해 복사' 안내를 띄운다. 예외를 밖으로 던지지 않는다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* 아래로 */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
