import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PRAISEJEANS库存管理系统",
  description: "专业的库存管理解决方案，提供实时库存跟踪、订单管理和客户管理功能。",
  keywords: ["库存管理", "PRAISEJEANS", "订单管理", "客户管理", "库存跟踪"],
  authors: [{ name: "PRAISEJEANS Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "PRAISEJEANS库存管理系统",
    description: "专业的库存管理解决方案，提供实时库存跟踪、订单管理和客户管理功能。",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PRAISEJEANS库存管理系统",
    description: "专业的库存管理解决方案，提供实时库存跟踪、订单管理和客户管理功能。",
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
