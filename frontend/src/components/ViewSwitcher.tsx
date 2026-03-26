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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/DropdownMenu";
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
    if (viewMode === "agency") {
      loadCustomers();
    }
  }, [viewMode, loadCustomers]);

  if (role !== "SUPER_ADMIN") {
    return null;
  }

  const handleSwitchToAgency = () => {
    setViewMode("agency");
  };

  const handleSwitchToSubaccount = (custId?: string) => {
    setViewMode("subaccount", custId);
  };

  const currentCustomer = customers.find(
    (c) => c.customer_id === selectedCustomerId || c.customer_id === customerId,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 touch-target min-h-[44px] sm:min-h-0 w-full justify-between focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="Switch view mode"
        onClick={() => {
          if (customers.length === 0) loadCustomers();
        }}
      >
        <div className="flex items-center gap-2">
          {viewMode === "agency" ? (
            <>
              <BriefcaseIcon className="w-4 h-4 flex-shrink-0 text-gray-700 dark:text-gray-200" />
              <span className="hidden md:inline">Agency View</span>
            </>
          ) : (
            <>
              <UsersIcon className="w-4 h-4 flex-shrink-0 text-gray-700 dark:text-gray-200" />
              <span className="hidden md:inline">
                {currentCustomer ? currentCustomer.name : "Subaccount View"}
              </span>
            </>
          )}
        </div>
        <ChevronDownIcon className="w-4 h-4 flex-shrink-0 text-gray-700 dark:text-gray-200" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-72 max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col"
      >
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            Switch View
          </h3>
        </div>
        <div className="p-2 overflow-y-auto flex-1">
          <DropdownMenuItem
            onClick={handleSwitchToAgency}
            className={`px-3 py-2.5 sm:py-2 rounded-md text-sm ${
              viewMode === "agency"
                ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <BriefcaseIcon className="w-4 h-4 flex-shrink-0 text-gray-700 dark:text-gray-300" />
              <div className="min-w-0">
                <div className="font-medium truncate">Agency View</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Manage all users and accounts
                </div>
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuLabel className="px-3 py-1.5 sm:py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
            Subaccounts
          </DropdownMenuLabel>
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              Loading...
            </div>
          ) : customers.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No customers found
            </div>
          ) : (
            <div className="max-h-48 sm:max-h-60 overflow-y-auto">
              {customers.map((customer) => (
                <DropdownMenuItem
                  key={customer.customer_id}
                  onClick={() =>
                    handleSwitchToSubaccount(customer.customer_id)
                  }
                  className={`px-3 py-2.5 sm:py-2 rounded-md text-sm ${
                    (selectedCustomerId === customer.customer_id ||
                      customerId === customer.customer_id) &&
                    viewMode === "subaccount"
                      ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between min-w-0 w-full">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {customer.name || customer.customer_id}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {customer.user_count}{" "}
                        {customer.user_count === 1 ? "user" : "users"}
                      </div>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
