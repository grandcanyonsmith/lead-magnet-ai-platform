"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authService, useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { TourProvider } from "@/components/TourProvider";
import { TourId } from "@/lib/tours";
import { SearchModal } from "@/components/SearchModal";
import { ShortcutsHelpModal } from "@/components/ShortcutsHelpModal";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Settings } from "@/types/settings";
import { logger } from "@/utils/logger";
import { Menu, Search } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { NotificationBell } from "@/components/NotificationBell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, user, signOut, isAuthenticated, isLoading: authLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

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

  // Use the auth context instead of making a separate auth check
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        logger.debug("Not authenticated, redirecting to login", {
          context: "DashboardLayout",
        });
        router.push("/auth/login");
      } else {
        logger.debug("Authenticated, showing dashboard", {
          context: "DashboardLayout",
        });
        // Load settings for onboarding checklist
        loadSettings();
      }
    }
  }, [isAuthenticated, authLoading, router, loadSettings]);

  const handleStartTour = (tourId: TourId) => {
    setActiveTourId(tourId);
  };

  const handleTourComplete = async (tourId: TourId) => {
    setActiveTourId(null);

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
      await loadSettings();
    } catch (error) {
      logger.error("Failed to update checklist", {
        error,
        context: "DashboardLayout",
      });
    }
  };

  const handleTourSkip = () => {
    setActiveTourId(null);
  };

  const navItems = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard", exact: true },
      { href: "/dashboard/workflows", label: "Lead Magnets" },
      { href: "/dashboard/jobs", label: "Leads & Results" },
    ],
    []
  );

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
    enabled: !authLoading,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
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
      <div className="min-h-screen bg-muted/30 lg:flex lg:flex-row text-foreground font-sans">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground shrink-0"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 sm:h-9 sm:w-9 bg-primary rounded-lg flex items-center justify-center shadow-sm shrink-0">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground"
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
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                    Lead Magnet AI
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    Dashboard
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={() => setSearchOpen(true)}
                className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
                aria-label="Open search"
              >
                <Search className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div className="scale-90 sm:scale-100">
                <NotificationBell />
              </div>
            </div>
          </div>
        </header>

        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          onSearchClick={() => setSearchOpen(true)}
          user={user}
          role={role}
          signOut={signOut}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 w-full transition-all duration-300">
          <ImpersonationBanner />

          {/* Page content */}
          <main
            className={
              isEditorRoute
                ? "p-0 bg-[#0c0d10] min-h-screen"
                : "p-3 sm:p-4 md:p-6 lg:p-8 bg-muted/30 min-h-screen"
            }
          >
            {isEditorRoute ? (
              <div className="w-full">{children}</div>
            ) : (
              <div className="mx-auto max-w-[1600px] w-full">
                <Breadcrumbs />
                {children}
              </div>
            )}
          </main>
        </div>
      </div>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <ShortcutsHelpModal
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />

      {settings && (
        <OnboardingChecklist
          settings={settings}
          onStartTour={handleStartTour}
        />
      )}
    </TourProvider>
  );
}
