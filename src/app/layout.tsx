import type { Metadata } from "next";
import { Bebas_Neue, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AdminEditButton } from "@/components/AdminEditButton";
import { CartProvider } from "@/lib/cart";
import { EditModeProvider } from "@/lib/edit-mode";

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "https://pro-shop-lemon.vercel.app"
  ),
  title: {
    default: "Ballard's Bowling Academy | Pro Shop & Elite Coaching",
    template: "%s | Ballard's Bowling Academy",
  },
  description:
    "World-class bowling coaching and pro shop from Ballard's Bowling Academy. Lessons, clinics, and gear — pickup in store, no shipping.",
  icons: {
    icon: "/images/logo.png",
  },
  openGraph: {
    title: "Ballard's Bowling Academy | Pro Shop & Elite Coaching",
    description:
      "Hall of Fame coaching and a full-service pro shop. Shop gear online, pick up in store.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} body-copy antialiased`}>
        <CartProvider>
          <EditModeProvider>
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
            <AdminEditButton />
            <Analytics />
          </EditModeProvider>
        </CartProvider>
      </body>
    </html>
  );
}
