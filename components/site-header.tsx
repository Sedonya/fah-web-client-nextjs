"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAccountStore } from "@/lib/core/stores";
import { LogOut, User, Server } from "lucide-react";
import { useTheme } from "next-themes";
import { useUIStore } from "@/lib/core/stores";

export function SiteHeader() {
  const { data, isInitializing } = useAccountStore();
  const { setTheme, theme } = useTheme();
  const setLoginOpen = useUIStore((state) => state.setLoginOpen);
  const setConnectOpen = useUIStore((state) => state.setConnectOpen);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-5xl">
        
        {/* User Info & Stats Row */}
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            {isInitializing ? (
              <>
                <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
                <div className="h-5 w-32 bg-muted animate-pulse rounded"></div>
              </>
            ) : (
              <>
                <div className="h-8 w-8 bg-muted rounded overflow-hidden flex items-center justify-center">
                  {data.avatar ? (
                    <img src={data.avatar} alt="avatar" className="h-full w-full object-cover opacity-80" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <span className="font-semibold text-primary">
                  {data.team ? `Team ${data.team}` : "Folding@home"}
                </span>
              </>
            )}
          </div>
          
          {/* Fake Graph Placeholder */}
          <div className="hidden md:flex h-10 w-48 border border-border items-end px-1 gap-1">
             <div className="w-full h-1/2 border-t border-primary opacity-50 relative">
               <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"></div>
             </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConnectOpen(true)} className="text-muted-foreground hover:text-foreground">
              <Server className="h-4 w-4 mr-1.5" />
              Connect
            </Button>
            {isInitializing ? (
              <div className="flex items-center gap-3 ml-2">
                <div className="h-4 w-20 bg-muted animate-pulse rounded"></div>
                <div className="h-9 w-9 bg-muted animate-pulse rounded-md"></div>
              </div>
            ) : data.user ? (
              <div className="flex items-center gap-3 ml-2">
                <span className="text-sm font-medium text-foreground">{data.user}</span>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => account.logout()}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setLoginOpen(true)}>
                <User className="mr-1.5 h-4 w-4" />
                Sign In
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link
            href="/"
            className="pb-2 border-b-2 border-primary text-foreground"
          >
            Machines
          </Link>
          <Link
            href="/work-units"
            className="pb-2 border-b-2 border-transparent hover:text-foreground transition-colors"
          >
            Work Units
          </Link>
          <Link
            href="/stats"
            className="pb-2 border-b-2 border-transparent hover:text-foreground transition-colors"
          >
            Stats
          </Link>
          <Link
            href="/projects"
            className="pb-2 border-b-2 border-transparent hover:text-foreground transition-colors"
          >
            Projects
          </Link>
          <Link
            href="/news"
            className="pb-2 border-b-2 border-transparent hover:text-foreground transition-colors"
          >
            News
          </Link>
        </nav>

      </div>
    </header>
  );
}
