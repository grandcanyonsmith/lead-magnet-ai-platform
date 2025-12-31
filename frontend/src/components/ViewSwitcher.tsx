"use client";

import { useAuth } from "@/lib/auth/context";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  UsersIcon,
  BriefcaseIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { logger } from "@/utils/logger";

interface Customer {
  customer_id: string;
  name: string;
  email: string;
  user_count: number;
}

export function ViewSwitcher() {
  const { role, viewMode, setViewMode, selectedCustomerId, customerId } =
    useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ customers: Customer[] }>(
        "/admin/agency/customers",
        {
          params: { limit: 100 },
        },
      );
      setCustomers(response.customers || []);
    } catch (error) {
      logger.debug("Error loading customers", {
        context: "ViewSwitcher",
        error,
      });
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load customers when component mounts if in agency mode or just prefetch
    if (viewMode === "agency") {
      loadCustomers();
    }
  }, [viewMode, loadCustomers]);

  // Only show for SUPER_ADMIN
  if (role !== "SUPER_ADMIN") {
    return null;
  }

  const handleSwitchToAgency = () => {
    setViewMode("agency");
    // No need to set isOpen, Menu handles it
  };

  const handleSwitchToSubaccount = (customerId?: string) => {
    setViewMode("subaccount", customerId);
    // No need to set isOpen, Menu handles it
  };

  const currentCustomer = customers.find(
    (c) => c.customer_id === selectedCustomerId || c.customer_id === customerId,
  );

  return (
    <Menu as="div" className="relative">
      <MenuButton
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-200 hover:border-gray-300 touch-target min-h-[44px] sm:min-h-0 w-full justify-between focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="Switch view mode"
        onClick={() => {
          // Ensure customers are loaded when menu opens
          if (customers.length === 0) loadCustomers();
        }}
      >
        <div className="flex items-center gap-2">
          {viewMode === "agency" ? (
            <>
              <BriefcaseIcon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden md:inline">Agency View</span>
            </>
          ) : (
            <>
              <UsersIcon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden md:inline">
                {currentCustomer ? currentCustomer.name : "Subaccount View"}
              </span>
            </>
          )}
        </div>
        <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
      </MenuButton>

      <Transition
        enter="transition duration-100 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-75 ease-out"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <MenuItems className="absolute right-0 mt-2 w-72 origin-top-right bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[calc(100vh-8rem)] flex flex-col focus:outline-none">
          <div className="p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              Switch View
            </h3>
          </div>
          <div className="p-2 overflow-y-auto flex-1">
            <MenuItem>
              {({ focus }) => (
                <button
                  onClick={handleSwitchToAgency}
                  className={`w-full text-left px-3 py-2.5 sm:py-2 rounded-md text-sm transition-colors touch-target ${
                    viewMode === "agency"
                      ? "bg-primary-100 text-primary-700 font-medium"
                      : focus
                        ? "bg-gray-50 text-gray-900"
                        : "text-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BriefcaseIcon className="w-4 h-4 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">Agency View</div>
                      <div className="text-xs text-gray-500">
                        Manage all users and accounts
                      </div>
                    </div>
                  </div>
                </button>
              )}
            </MenuItem>

            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="px-3 py-1.5 sm:py-1 text-xs font-semibold text-gray-500 uppercase">
                Subaccounts
              </div>
              {isLoading ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  Loading...
                </div>
              ) : customers.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No customers found
                </div>
              ) : (
                <div className="max-h-48 sm:max-h-60 overflow-y-auto">
                  {customers.map((customer) => (
                    <MenuItem key={customer.customer_id}>
                      {({ focus }) => (
                        <button
                          onClick={() =>
                            handleSwitchToSubaccount(customer.customer_id)
                          }
                          className={`w-full text-left px-3 py-2.5 sm:py-2 rounded-md text-sm transition-colors touch-target ${
                            (selectedCustomerId === customer.customer_id ||
                              customerId === customer.customer_id) &&
                            viewMode === "subaccount"
                              ? "bg-primary-100 text-primary-700 font-medium"
                              : focus
                                ? "bg-gray-50 text-gray-900"
                                : "text-gray-700"
                          }`}
                        >
                          <div className="flex items-center justify-between min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">
                                {customer.name || customer.customer_id}
                              </div>
                              <div className="text-xs text-gray-500">
                                {customer.user_count}{" "}
                                {customer.user_count === 1 ? "user" : "users"}
                              </div>
                            </div>
                          </div>
                        </button>
                      )}
                    </MenuItem>
                  ))}
                </div>
              )}
            </div>
          </div>
        </MenuItems>
      </Transition>
    </Menu>
  );
}
