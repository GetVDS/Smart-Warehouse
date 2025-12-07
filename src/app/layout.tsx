import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/ErrorBoundary";
import BrowserCompatibilityInitializer from "@/components/BrowserCompatibilityInitializer";
import SecurityInitializer from "@/components/SecurityInitializer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'),
  title: "PRAISEJEANS库存管理系统",
  description: "专业的库存管理解决方案，提供实时库存跟踪、订单管理和客户管理功能。",
  keywords: ["库存管理", "PRAISEJEANS", "订单管理", "客户管理", "库存跟踪"],
  authors: [{ name: "PRAISEJEANS Team" }],
  icons: {
    icon: "/favicon.ico",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "PRAISEJEANS库存管理系统",
    description: "专业的库存管理解决方案，提供实时库存跟踪、订单管理和客户管理功能。",
    type: "website",
    images: [{
      url: "/icon.png",
      width: 100,
      height: 100,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PRAISEJEANS库存管理系统",
    description: "专业的库存管理解决方案，提供实时库存跟踪、订单管理和客户管理功能。",
    images: [{
      url: "/icon.png",
      width: 100,
      height: 100,
    }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <ErrorBoundary>
          <BrowserCompatibilityInitializer />
          <SecurityInitializer />
          {children}
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  );
}
