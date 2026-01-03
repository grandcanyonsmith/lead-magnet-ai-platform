import { db } from "../../utils/db";
import { logger } from "../../utils/logger";
import { env } from "../../utils/env";
import { ApiError } from "../../utils/errors";

const USERS_TABLE = env.usersTable;
const CUSTOMERS_TABLE = env.customersTable;

export class AdminService {
  async listUsers(searchTerm?: string, limit: number = 50): Promise<any[]> {
    try {
      let users: any[];

      if (searchTerm) {
        const allUsers = await db.scan(USERS_TABLE, 1000);
        const searchLower = searchTerm.toLowerCase();
        users = allUsers
          .filter((user: any) => {
            const email = (user.email || "").toLowerCase();
            const name = (user.name || "").toLowerCase();
            return email.includes(searchLower) || name.includes(searchLower);
          })
          .slice(0, limit);
      } else {
        users = await db.scan(USERS_TABLE, limit);
      }

      return users.map((user: any) => ({
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        customer_id: user.customer_id,
        role: user.role || "USER",
        created_at: user.created_at,
      }));
    } catch (error) {
      logger.error("[AdminService] Error listing users", {
        error: error instanceof Error ? error.message : String(error),
        searchTerm,
      });
      throw new ApiError("Failed to list users", 500);
    }
  }

  async listAgencyUsers(searchTerm?: string, limit: number = 100, customerId?: string): Promise<any[]> {
    try {
      const allUsers = await db.scan(USERS_TABLE, 1000);
      let users = customerId 
        ? allUsers.filter((user: any) => user.customer_id === customerId)
        : allUsers;

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        users = users.filter((user: any) => {
          const email = (user.email || "").toLowerCase();
          const name = (user.name || "").toLowerCase();
          return email.includes(searchLower) || name.includes(searchLower);
        });
      }

      users = users.slice(0, limit);

      return users.map((user: any) => ({
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        customer_id: user.customer_id,
        role: user.role || "USER",
        created_at: user.created_at,
        updated_at: user.updated_at,
      }));
    } catch (error) {
      logger.error("[AdminService] Error listing agency users", {
        error: error instanceof Error ? error.message : String(error),
        searchTerm,
      });
      throw new ApiError("Failed to list agency users", 500);
    }
  }

  async updateUserRole(userId: string, role: string, customerId?: string): Promise<any> {
    const user = await db.get(USERS_TABLE, { user_id: userId });
    if (!user) {
      throw new ApiError("User not found", 404);
    }

    if (user.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      const allUsers = await db.scan(USERS_TABLE, 1000);
      const superAdmins = allUsers.filter(
        (u: any) => u.role === "SUPER_ADMIN" && u.user_id !== userId,
      );
      if (superAdmins.length === 0) {
        throw new ApiError("Cannot demote the last SUPER_ADMIN", 400);
      }
    }

    const updateData: any = {
      role,
      updated_at: new Date().toISOString(),
    };

    if (customerId) {
      updateData.customer_id = customerId;
    }

    const updated = await db.update(
      USERS_TABLE,
      { user_id: userId },
      updateData,
    );

    if (!updated) {
      throw new ApiError("Failed to update user", 500);
    }

    return {
      user_id: updated.user_id,
      email: updated.email,
      name: updated.name,
      customer_id: updated.customer_id,
      role: updated.role,
    };
  }

  async listAgencyCustomers(searchTerm?: string, limit: number = 100): Promise<any[]> {
    try {
      const allCustomers = await db.scan(CUSTOMERS_TABLE, 1000);
      let customers = allCustomers;

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        customers = allCustomers.filter((customer: any) => {
          const name = (customer.name || "").toLowerCase();
          const email = (customer.email || "").toLowerCase();
          const customerId = (customer.customer_id || "").toLowerCase();
          return (
            name.includes(searchLower) ||
            email.includes(searchLower) ||
            customerId.includes(searchLower)
          );
        });
      }

      customers = customers.slice(0, limit);

      const allUsers = await db.scan(USERS_TABLE, 1000);
      return customers.map((customer: any) => {
        const customerUsers = allUsers.filter(
          (u: any) => u.customer_id === customer.customer_id,
        );
        return {
          customer_id: customer.customer_id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          timezone: customer.timezone,
          user_count: customerUsers.length,
          created_at: customer.created_at,
          updated_at: customer.updated_at,
        };
      });
    } catch (error) {
      logger.error("[AdminService] Error listing agency customers", {
        error: error instanceof Error ? error.message : String(error),
        searchTerm,
      });
      throw new ApiError("Failed to list agency customers", 500);
    }
  }
}

export const adminService = new AdminService();
