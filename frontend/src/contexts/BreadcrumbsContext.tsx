"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type BreadcrumbMenuItem = {
  id: string;
  label: string;
  href: string;
  description?: string | null;
  isActive?: boolean;
};

export type BreadcrumbItem = {
  id: string;
  label: string;
  href?: string;
  menuItems?: BreadcrumbMenuItem[];
  menuLabel?: string;
  menuSearchPlaceholder?: string;
  menuEmptyLabel?: string;
};

type BreadcrumbsContextValue = {
  items: BreadcrumbItem[] | null;
  setItems: (items: BreadcrumbItem[] | null) => void;
  clearItems: () => void;
};

const BreadcrumbsContext = createContext<BreadcrumbsContextValue | null>(null);

export function BreadcrumbsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] = useState<BreadcrumbItem[] | null>(null);
  const clearItems = useCallback(() => setItems(null), []);

  const value = useMemo(
    () => ({ items, setItems, clearItems }),
    [items, clearItems],
  );

  return (
    <BreadcrumbsContext.Provider value={value}>
      {children}
    </BreadcrumbsContext.Provider>
  );
}

export function useBreadcrumbs() {
  const context = useContext(BreadcrumbsContext);
  if (!context) {
    throw new Error("useBreadcrumbs must be used within BreadcrumbsProvider");
  }
  return context;
}
