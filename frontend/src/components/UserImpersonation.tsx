"use client";

import { useAuth } from "@/lib/auth/context";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { AuthUser } from "@/types/auth";
import {
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

interface UserSearchResult {
  users: AuthUser[];
  count: number;
}

export function UserImpersonation() {
  const { role, refreshAuth } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const searchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<UserSearchResult>("/admin/users", {
        params: { q: searchTerm, limit: 10 },
      });
      setUsers(response.users);
    } catch (error) {
      console.error("Error searching users:", error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchUsers();
    } else {
      setUsers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const toggleOpen = () => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "UserImpersonation.tsx:toggle",
        message: "toggleOpen called",
        data: { isOpen: !isOpen },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "fix-nesting",
      }),
    }).catch(() => {});
    // #endregion
    setIsOpen(!isOpen);
    if (!isOpen) {
      // Focus input when opening - using a small timeout to ensure render
      setTimeout(() => {
        const input = document.getElementById("impersonation-search");
        if (input) input.focus();
      }, 50);
    }
  };

  // Only show for admins - must be after all hooks
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return null;
  }

  const handleImpersonate = async (targetUserId: string) => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "UserImpersonation.tsx:53",
        message: "handleImpersonate called",
        data: { targetUserId },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "3",
      }),
    }).catch(() => {});
    // #endregion
    setIsImpersonating(true);
    try {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "UserImpersonation.tsx:56",
            message: "Calling impersonate API",
            data: { targetUserId },
            timestamp: Date.now(),
            sessionId: "debug-session",
            hypothesisId: "3",
          }),
        },
      ).catch(() => {});
      // #endregion
      const response = await api.post<{ session_id: string }>(
        "/admin/impersonate",
        {
          targetUserId,
        },
      );

      // Store session ID
      localStorage.setItem("impersonation_session_id", response.session_id);

      // Refresh auth to update context
      await refreshAuth();

      setIsOpen(false);
      setSearchTerm("");
      setUsers([]);
    } catch (error) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "UserImpersonation.tsx:69",
            message: "Error impersonating",
            data: { error: String(error) },
            timestamp: Date.now(),
            sessionId: "debug-session",
            hypothesisId: "3",
          }),
        },
      ).catch(() => {});
      // #endregion
      console.error("Error starting impersonation:", error);
      toast.error("Failed to start impersonation");
    } finally {
      setIsImpersonating(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        className="px-2 sm:px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg touch-target min-h-[44px] sm:min-h-0 flex items-center justify-between w-full border border-gray-200 hover:border-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="View as user"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleOpen();
        }}
      >
        <div className="flex items-center gap-2">
          <UserIcon className="w-4 h-4" />
          <span className="hidden sm:inline">View as user</span>
        </div>
        {isOpen ? (
          <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="mt-2 border border-gray-200 rounded-xl shadow-sm bg-gray-50/50 overflow-hidden">
          <div className="p-3 border-b border-gray-200 flex-shrink-0">
            <input
              id="impersonation-search"
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                Searching...
              </div>
            ) : users.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchTerm.length < 2
                  ? "Type at least 2 characters"
                  : "No users found"}
              </div>
            ) : (
              <ul className="py-1">
                {users.map((user) => (
                  <li key={user.user_id}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleImpersonate(user.user_id);
                      }}
                      disabled={isImpersonating}
                      className="w-full text-left px-4 py-3 sm:py-2 hover:bg-white hover:shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed touch-target transition-all"
                    >
                      <div className="font-medium truncate">
                        {user.name || user.email}
                      </div>
                      <div className="text-gray-500 text-xs truncate mt-0.5">
                        {user.email}
                      </div>
                      {user.role && (
                        <div className="text-gray-400 text-xs mt-0.5">
                          Role: {user.role}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
