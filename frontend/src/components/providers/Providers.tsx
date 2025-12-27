"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { queryClient } from "@/lib/react-query";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <Toaster
          position="top-right"
          toastOptions={{
            className: "bg-background text-foreground border border-border shadow-lg",
            duration: 4000,
            success: {
              iconTheme: {
                primary: "hsl(var(--primary))",
                secondary: "hsl(var(--primary-foreground))",
              },
            },
            error: {
              iconTheme: {
                primary: "hsl(var(--destructive))",
                secondary: "hsl(var(--destructive-foreground))",
              },
            },
          }}
        />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
