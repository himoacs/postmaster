"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  PenLine,
  Menu,
  X,
  Moon,
  Sun,
  Home,
  History,
  User,
  Settings,
  BarChart3,
  Database,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navigation = [
  { name: "Write", href: "/dashboard", icon: PenLine },
  { name: "History", href: "/dashboard/history", icon: History },
  { name: "Knowledge", href: "/dashboard/knowledge", icon: Database },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Profile", href: "/dashboard/profile", icon: User },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        {/* Top Header */}
        <header
          className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm shrink-0"
          style={{
            // @ts-expect-error - Electron-specific CSS property for window dragging
            WebkitAppRegion: "drag",
            appRegion: "drag",
          }}
        >
          <div className="flex h-14 items-center justify-between px-4">
            {/* Spacer for macOS traffic lights + Logo */}
            <div className="flex items-center">
              <div className="w-16 lg:w-20" /> {/* Space for traffic lights */}
              <Link
                href="/"
                className="flex items-center gap-2.5"
                style={{
                  // @ts-expect-error - Electron-specific CSS property
                  WebkitAppRegion: "no-drag",
                  appRegion: "no-drag",
                }}
              >
                <PenLine className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <span className="font-serif text-lg font-medium">PostMaster</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav
              className="hidden items-center gap-2 md:flex"
              style={{
                // @ts-expect-error - Electron-specific CSS property
                WebkitAppRegion: "no-drag",
                appRegion: "no-drag",
              }}
            >
              <Link
                href="#how-it-works"
                className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                How it works
              </Link>
              <Link
                href="/about"
                className={cn(
                  "px-3 py-2 text-sm transition-colors hover:text-foreground",
                  pathname === "/about"
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                About
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
              <Button asChild size="sm">
                <Link href="/dashboard">Start Writing</Link>
              </Button>
            </nav>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 md:hidden"
              style={{
                // @ts-expect-error - Electron-specific CSS property
                WebkitAppRegion: "no-drag",
                appRegion: "no-drag",
              }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="border-t bg-background md:hidden">
              <nav className="container flex flex-col gap-2 py-4">
                <Link
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  How it works
                </Link>
                <Link
                  href="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  About
                </Link>
                <div className="flex items-center gap-2 px-3 py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </Button>
                </div>
                <Button asChild size="sm" className="mx-3">
                  <Link href="/dashboard">Start Writing</Link>
                </Button>
              </nav>
            </div>
          )}
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Icon Rail */}
          <aside className="hidden w-16 flex-col items-center border-r bg-card pt-4 pb-4 lg:flex">
            <Link
              href="/"
              className={cn(
                "mb-6 flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                pathname === "/"
                  ? "bg-primary text-primary-foreground"
                  : "text-primary hover:bg-accent"
              )}
            >
              <Home className="h-5 w-5" strokeWidth={1.5} />
            </Link>
            <nav className="flex flex-1 flex-col items-center gap-1">
              {navigation.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5" strokeWidth={1.5} />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10}>
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
