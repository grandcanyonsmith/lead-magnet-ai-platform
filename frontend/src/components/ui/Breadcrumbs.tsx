"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, HomeIcon } from "@heroicons/react/24/outline";

export function Breadcrumbs() {
  const pathname = usePathname();
  
  // Don't show on dashboard root or if pathname is missing
  if (!pathname || pathname === "/dashboard") return null;

  const segments = pathname.split("/").filter(Boolean);
  // Remove first segment "dashboard" if present to avoid duplication
  const dashboardIndex = segments.indexOf("dashboard");
  const displaySegments = dashboardIndex >= 0 ? segments.slice(dashboardIndex + 1) : segments;

  if (displaySegments.length === 0) return null;

  return (
    <nav className="flex mb-4 sm:mb-6" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li>
          <div>
            <Link 
              href="/dashboard" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <HomeIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />
              <span className="sr-only">Dashboard</span>
            </Link>
          </div>
        </li>
        {displaySegments.map((segment, index) => {
          // Construct href relative to dashboard
          const href = `/dashboard/${displaySegments.slice(0, index + 1).join("/")}`;
          const isLast = index === displaySegments.length - 1;
          
          // Format segment label:
          // 1. replace hyphens with spaces
          // 2. capitalize words
          // 3. handle special cases like IDs (basic check for long alphanumerics)
          let label = segment.replace(/-/g, " ");
          
          // If segment looks like an ID (long alphanumeric), truncate or label it
          if (segment.length > 20 && /\d/.test(segment)) {
             label = "Details"; 
          } else {
             label = label.replace(/\b\w/g, (c) => c.toUpperCase());
          }

          return (
            <li key={href}>
              <div className="flex items-center">
                <ChevronRightIcon
                  className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-muted-foreground/50"
                  aria-hidden="true"
                />
                <Link
                  href={href}
                  className={`ml-2 text-xs sm:text-sm font-medium transition-colors ${
                    isLast
                      ? "text-foreground pointer-events-none"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-current={isLast ? "page" : undefined}
                >
                  {label}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

