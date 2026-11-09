import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["700", "900"], style: ["normal", "italic"] });
const ui = DM_Sans({ variable: "--font-ui", subsets: ["latin"], weight: ["500", "700"] });

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
