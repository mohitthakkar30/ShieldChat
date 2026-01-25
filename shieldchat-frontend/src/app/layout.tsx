import type { Metadata } from "next";
import { Space_Mono, Outfit, Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";

// Terminal aesthetic - for code/technical elements
const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});

// Modern geometric - for headings
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
});

// Clean readable - for body text
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "ShieldChat - Private Messaging on Solana",
  description: "End-to-end encrypted messaging with token-gated channels and private payments on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${spaceMono.variable} ${outfit.variable} font-sans antialiased bg-[#030712] text-gray-50`}
      >
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
