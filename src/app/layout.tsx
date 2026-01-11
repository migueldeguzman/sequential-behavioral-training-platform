import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sequential Behavioral Training and Testing Platform",
  description: "Dashboard for managing ML instruction tuning pipelines",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
