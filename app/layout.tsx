import { Geist, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/site-header";
import { LoginDialog } from "@/components/login-dialog";
import { ConnectDialog } from "@/components/connect-dialog";
import { AppInitializer } from "@/components/app-initializer";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <LoginDialog />
            <ConnectDialog />
            <AppInitializer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
