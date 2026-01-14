/**
 * Build a public form URL using an optional custom domain.
 * Falls back to current origin or relative path when window is unavailable.
 */
export function buildPublicFormUrl(
  slug: string,
  customDomain?: string,
): string {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'url.ts:5',message:'buildPublicFormUrl entry',data:{slug,customDomain,hasSlug:!!slug,hasWindow:typeof window!=='undefined',windowOrigin:typeof window!=='undefined'?window.location?.origin:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  if (!slug) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'url.ts:9',message:'buildPublicFormUrl - empty slug, returning empty string',data:{slug},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'url.ts:18',message:'buildPublicFormUrl - using custom domain',data:{result,domain,candidate},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return result;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'url.ts:21',message:'buildPublicFormUrl - custom domain parse failed, falling through',data:{candidate,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // If parsing fails, fall through to origin
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const result = `${window.location.origin}/v1/forms/${slug}`;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'url.ts:25',message:'buildPublicFormUrl - using window origin',data:{result,windowOrigin:window.location.origin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return result;
  }

  const result = `/v1/forms/${slug}`;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'url.ts:28',message:'buildPublicFormUrl - using relative path fallback',data:{result},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  return result;
}
