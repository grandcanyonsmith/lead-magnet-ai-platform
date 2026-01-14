function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // CloudFront Function (ES5.1):
    // Next.js `output: "export"` produces static `.html` files.
    // For dynamic routes we export a placeholder `_` page and the client reads params from the URL.
    //
    // This rewrite makes deep links work by mapping dynamic paths -> exported placeholder pages.
    //
    // Examples (see `frontend/out/`):
    // - /v1/forms/<slug>                -> /v1/forms/_.html
    // - /dashboard/jobs/<jobId>         -> /dashboard/jobs/_.html
    // - /dashboard/workflows/<id>       -> /dashboard/workflows/_.html
    // - /dashboard/workflows/<id>/edit  -> /dashboard/workflows/_/edit.html
    // - /dashboard/forms/<id>/edit      -> /dashboard/forms/_/edit.html

    // Root path
    if (uri === "/") {
        request.uri = "/index.html";
        return request;
    }

    // If the URI already has an extension, do nothing (static assets, .html, .txt, etc.)
    if (uri.indexOf(".") !== -1) {
        return request;
    }

    // Trailing-slash directory
    if (uri.length > 1 && uri.charAt(uri.length - 1) === "/") {
        request.uri = uri + "index.html";
        return request;
    }

    // ---- Dynamic route rewrites (to `_` placeholders) ----
    if (/^\/v1\/forms\/[^\/]+$/.test(uri)) {
        request.uri = "/v1/forms/_.html";
        return request;
    }

    if (/^\/dashboard\/jobs\/[^\/]+$/.test(uri)) {
        request.uri = "/dashboard/jobs/_.html";
        return request;
    }

    if (/^\/dashboard\/workflows\/[^\/]+$/.test(uri)) {
        request.uri = "/dashboard/workflows/_.html";
        return request;
    }

    if (/^\/dashboard\/workflows\/[^\/]+\/edit$/.test(uri)) {
        request.uri = "/dashboard/workflows/_/edit.html";
        return request;
    }

    if (/^\/dashboard\/forms\/[^\/]+\/edit$/.test(uri)) {
        request.uri = "/dashboard/forms/_/edit.html";
        return request;
    }

    // Default: treat as a normal static page route
    request.uri = uri + ".html";
    
    return request;
}
