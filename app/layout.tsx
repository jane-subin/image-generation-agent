import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "이미지 생성 에이전트",
  description: "레퍼런스 이미지의 스타일로 제품 화보컷을 생성합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
