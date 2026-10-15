import type { Metadata } from "next";
import { Fraunces, Work_Sans, Space_Mono } from "next/font/google";
import LockGate from "@/components/LockGate";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
});

const body = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Your Finance Academy",
  description:
    "Personal finance, taught plainly — budgeting, investing, and debt, without the jargon.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* The vault gate only hides the deployed preview; skip it on `npm run dev`. */}
        {process.env.NODE_ENV === "development" ? children : <LockGate>{children}</LockGate>}
      </body>
    </html>
  );
}
