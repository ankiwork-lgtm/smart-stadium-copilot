import type { Metadata, Viewport } from "next";
import { UserContextProvider } from "../src/components/UserContextProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Stadium Companion — FIFA World Cup 2026",
  description:
    "GenAI-powered stadium assistant for fans, operations staff, and volunteers at FIFA World Cup 2026.",
  keywords: "FIFA, World Cup 2026, stadium, AI assistant, wayfinding, accessibility",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f1e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <UserContextProvider>{children}</UserContextProvider>
      </body>
    </html>
  );
}
