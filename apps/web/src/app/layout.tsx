import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Voi",
  icons: { icon: "/voi-app-icon.png", apple: "/voi-app-icon.png" },
  description: "Tìm kèo cầu lông, rủ bạn ra sân và cùng nhau chơi.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#111214" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem("voi.theme")||"system"}catch{}`,
          }}
        />
      </head>
      <body>
        <I18nProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
