import type { Metadata } from "next";
import { JetBrains_Mono, Sora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";

// Terminal/code font - JetBrains Mono for better code readability
const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
});

// Display font - Sora for dramatic headers
const sora = Sora({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

// Body font - Plus Jakarta Sans for clean readability
const plusJakarta = Plus_Jakarta_Sans({
  weight: ["400", "500", "600"],
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
        className={`${plusJakarta.variable} ${jetbrainsMono.variable} ${sora.variable} font-sans antialiased`}
      >
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
