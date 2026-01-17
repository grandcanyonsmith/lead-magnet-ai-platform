/**
 * Build a public form URL using an optional custom domain.
 * Falls back to current origin or relative path when window is unavailable.
 */
export function buildPublicFormUrl(
  slug: string,
  customDomain?: string,
): string {
  if (!slug) {
    return "";
  }

  const domain = customDomain?.trim();
  if (domain) {
    const candidate = /^https?:\/\//i.test(domain)
      ? domain
      : `https://${domain}`;
    try {
      const url = new URL(candidate);
      const result = `${url.origin}/v1/forms/${slug}`;
      return result;
    } catch (error) {
      // If parsing fails, fall through to origin
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const result = `${window.location.origin}/v1/forms/${slug}`;
    return result;
  }

  const result = `/v1/forms/${slug}`;
  return result;
}
