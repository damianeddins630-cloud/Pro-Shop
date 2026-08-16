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
  title: "Ballard's Bowling Academy | Pro Shop & Elite Coaching",
  description:
    "World-class bowling coaching and pro shop from Ballard's Bowling Academy. Lessons, clinics, Storm, Roto Grip, 900 Global, and Ballard vs. The Big C.",
  icons: {
    icon: "/images/logo.png",
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
