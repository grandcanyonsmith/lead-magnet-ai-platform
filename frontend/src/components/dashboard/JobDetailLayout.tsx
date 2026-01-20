import type { ReactNode } from "react";

interface JobDetailLayoutProps {
  children: ReactNode;
}

export function JobDetailLayout({ children }: JobDetailLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col min-h-full">
      <div className="mx-auto w-full max-w-3xl flex flex-col min-h-full">
        {children}
      </div>
    </div>
  );
}
