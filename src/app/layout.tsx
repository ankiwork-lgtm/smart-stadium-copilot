import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { UserContextProvider } from "../components/UserContextProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Smart Stadium Companion — FIFA World Cup 2026",
  description:
    "GenAI-powered stadium assistant for fans, operations staff, and volunteers at FIFA World Cup 2026.",
  keywords: "FIFA, World Cup 2026, stadium, AI assistant, wayfinding, accessibility",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <UserContextProvider>{children}</UserContextProvider>
      </body>
    </html>
  );
}
