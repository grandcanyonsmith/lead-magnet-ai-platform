/**
 * Backward compatibility exports for auth module
 * Re-exports from the new refactored auth structure
 */

// Re-export service functions for backward compatibility
export { authService } from "./service";
export {
  signIn,
  signUp,
  forgotPassword,
  confirmForgotPassword,
  signOut,
  getCurrentUser,
  getSession,
  isAuthenticated,
  getIdToken,
} from "./legacy";

// Re-export types
export type { AuthResponse, AuthUser } from "@/types/auth";

// Re-export new components
export { AuthProvider, useAuth } from "./context";
