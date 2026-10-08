import "server-only";
import { OpError } from "./ops";

// 무료 사진 찾기 — 위키미디어 공용(키 없이, 자유 라이선스만). AI 패널·MCP 의 search_photos.
// 실제 장소 사진이 많아 '장소 이름이 나오면 실제 그 장소 사진만' 규칙에 맞추기 좋다.
// 위키미디어는 User-Agent 없는 요청을 막아서, 고른 사진은 add_media 가 이 서버로 받아 둔다(media.importUrl).

export const UA = "card-studio/0.6 (local content studio; https://github.com/WHS95/card-studio)";

export type FoundPhoto = { title: string; url: string; page: string; credit: string; source: string; license: string; width: number; height: number; description: string };

const FREE = /^(cc[- ]?by(-sa)?( \d(\.\d)?)?|cc0( \d\.\d)?|public domain|pd|no restrictions)/i;
const strip = (s: unknown) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();

/** 낱말로 찾기 (영어 장소 이름이 잘 걸린다: Seoraksan, Hallasan …). 사진만, 자유 라이선스만 */
export async function searchPhotos(query: string, count = 8): Promise<FoundPhoto[]> {
  const q = query.trim().slice(0, 100);
  if (!q) throw new OpError("찾을 말을 적어 주세요");
  const n = Math.min(12, Math.max(1, Math.round(count) || 8));
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({
    action: "query", format: "json", origin: "*", generator: "search", gsrnamespace: "6", gsrsearch: `${q} filetype:bitmap`, gsrlimit: String(Math.min(30, n * 3)),
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600", iiextmetadatafilter: "Artist|LicenseShortName|ImageDescription|ObjectName",
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!r?.ok) throw new OpError("위키미디어 공용에 연결하지 못해 사진을 찾지 못했어요. 잠시 뒤 다시 해 주세요");
  const j = (await r.json()) as { query?: { pages?: Record<string, { index?: number; title: string; imageinfo?: { thumburl?: string; url: string; descriptionurl: string; width: number; height: number; mime: string; extmetadata?: Record<string, { value?: string }> }[] }> } };
  const pages = Object.values(j.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const out: FoundPhoto[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/^image\/(jpeg|png)$/.test(ii.mime) || ii.width < 800) continue;
    const m = ii.extmetadata ?? {};
    const license = strip(m.LicenseShortName?.value);
    if (!FREE.test(license)) continue;
    const credit = strip(m.Artist?.value).slice(0, 60) || "작자 미상";
    out.push({
      title: strip(m.ObjectName?.value) || p.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
      url: ii.thumburl || ii.url, page: ii.descriptionurl, credit, license,
      source: `Wikimedia · ${license}`.slice(0, 40),
      width: ii.width, height: ii.height, description: strip(m.ImageDescription?.value).slice(0, 160),
    });
    if (out.length >= n) break;
  }
  return out;
}
