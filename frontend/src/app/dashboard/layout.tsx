"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
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
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";

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
      <div className="min-h-screen bg-muted/30 text-foreground font-sans">
        <DashboardTopBar
          isSidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onSearchClick={() => setSearchOpen(true)}
          user={user}
          role={role}
          signOut={signOut}
        />

        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          onSearchClick={() => setSearchOpen(true)}
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
              <div className="mx-auto max-w-[1600px] w-full">{children}</div>
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
