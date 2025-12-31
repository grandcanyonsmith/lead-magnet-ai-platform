function endsWith(uri, suffix) {
  return uri.length >= suffix.length && uri.substring(uri.length - suffix.length) === suffix;
}

function isStaticAsset(uri) {
  // Skip common static asset extensions (but NOT Next.js exported route payloads: .txt)
  return (
    endsWith(uri, '.js') ||
    endsWith(uri, '.css') ||
    endsWith(uri, '.map') ||
    endsWith(uri, '.png') ||
    endsWith(uri, '.jpg') ||
    endsWith(uri, '.jpeg') ||
    endsWith(uri, '.gif') ||
    endsWith(uri, '.webp') ||
    endsWith(uri, '.svg') ||
    endsWith(uri, '.ico') ||
    endsWith(uri, '.woff') ||
    endsWith(uri, '.woff2') ||
    endsWith(uri, '.ttf') ||
    endsWith(uri, '.eot') ||
    endsWith(uri, '.json') ||
    endsWith(uri, '.xml')
  );
}

function stripTrailingSlash(uri) {
  if (uri.length > 1 && uri.charAt(uri.length - 1) === '/') {
    return uri.substring(0, uri.length - 1);
  }
  return uri;
}

function handler(event) {
  var request = event.request;
  var uri = request.uri || '/';

  // Leave Next.js build assets and any requests that already target a file
  if (uri.startsWith('/_next/') || uri.startsWith('/assets/') || isStaticAsset(uri)) {
    return request;
  }

  // Normalize
  uri = stripTrailingSlash(uri);

  // Next.js static export uses .txt route payloads (RSC). Rewrite those too.
  var isTxt = false;
  if (endsWith(uri, '.txt')) {
    isTxt = true;
    uri = uri.substring(0, uri.length - 4);
    uri = stripTrailingSlash(uri);
  } else if (endsWith(uri, '.html')) {
    // Allow direct .html requests to pass through (no rewrite needed)
    return request;
  }

  // CloudFront Functions run before origin fetch. We can rewrite the origin URI while preserving
  // the viewer URL (rewrite, not redirect). This is required for dynamic routes in static export.
  // Dynamic route rewrites:
  // - /dashboard/jobs/<id>           -> /dashboard/jobs/_.html
  // - /dashboard/workflows/<id>      -> /dashboard/workflows/_.html
  // - /dashboard/workflows/<id>/edit -> /dashboard/workflows/_/edit.html
  // - /dashboard/forms/<id>/edit     -> /dashboard/forms/_/edit.html
  // - /v1/forms/<slug...>            -> /v1/forms/_.html
  var parts = uri.split('/');

  if (parts.length >= 4 && parts[1] === 'dashboard' && parts[2] === 'jobs' && parts[3] && parts[3] !== '_') {
    uri = '/dashboard/jobs/_';
  } else if (parts.length >= 4 && parts[1] === 'dashboard' && parts[2] === 'workflows' && parts[3] && parts[3] !== '_') {
    if (parts.length >= 5 && parts[4] === 'edit') {
      uri = '/dashboard/workflows/_/edit';
    } else {
      uri = '/dashboard/workflows/_';
    }
  } else if (parts.length >= 5 && parts[1] === 'dashboard' && parts[2] === 'forms' && parts[3] && parts[3] !== '_' && parts[4] === 'edit') {
    uri = '/dashboard/forms/_/edit';
  } else if (parts.length >= 3 && parts[1] === 'v1' && parts[2] === 'forms') {
    // Anything under /v1/forms/* is a dynamic slug - serve the exported placeholder
    uri = '/v1/forms/_';
  }

  // Map clean URLs to static export files.
  if (uri === '' || uri === '/') {
    request.uri = isTxt ? '/index.txt' : '/index.html';
  } else {
    request.uri = uri + (isTxt ? '.txt' : '.html');
  }

  return request;
}

