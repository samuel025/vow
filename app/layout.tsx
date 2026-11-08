import type { Metadata } from "next";
import { Bowlby_One, Inter } from "next/font/google";
import "./globals.css";

const display = Bowlby_One({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const ui = Inter({ variable: "--font-ui", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Vow",
  description: "A coach that checks the chain, remembers your habits and learns what nudges you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
