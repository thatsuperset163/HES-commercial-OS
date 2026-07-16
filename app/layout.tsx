import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Montserrat } from "next/font/google";
import "./globals.css";
import "./hq-home.css";

const body = Barlow({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const display = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
});

const hq = Montserrat({
  subsets: ["latin"],
  variable: "--font-hq",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "HES Operating System",
  description: "Personal direction, field operations, and commercial growth for Harris Exterior Solutions",
  appleWebApp: {
    capable: true,
    title: "HES OS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a1018",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${display.variable} ${hq.variable}`}>
        {children}
      </body>
    </html>
  );
}
