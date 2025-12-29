"use client";

import { Fragment } from "react";
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
  Menu,
  X,
  LogOut,
  Settings,
  Monitor,
  User,
  Shield,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/DropdownMenu";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/components/NotificationBell";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { UserImpersonation } from "@/components/UserImpersonation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSearchClick: () => void;
  user: any;
  role: string | null;
  signOut: () => void;
}

export function Sidebar({
  isOpen,
  setIsOpen,
  onSearchClick,
  user,
  role,
  signOut,
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
  ];

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-[280px] max-w-[85vw] sm:max-w-[320px] bg-card border-r border-border transform transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:w-72 lg:max-w-none"
        )}
      >
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border">
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
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-between px-6 py-5 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <svg
                className="w-5 h-5 text-primary-foreground"
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
            <span className="font-bold text-lg tracking-tight">
              Lead Magnet AI
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 py-6 px-4">
          <div className="space-y-6">
            <div className="space-y-1">
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground font-normal bg-muted/50 hover:bg-muted border-muted-foreground/10"
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
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3 mt-2">
                Platform
              </p>
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
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 border border-transparent",
                      isActive
                        ? "bg-primary/10 text-primary border-primary/10 shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground hover:border-border/50"
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

        <div className="mt-auto border-t border-border bg-card/50 p-4 space-y-4">
          <div className="flex items-center justify-between px-1">
             <span className="text-xs font-medium text-muted-foreground">Theme</span>
             <ThemeToggle />
          </div>
          
          <div className="relative w-full">
            <DropdownMenu>
              <DropdownMenuTrigger as={Fragment}>
                <Button
                  variant="ghost"
                  className="w-full justify-start px-2 py-6 h-auto hover:bg-accent group"
                >
                <Avatar
                  className="h-9 w-9 rounded-lg border-2 border-background shadow-sm mr-3"
                  fallback={user?.name?.[0] || user?.email?.[0] || "U"}
                />
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-sm font-medium truncate w-full text-left group-hover:text-accent-foreground">
                    {user?.name || "User Account"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate w-full text-left">
                    {user?.email}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-accent-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="start" side="top">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-medium">Notifications</span>
                <NotificationBell layer="account_menu" />
              </div>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Link href="/dashboard/settings" className="cursor-pointer flex w-full items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              {(role === "ADMIN" || role === "SUPER_ADMIN") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Admin Tools</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    {role === "SUPER_ADMIN" && (
                       <div className="px-2 py-1">
                         <ViewSwitcher />
                       </div>
                    )}
                    <div className="px-2 py-1 mt-1">
                      <UserImpersonation />
                    </div>
                  </DropdownMenuGroup>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                onClick={signOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </aside>
    </>
  );
}

