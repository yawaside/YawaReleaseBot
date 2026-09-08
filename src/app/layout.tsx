import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "YawaReleaseBot — автоматическая синхронизация релизов GitHub",
  description: "YawaReleaseBot — локальный бот для переноса описаний релизов (changelogs) и бинарных файлов из закрытых репозиториев в репозиторий-приёмник без исходного кода.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
