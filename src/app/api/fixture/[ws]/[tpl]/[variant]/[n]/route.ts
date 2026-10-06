import { getWorkspace } from "@/lib/store";
import { templateOf } from "@/lib/templates";
import { FIXTURE_VARIANTS, fixturePost, type FixtureVariant } from "@/lib/fields";
import { renderSlide } from "@/lib/render";

// 안전 영역 검사용 (개발 전용): 템플릿 × 서비스 테마 × 최대 길이(space·nospace·lines·chips) + 24자 워드마크, 사진 없이
export async function GET(_req: Request, ctx: RouteContext<"/api/fixture/[ws]/[tpl]/[variant]/[n]">) {
  if (process.env.NODE_ENV === "production") return new Response("없어요", { status: 404 });
  const { ws, tpl, variant, n } = await ctx.params;
  const w = await getWorkspace(ws);
  const t = templateOf(tpl);
  if (!w || t.id !== tpl || !(FIXTURE_VARIANTS as readonly string[]).includes(variant)) return new Response("없어요", { status: 404 });
  const post = fixturePost(t, variant as FixtureVariant);
  const i = Number(n) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= post.slides.length) return new Response("없어요", { status: 404 });
  // 워드마크도 최대 길이(설정 화면 24자)의 넓은 글자로
  const theme = { ...w.theme, wordmark: { ...w.theme.wordmark, text: "W".repeat(24) } };
  const img = await renderSlide(t.id, theme, post, i, { debug: true });
  return new Response(img.body, { headers: { "content-type": "image/png" } });
}
