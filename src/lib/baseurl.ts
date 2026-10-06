import "server-only";

/** 이 요청이 들어온 바깥 주소 (터널·배포 뒤에서도 맞게). STUDIO_PUBLIC_URL 이 있으면 그것 */
export function baseUrl(req: Request) {
  if (process.env.STUDIO_PUBLIC_URL) return process.env.STUDIO_PUBLIC_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "127.0.0.1:3200";
  const proto = h.get("x-forwarded-proto") ?? (/^(127\.0\.0\.1|localhost)/.test(host) ? "http" : "https");
  return `${proto.split(",")[0]}://${host.split(",")[0]}`;
}
