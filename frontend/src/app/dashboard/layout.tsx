"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { authService, useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { TourProvider } from "@/components/TourProvider";
import { TourId } from "@/lib/tours";
import { NotificationBell } from "@/components/NotificationBell";
import { SearchModal } from "@/components/SearchModal";
import { ShortcutsHelpModal } from "@/components/ShortcutsHelpModal";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { UserImpersonation } from "@/components/UserImpersonation";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Settings } from "@/types/settings";
import { logger } from "@/utils/logger";
import {
  HomeIcon,
  QueueListIcon,
  UserGroupIcon,
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  // Custom user menu state to avoid Headless UI auto-closing issues with nested interactions
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (error) {
      logger.error("Failed to load settings", {
        error,
        context: "DashboardLayout",
      });
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        if (!authenticated) {
          logger.debug("Not authenticated, redirecting to login", {
            context: "DashboardLayout",
          });
          router.push("/auth/login");
        } else {
          logger.debug("Authenticated, showing dashboard", {
            context: "DashboardLayout",
          });
          setLoading(false);
          // Load settings for onboarding checklist
          await loadSettings();
        }
      } catch (error) {
        logger.error("Auth check error", { error, context: "DashboardLayout" });
        router.push("/auth/login");
      }
    };
    checkAuth();
  }, [router, loadSettings]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleStartTour = (tourId: TourId) => {
    setActiveTourId(tourId);
  };

  const handleTourComplete = async (tourId: TourId) => {
    setActiveTourId(null);

    // Mark checklist item as complete
    if (!settings) return;

    const checklist = settings.onboarding_checklist || {};
    let updatedChecklist = { ...checklist };

    if (tourId === "settings") {
      updatedChecklist.complete_profile = true;
    } else if (tourId === "create-workflow") {
      updatedChecklist.create_first_lead_magnet = true;
    } else if (tourId === "view-jobs") {
      updatedChecklist.view_generated_lead_magnets = true;
    }

    try {
      await api.updateOnboardingChecklist(updatedChecklist);
      // Reload settings to update UI
      await loadSettings();
    } catch (error) {
      logger.error("Failed to update checklist", {
        error,
        context: "DashboardLayout",
      });
      // Error is already handled by the component's error handling
      // This is just for logging
    }
  };

  const handleTourSkip = () => {
    setActiveTourId(null);
  };

  const navItems = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard", icon: HomeIcon, exact: true },
      {
        href: "/dashboard/workflows",
        label: "Lead Magnets",
        icon: QueueListIcon,
        activePrefixes: ["/dashboard/workflows"],
      },
      {
        href: "/dashboard/jobs",
        label: "Leads & Results",
        icon: UserGroupIcon,
        activePrefixes: ["/dashboard/jobs"],
      },
    ],
    [],
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
    onShortcutsHelp: () => setShortcutsHelpOpen(true),
    onNavigate: (index) => {
      if (navItems[index]) {
        router.push(navItems[index].href);
      }
    },
    onClose: () => {
      setSearchOpen(false);
      setShortcutsHelpOpen(false);
      setSidebarOpen(false);
    },
    navItemsCount: navItems.length,
    enabled: !loading,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const isEditorRoute = Boolean(pathname?.startsWith("/dashboard/editor"));

  return (
    <TourProvider
      activeTourId={activeTourId}
      onTourComplete={handleTourComplete}
      onTourSkip={handleTourSkip}
    >
      <div className="min-h-screen bg-zinc-50 lg:flex lg:flex-row">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-zinc-200">
          <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 shrink-0"
                aria-label="Open navigation"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 sm:h-9 sm:w-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white"
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
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                    Lead Magnet AI
                  </p>
                  <p className="text-[10px] sm:text-xs text-zinc-500 truncate">
                    Dashboard
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={() => setSearchOpen(true)}
                className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                aria-label="Open search"
              >
                <MagnifyingGlassIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div className="scale-90 sm:scale-100">
                <NotificationBell />
              </div>
            </div>
          </div>
        </header>

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-zinc-900/50 z-30 lg:hidden"
            onClick={() => {
              setSidebarOpen(false);
            }}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed top-0 left-0 z-40 h-screen w-[280px] max-w-[85vw] sm:max-w-[320px] bg-white shadow-xl border-r border-zinc-200 transform transition-transform duration-300 ease-in-out flex flex-col
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            lg:translate-x-0 lg:sticky lg:top-0 lg:shadow-none lg:shrink-0 lg:w-72 lg:max-w-none
          `}
          aria-label="Sidebar navigation"
        >
          {/* Mobile sidebar header with close button */}
          <div className="lg:hidden flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-zinc-200 bg-white">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="h-8 w-8 sm:h-9 sm:w-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-white"
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
              <span className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                Lead Magnet AI
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 shrink-0"
              aria-label="Close navigation"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Desktop sidebar header */}
          <div className="hidden lg:block px-4 py-4 border-b border-zinc-200 bg-white space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-sm">
                <svg
                  className="w-5 h-5 text-white"
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
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-zinc-900 truncate">
                  Lead Magnet AI
                </span>
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <nav className="px-2 sm:px-3 py-3 sm:py-4 space-y-4 sm:space-y-6">
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setSearchOpen(true);
                    setSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-2 sm:gap-3 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-100/70 transition"
                  aria-label="Open search"
                >
                  <MagnifyingGlassIcon className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-500 shrink-0" />
                  <span className="truncate">Search</span>
                  <kbd className="ml-auto hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-zinc-500 bg-white border border-zinc-200 rounded">
                    ⌘K
                  </kbd>
                </button>
              </div>

              <div className="space-y-1">
                <p className="px-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Main
                </p>
                {navItems.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : item.activePrefixes
                      ? item.activePrefixes.some(
                          (prefix) =>
                            pathname === prefix ||
                            pathname?.startsWith(prefix + "/"),
                        )
                      : pathname === item.href ||
                        pathname?.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        group flex items-center gap-2 sm:gap-3 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all duration-200
                        ${
                          isActive
                            ? "bg-primary-50 text-primary-700 ring-1 ring-primary-100"
                            : "text-zinc-700 hover:bg-zinc-100/70"
                        }
                      `}
                    >
                      <Icon
                        className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${
                          isActive
                            ? "text-primary-600"
                            : "text-zinc-500 group-hover:text-zinc-700"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <ChevronRightIcon className="ml-auto h-3 w-3 sm:h-4 sm:w-4 text-primary-500 shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>

          <div className="mt-auto px-2 sm:px-3 py-2 sm:py-3 border-t border-zinc-200 bg-white shrink-0">
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-full flex items-center justify-between rounded-lg px-1.5 sm:px-2 py-1.5 sm:py-2 hover:bg-zinc-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <span className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-zinc-200 flex items-center justify-center overflow-hidden shrink-0">
                    <span className="text-[10px] sm:text-xs font-semibold text-zinc-700">
                      {(user?.name || user?.email || "U")
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-xs sm:text-sm font-medium text-zinc-900">
                      {user?.name || user?.email || "Account"}
                    </span>
                    {user?.email && (
                      <span className="block truncate text-[10px] sm:text-xs text-zinc-500">
                        {user.email}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronUpIcon
                  className={`h-3 w-3 sm:h-4 sm:w-4 text-zinc-400 transition-transform shrink-0 ${userMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-[260px] sm:w-[280px] rounded-lg border border-zinc-200 bg-white shadow-lg ring-1 ring-black/5 z-[50]">
                  <div className="px-2.5 sm:px-3 py-2 sm:py-2.5 flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-zinc-700">
                      Notifications
                    </span>
                    <NotificationBell layer="account_menu" />
                  </div>

                  {role === "SUPER_ADMIN" && (
                    <>
                      <div className="h-px bg-zinc-100 my-1" />
                      <div className="px-2.5 sm:px-3 py-2">
                        <div className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Views
                        </div>
                        <ViewSwitcher />
                      </div>
                    </>
                  )}

                  {(role === "ADMIN" || role === "SUPER_ADMIN") && (
                    <>
                      <div className="h-px bg-zinc-100 my-1" />
                      <div className="px-2.5 sm:px-3 py-2">
                        <div className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Impersonation
                        </div>
                        <UserImpersonation />
                      </div>
                    </>
                  )}

                  <div className="h-px bg-zinc-100 my-1" />
                  <button
                    className="w-full px-2.5 sm:px-3 py-2.5 sm:py-2.5 text-xs sm:text-sm text-zinc-700 text-left hover:bg-zinc-50 transition-colors"
                    onClick={() => {
                      setSidebarOpen(false);
                      setUserMenuOpen(false);
                      router.push("/dashboard/settings");
                    }}
                  >
                    Settings
                  </button>
                  <div className="h-px bg-zinc-100 my-1" />
                  <button
                    className="w-full px-2.5 sm:px-3 py-2.5 sm:py-2.5 text-xs sm:text-sm text-red-600 text-left hover:bg-red-50 transition-colors rounded-b-lg"
                    onClick={() => {
                      setSidebarOpen(false);
                      setUserMenuOpen(false);
                      signOut();
                      router.push("/auth/login");
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 w-full">
          <ImpersonationBanner />

          {/* Page content */}
          <main
            className={
              isEditorRoute
                ? "p-0 bg-[#0c0d10] min-h-screen"
                : "p-3 sm:p-4 md:p-6 lg:p-8 bg-gray-100 min-h-screen"
            }
          >
            {isEditorRoute ? (
              <div className="w-full">{children}</div>
            ) : (
              <div className="w-full lg:rounded-xl lg:bg-white lg:p-6 xl:p-8 lg:shadow-md lg:ring-1 lg:ring-gray-200">
                <div className="mx-auto max-w-6xl w-full">{children}</div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Shortcuts Help Modal */}
      <ShortcutsHelpModal
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />

      {/* Onboarding Checklist Widget */}
      {settings && (
        <OnboardingChecklist
          settings={settings}
          onStartTour={handleStartTour}
        />
      )}
    </TourProvider>
  );
}
