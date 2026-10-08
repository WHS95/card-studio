"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AiReview, PostStatus } from "@/lib/types";
import type { AutoReview } from "@/lib/review";
import { aiReviewAction, reviewCheckAction } from "../../../../actions";
import AskAi from "../../../../AskAi";
import Icon from "../../../../ui/Icon";
import ApproveForm from "./ApproveForm";

const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 편집기 '검수' 창: 스튜디오가 확인한 것(열 때 바로) · AI 종합 피드백(누를 때만, 돈이 듦) · 사람이 확인할 것 + 승인하기.
 *  저장한 버전으로만 연다 — 검수한 것과 승인되는 것이 같게. 고칠 곳을 누르면 창이 닫히고 그 장으로 간다 */
export default function ReviewPanel({ postId, title, status, ai, canEdit, canApprove, onClose, onPick }: {
  postId: string; title: string; status: PostStatus; ai: boolean; canEdit: boolean; canApprove: boolean; onClose: () => void; onPick: (slide: number) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [auto, setAuto] = useState<AutoReview | null>(null);
  const [err, setErr] = useState("");
  const [fb, setFb] = useState<AiReview | null>(null);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
    reviewCheckAction(postId).then((r) => { if (r?.ok) { setAuto(r.ok); setFb(r.ok.aiReview); } else setErr(r?.error ?? "확인하지 못했어요. 창을 닫고 다시 열어 주세요"); });
  }, [postId]);
  const askAi = async () => {
    setAsking(true); setErr("");
    const r = await aiReviewAction(postId);
    setAsking(false);
    if (r?.ok) setFb(r.ok); else setErr(r?.error ?? "AI 피드백을 받지 못했어요. 잠시 뒤 다시 해 주세요");
  };
  // 열 때의 상태로 승인 칸을 정한다 — 승인하면 화면이 새로 고쳐져 status 가 바로 바뀌어도 '승인했어요'가 보이게
  const [opened] = useState(status);
  const bad = auto?.items.filter((x) => !x.ok).length ?? 0;
  const old = !fb && auto?.oldAi;
  return (
    <dialog ref={ref} className="dlg ed-rv" aria-labelledby="rv-t" onClose={onClose}>
      <div className="ed-rv-head">
        <h2 id="rv-t">검수 · {title || "제목 없음"}</h2>
        <button type="button" className="btn" onClick={() => ref.current?.close()}>닫기</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>저장한 버전을 확인해요. 고칠 곳을 누르면 그 장으로 가요.</p>

      <b className="mk-sub">스튜디오가 확인한 것{auto ? ` · 확인할 것 ${bad}개` : ""}</b>
      {!auto && !err && <p className="small muted ed-rv-wait">장마다 그려 보며 확인하고 있어요</p>}
      {auto?.items.map((a, i) => (
        <div key={i} className="mk-auto"><Icon name={a.ok ? "check" : "warn"} size={16} /><span>{a.text}{a.href && <> · <Link href={a.href}>자료 열기</Link></>}</span></div>
      ))}

      <b className="mk-sub">AI 종합 피드백</b>
      {fb ? (
        <div className="ed-rv-ai">
          <p className="ed-rv-verdict"><Icon name={fb.verdict === "ready" ? "check" : "warn"} size={16} /><b>{fb.verdict === "ready" ? "올려도 좋아요" : "고치면 더 좋아요"}</b><span>{fb.summary}</span></p>
          {fb.good.length > 0 && <ul className="ed-rv-good">{fb.good.map((g, i) => <li key={i}>{g}</li>)}</ul>}
          {fb.fix.map((f, i) => (
            <button key={i} type="button" className="ed-rv-fix" onClick={() => { ref.current?.close(); if (f.slide > 0) onPick(f.slide - 1); }}>
              <span className="ed-rv-n">{f.slide > 0 ? `${f.slide}장` : "전체"}</span>
              <span><b>{f.what}</b><span className="small">{f.how}</span></span>
            </button>
          ))}
          <p className="small muted" style={{ margin: 0 }}>{fb.by} · {when(fb.at)}에 받았어요 · AI 의견이에요. 고칠지는 사람이 정해요</p>
        </div>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>{old ? `글을 고치기 전에 받은 피드백이 있어요(${when(old.at)}). 지금 버전으로 다시 받을 수 있어요. ` : ""}표지·장 흐름·말투·근거 없는 사실·캡션을 한 번에 봐 줘요.</p>
      )}
      {(canEdit || canApprove) && (ai
        ? <div className="row"><button type="button" className={fb ? "btn" : "btn primary"} onClick={askAi} disabled={asking || !auto}>{asking ? "AI가 읽는 중" : fb ? "AI 피드백 다시 받기" : "AI 피드백 받기"}</button><span className="small muted">누를 때만 AI를 불러요 · 1~2분 걸려요</span></div>
        : <AskAi label="내 Claude·ChatGPT 구독으로 피드백 받기" prompt={`카드뉴스 스튜디오 게시물 ${postId} 를 get_post 로 읽고, get_brief(서비스 목적·말투)와 get_checklist(자동 확인)를 본 뒤 올리기 전 편집장처럼 종합 피드백을 줘: 총평 한두 문장, 잘된 점, 고칠 것(장 번호 · 무엇이 문제인지 · 고친 문구) 중요한 것부터 6개까지. 고치거나 승인하지는 말고 의견만 줘.`} />)}
      {err && <p className="err" style={{ margin: 0 }}>{err}</p>}

      {opened === "draft" && auto && (canApprove
        ? <ApproveForm id={postId} required={auto.required} added={auto.added} />
        : <p className="small muted" style={{ margin: "8px 0 0" }}>승인은 소유자·검수자가 해요. 저장하면 검수자가 이 창에서 승인할 수 있어요.</p>)}
      {opened === "approved" && auto?.review && <p className="small muted" style={{ margin: "8px 0 0" }}>{auto.review.by} · {when(auto.review.at)} 승인 · 체크 {auto.review.checks.length}개. 글을 고치면 다시 초안이 돼요.</p>}
    </dialog>
  );
}
