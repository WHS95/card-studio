import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import "./css/shell.css";
import "./css/wide.css";
import "./css/stages.css";
import "./css/make.css";
import "./css/editor.css";

const noto = Noto_Sans_KR({ variable: "--font-noto", weight: ["400", "500", "700", "800"], subsets: ["latin"], preload: false, display: "swap" });

export const metadata: Metadata = { title: "카드뉴스 스튜디오", robots: { index: false } };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={noto.variable}>
      {/* 브라우저 확장(컬러 피커·자동 완성)이 React 전에 body 에 속성을 붙여도 경고하지 않게 (이 요소의 속성만) */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
