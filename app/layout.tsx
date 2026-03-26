import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { RouteShell } from "@/components/shared/route-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Incentra Cinematic Streaming",
  description:
    "Cinematic movie streaming platform with a polished Next.js frontend and AWS-backed serverless delivery.",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/incentra-eye-logo.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased dark" suppressHydrationWarning>
        <RouteShell>{children}</RouteShell>
        <Analytics />
      </body>
    </html>
  );
}
