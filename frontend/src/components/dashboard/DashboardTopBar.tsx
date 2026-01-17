"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Menu, Search, LogOut, Settings } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Avatar } from "@/components/ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { UserImpersonation } from "@/components/UserImpersonation";

interface DashboardTopBarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSearchClick: () => void;
  user: any;
  role: string | null;
  signOut: () => void;
}

export function DashboardTopBar({
  isSidebarOpen,
  onToggleSidebar,
  onSearchClick,
  user,
  role,
  signOut,
}: DashboardTopBarProps) {
  const fallbackInitial = user?.name?.[0] || user?.email?.[0] || "U";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex h-14 items-center gap-2 sm:h-16">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            aria-expanded={isSidebarOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm sm:h-9 sm:w-9">
              <svg
                className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5"
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
            <span className="text-sm font-semibold text-foreground sm:text-base">
              Lead Magnet AI
            </span>
            <div className="hidden min-w-0 md:flex">
              <Breadcrumbs className="ml-2 min-w-0" listClassName="min-w-0" />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onSearchClick}
              aria-label="Open search"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
            >
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger as={Fragment}>
                  <button
                    type="button"
                    aria-label="Open user menu"
                    className="flex h-9 w-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  >
                    <Avatar
                      className="h-9 w-9 rounded-full border border-border/60 bg-background shadow-sm"
                      src={user?.image}
                      alt={user?.name || "User avatar"}
                      fallback={fallbackInitial}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end" side="bottom">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-sm font-medium">Notifications</span>
                    <NotificationBell layer="account_menu" />
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <Link
                        href="/dashboard/settings"
                        className="flex w-full items-center"
                      >
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
                        <div className="mt-1 px-2 py-1">
                          <UserImpersonation />
                        </div>
                      </DropdownMenuGroup>
                    </>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={signOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
