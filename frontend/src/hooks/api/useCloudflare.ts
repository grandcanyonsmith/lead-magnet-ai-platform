/**
 * Cloudflare DNS integration hooks
 */

"use client";

import { useQuery } from "@/hooks/useQuery";
import { useMutation } from "@/hooks/useMutation";
import { api } from "@/lib/api";
import { normalizeError } from "./hookHelpers";
import { toast } from "react-hot-toast";

interface CloudflareStatus {
  connected: boolean;
  connected_at: string | null;
}

interface UseCloudflareStatusResult {
  status: CloudflareStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCloudflareStatus(): UseCloudflareStatusResult {
  const { data, isLoading, error, refetch } = useQuery<CloudflareStatus>(
    ["cloudflare", "status"],
    () => api.settings.getCloudflareStatus(),
    {
      enabled: true,
      refetchInterval: false,
    }
  );

  return {
    status: data || null,
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
  };
}

interface UseConnectCloudflareResult {
  connect: (apiToken: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function useConnectCloudflare(): UseConnectCloudflareResult {
  const { mutateAsync, isPending, error } = useMutation<
    { message: string; connected: boolean },
    Error,
    string
  >(
    (apiToken: string) => api.settings.connectCloudflare(apiToken),
    {
      showSuccessToast: "Cloudflare account connected successfully",
      showErrorToast: true,
    }
  );

  return {
    connect: async (apiToken: string) => {
      try {
        const result = await mutateAsync(apiToken);
        return result.connected;
      } catch {
        return false;
      }
    },
    loading: isPending,
    error: normalizeError(error),
  };
}

interface UseCreateDNSRecordsResult {
  createRecords: (data: {
    forms_subdomain?: string;
    assets_subdomain?: string;
    cloudfront_domain: string;
  }) => Promise<{
    records_created: Array<{ name: string; type: string; content: string }>;
    errors?: Array<{ name: string; error: string }>;
  } | null>;
  loading: boolean;
  error: string | null;
}

export function useCreateDNSRecords(): UseCreateDNSRecordsResult {
  const { mutateAsync, isPending, error } = useMutation<
    {
      message: string;
      records_created: Array<{ name: string; type: string; content: string }>;
      errors?: Array<{ name: string; error: string }>;
    },
    Error,
    {
      forms_subdomain?: string;
      assets_subdomain?: string;
      cloudfront_domain: string;
    }
  >(
    (data) => api.settings.createCloudflareDNSRecords(data),
    {
      showSuccessToast: (data) => {
        const count = data.records_created.length;
        const errorCount = data.errors?.length || 0;
        if (errorCount > 0) {
          return `Created ${count} DNS record(s) with ${errorCount} error(s)`;
        }
        return `Successfully created ${count} DNS record(s)`;
      },
      showErrorToast: true,
    }
  );

  return {
    createRecords: async (data) => {
      try {
        const result = await mutateAsync(data);
        return {
          records_created: result.records_created,
          errors: result.errors,
        };
      } catch {
        return null;
      }
    },
    loading: isPending,
    error: normalizeError(error),
  };
}

interface UseDisconnectCloudflareResult {
  disconnect: () => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function useDisconnectCloudflare(): UseDisconnectCloudflareResult {
  const { mutateAsync, isPending, error } = useMutation<
    { message: string; connected: boolean },
    Error,
    void
  >(
    () => api.settings.disconnectCloudflare(),
    {
      showSuccessToast: "Cloudflare account disconnected",
      showErrorToast: true,
    }
  );

  return {
    disconnect: async () => {
      try {
        const result = await mutateAsync(undefined);
        return !result.connected;
      } catch {
        return false;
      }
    },
    loading: isPending,
    error: normalizeError(error),
  };
}
