import {
  GetBucketLocationCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../utils/env";
import { logger } from "../utils/logger";

export interface ShellExecutorUploadItem {
  key: string;
  file_name: string;
  size_bytes: number;
  last_modified?: string;
  object_url: string;
}

export interface ShellExecutorUploadsResponse {
  bucket: string | null;
  prefix: string | null;
  items: ShellExecutorUploadItem[];
  count: number;
}

const s3Client = new S3Client({ region: env.awsRegion });
const bucketRegionCache = new Map<string, string>();

const resolveBucketRegion = async (bucket: string): Promise<string> => {
  if (bucketRegionCache.has(bucket)) {
    return bucketRegionCache.get(bucket)!;
  }

  try {
    const response = await s3Client.send(
      new GetBucketLocationCommand({ Bucket: bucket }),
    );
    const raw = response.LocationConstraint;
    const normalized =
      raw === "EU" ? "eu-west-1" : raw || "us-east-1";
    bucketRegionCache.set(bucket, normalized);
    return normalized;
  } catch (error: any) {
    const fallback = env.awsRegion || "us-east-1";
    logger.warn("[ShellExecutorUploadsService] Failed to resolve bucket region", {
      bucket,
      error: error?.message || String(error),
    });
    bucketRegionCache.set(bucket, fallback);
    return fallback;
  }
};

const encodeS3Key = (key: string) =>
  key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const buildObjectUrl = (bucket: string, key: string, region: string): string => {
  const host =
    region === "us-east-1"
      ? `${bucket}.s3.amazonaws.com`
      : `${bucket}.s3.${region}.amazonaws.com`;
  return `https://${host}/${encodeS3Key(key)}`;
};

const normalizePrefix = (value: string): string => {
  const cleaned = value.trim().replace(/^\/+/, "");
  if (!cleaned) return "";
  return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
};

const sanitizeSubdir = (value?: string): string => {
  if (!value) return "";
  const cleaned = value.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!cleaned || cleaned.includes("..")) return "";
  return cleaned;
};

const applyTemplate = (template: string, data: Record<string, string>) =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => data[key] || "");

const resolveUploadPrefix = (tenantId: string, jobId: string): string => {
  const template = env.shellExecutorUploadPrefixTemplate || "";
  const prefixOverride = env.shellExecutorUploadPrefix || "";
  const data = {
    tenant_id: tenantId,
    job_id: jobId,
  };

  const templateKeys = Array.from(template.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map(
    (match) => match[1],
  );
  const hasUnknownKey = templateKeys.some((key) => !(key in data));

  const basePrefix =
    template && !hasUnknownKey ? applyTemplate(template, data) : prefixOverride;

  let normalized = normalizePrefix(basePrefix);
  if (!normalized && tenantId && jobId) {
    normalized = normalizePrefix(`leadmagnet/${tenantId}/${jobId}`);
  }
  return normalized;
};

export class ShellExecutorUploadsService {
  async listJobUploads(params: {
    tenantId: string;
    jobId: string;
    subdir?: string;
  }): Promise<ShellExecutorUploadsResponse> {
    const bucket = env.shellExecutorUploadBucket || null;
    if (!bucket) {
      return { bucket: null, prefix: null, items: [], count: 0 };
    }

    const basePrefix = resolveUploadPrefix(params.tenantId, params.jobId);
    if (!basePrefix) {
      return { bucket, prefix: null, items: [], count: 0 };
    }

    let subdir = sanitizeSubdir(params.subdir);
    const mode = (env.shellExecutorUploadMode || "").toLowerCase();
    if (!subdir && mode === "dist") {
      subdir = sanitizeSubdir(env.shellExecutorUploadDistSubdir || "dist");
    }

    const prefix = normalizePrefix(
      subdir ? `${basePrefix}${subdir}` : basePrefix,
    );

    const items: ShellExecutorUploadItem[] = [];
    const bucketRegion = await resolveBucketRegion(bucket);
    let continuationToken: string | undefined;

    do {
      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const entry of response.Contents ?? []) {
        if (!entry.Key || entry.Key.endsWith("/")) continue;
        const fileName = entry.Key.split("/").pop() || entry.Key;
        items.push({
          key: entry.Key,
          file_name: fileName,
          size_bytes: entry.Size ?? 0,
          last_modified: entry.LastModified?.toISOString(),
          object_url: buildObjectUrl(bucket, entry.Key, bucketRegion),
        });
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    items.sort((a, b) => a.key.localeCompare(b.key));

    return {
      bucket,
      prefix,
      items,
      count: items.length,
    };
  }
}

export const shellExecutorUploadsService = new ShellExecutorUploadsService();
