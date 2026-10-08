import "server-only";
import { createHash } from "node:crypto";
import { getPost, getWorkspace, readDb } from "./store";
import { checklistOf, OpError } from "./ops";
import { checkPost } from "./check";
import { validatePost } from "./fields";
import { templateOf } from "./templates";
import { DEFAULT_CHECKS, type Post } from "./types";

// 편집기 '검수' 창의 자동 확인 (돈이 들지 않는 것만): 칸 검사 · 인스타 마진 · 콘텐츠 규칙(문구 규칙 포함) · '확인 필요' 자료 · 샘플 그림 · 사진 출처 · 캡션·해시태그.
// AI 종합 피드백(ai.ts reviewPost)은 이 결과를 받아 되풀이하지 않고, 사람이 누를 때만 부른다.

/** AI 피드백이 어느 글에 대한 것인지: 템플릿 + 장 글·사진·캡션의 지문 (상태만 바꿔도 바뀌는 updatedAt 대신) */
export const contentKey = (p: Pick<Post, "template" | "data">) => createHash("sha256").update(JSON.stringify({ t: p.template, d: p.data })).digest("hex").slice(0, 16);

export type AutoItem = { ok: boolean; text: string; href?: string };

export async function autoReview(postId: string) {
  const p = (await getPost(postId)) ?? fail("게시물을 찾지 못했어요");
  const w = (await getWorkspace(p.workspace)) ?? fail("서비스를 찾지 못했어요");
  if (!p.data) fail("저장된 글이 없어요. 글을 채우고 저장한 뒤 검수해 주세요");
  const d = p.data!;
  const cl = await checklistOf(p.id);
  const items: AutoItem[] = [];
  const err = validatePost(templateOf(p.template), d);
  items.push(err ? { ok: false, text: `칸 검사: ${err}` } : { ok: true, text: `칸 길이·장 수가 템플릿에 맞아요 (${d.slides.length}장)` });
  const safe = await checkPost(p.template, w.theme, d).catch(() => null);
  const out = safe?.filter((x) => !x.ok) ?? [];
  items.push(!safe ? { ok: false, text: "인스타 마진을 계산하지 못했어요. 미리보기의 '가려지는 영역'으로 확인해 주세요" }
    : out.length ? { ok: false, text: `인스타 마진: ${out.map((x) => `${x.n}장 ${x.outside}px`).join(" · ")}이 안전 영역 밖이에요. 글을 줄이거나 배치를 바꿔 주세요` }
    : { ok: true, text: `인스타 마진: ${safe.length}장 모두 안전 영역 안이에요` });
  for (const a of cl.auto) items.push({ ok: a.ok, text: a.text, ...("researchId" in a ? { href: `/w/${w.id}/research?c=check` } : {}) });
  const samples = d.photos.filter((x) => /^\/samples\//.test(x.url)).length;
  if (samples) items.push({ ok: false, text: `샘플 그림 ${samples}개가 남아 있어요. 실제 사진으로 바꾸면 승인할 수 있어요` });
  const noCredit = d.photos.filter((x) => x.url && !/^\/samples\//.test(x.url) && !x.credit.trim()).length;
  if (noCredit) items.push({ ok: false, text: `출처가 빈 사진이 ${noCredit}개 있어요. 사진 칸에서 출처를 적어 주세요` });
  const tags = (d.caption.match(/#[^\s#]+/g) ?? []).length;
  items.push(!d.caption.trim() ? { ok: false, text: "캡션이 비어 있어요. 캡션을 적어 주세요" }
    : tags > 30 ? { ok: false, text: `해시태그가 ${tags}개예요. 인스타에는 30개까지 넣을 수 있어요` }
    : { ok: true, text: `캡션 ${d.caption.length}자 · 해시태그 ${tags}개` });
  const db = await readDb();
  const rids = new Set(db.ideas.filter((i) => i.postId === p.id).flatMap((i) => i.research));
  const research = db.research.filter((r) => rids.has(r.id)).map((r) => ({ title: r.title, summary: r.summary, url: r.url, confidence: r.confidence ?? "medium" }));
  return {
    items, required: cl.required, added: cl.required.filter((c) => !(DEFAULT_CHECKS as readonly string[]).includes(c)),
    research, review: cl.review, aiReview: p.aiReview && p.aiReview.for === contentKey(p) ? p.aiReview : null, oldAi: p.aiReview && p.aiReview.for !== contentKey(p) ? p.aiReview : null,
  };
}
export type AutoReview = Awaited<ReturnType<typeof autoReview>>;

const fail = (m: string): never => { throw new OpError(m); };
