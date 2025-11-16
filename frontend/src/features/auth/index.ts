/**
 * Auth feature barrel exports
 */

export * from './types'
export * from './hooks/useAuth'
// Re-export auth service functions but not types (already exported from types)
export { authService, signIn, signUp, signOut, getCurrentUser, getSession, isAuthenticated, AuthProvider, useAuth } from './lib'

