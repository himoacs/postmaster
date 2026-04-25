"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  PenLine,
  History,
  User,
  Settings,
  Menu,
  X,
  Home,
  BarChart3,
  Database,
} from "lucide-react";
import { useState } from "react";
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen bg-background">
        {/* Desktop Icon Rail */}
        <aside className="hidden w-16 flex-col items-center border-r bg-card py-4 lg:flex">
          <Link
            href="/"
            className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg text-primary transition-colors hover:bg-accent"
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

        {/* Mobile Header */}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
            <Link href="/dashboard" className="flex items-center gap-2">
              <PenLine className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <span className="font-serif text-base font-medium">PostMaster</span>
            </Link>
          </header>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 top-14 z-30 bg-background lg:hidden">
              <nav className="p-4">
                <ul className="space-y-1">
                  <li className="mb-4 pb-4 border-b">
                    <Link
                      href="/"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Home className="h-5 w-5" strokeWidth={1.5} />
                      Home
                    </Link>
                  </li>
                  {navigation.map((item) => {
                    const isActive = 
                      item.href === "/dashboard" 
                        ? pathname === "/dashboard" 
                        : pathname.startsWith(item.href);
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <item.icon className="h-5 w-5" strokeWidth={1.5} />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          )}

          {/* Main Content */}
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
