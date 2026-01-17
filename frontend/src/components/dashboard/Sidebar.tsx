"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Home,
  ScrollText,
  Users,
  Search,
  ChevronRight,
  X,
  Monitor,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSearchClick: () => void;
}

export function Sidebar({
  isOpen,
  setIsOpen,
  onSearchClick,
}: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home, exact: true },
    {
      href: "/dashboard/workflows",
      label: "Lead Magnets",
      icon: ScrollText,
      activePrefixes: ["/dashboard/workflows"],
    },
    {
      href: "/dashboard/jobs",
      label: "Leads & Results",
      icon: Users,
      activePrefixes: ["/dashboard/jobs"],
    },
    {
      href: "/dashboard/playground",
      label: "Playground",
      icon: Monitor,
      activePrefixes: ["/dashboard/playground"],
    },
  ];

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-[280px] max-w-[85vw] sm:max-w-[320px] bg-card border-r border-border transform transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <svg
                className="w-4 h-4 text-primary-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="font-semibold text-foreground">Lead Magnet AI</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="text-muted-foreground"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 py-6 px-4">
          <div className="space-y-6">
            <div className="space-y-1">
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground font-normal bg-background/50 hover:bg-accent hover:text-accent-foreground border-border/50 shadow-sm"
                onClick={() => {
                  onSearchClick();
                  setIsOpen(false);
                }}
              >
                <Search className="mr-2 h-4 w-4" />
                <span>Search...</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
            </div>

            <nav className="space-y-1.5">
              <div className="px-3 mb-2 mt-4 flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Platform
                </p>
                <div className="h-px bg-border/50 flex-1" />
              </div>
              {navItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : item.activePrefixes
                  ? item.activePrefixes.some(
                      (prefix) =>
                        pathname === prefix ||
                        pathname?.startsWith(prefix + "/")
                    )
                  : pathname === item.href ||
                    pathname?.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 border-l-2",
                  isActive
                    ? "bg-primary/5 text-primary border-l-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground hover:border-l-transparent border-l-transparent"
                )}
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5 shrink-0 transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <ChevronRight className="ml-auto h-4 w-4 text-primary/50" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="mt-auto border-t border-border bg-card/50 p-4">
          <div className="flex items-center justify-between px-1">
             <span className="text-xs font-medium text-muted-foreground">Theme</span>
             <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}

