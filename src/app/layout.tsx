import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { NotificationProvider } from "@/context/NotificationContext";
import AppShell from "@/components/layout/AppShell";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  subsets: ["latin"],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-sans'
});
//
export const metadata: Metadata = {
  title: "Kiddos Foods ERP",
  description: "Kiddos Foods ERP - manage sales, purchases, accounting and more",
  icons: {
    icon: "/KIDOOS logo.png",
    shortcut: "/KIDOOS logo.png",
    apple: "/KIDOOS logo.png",
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <NotificationProvider>
                <AppShell>
                  {children}
                </AppShell>
              </NotificationProvider>
            </ToastProvider>
          </AuthProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
