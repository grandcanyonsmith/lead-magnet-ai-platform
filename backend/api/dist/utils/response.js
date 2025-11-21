"use strict";
/**
 * Standardized response helpers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.created = created;
exports.noContent = noContent;
exports.paginatedList = paginatedList;
exports.listResponse = listResponse;
exports.withHeaders = withHeaders;
exports.withContentType = withContentType;
/**
 * Create a success response
 */
function success(data, statusCode = 200) {
    return {
        statusCode,
        body: data,
    };
}
/**
 * Create a created response (201)
 */
function created(data) {
    return success(data, 201);
}
/**
 * Create a no content response (204)
 */
function noContent() {
    return {
        statusCode: 204,
        body: {},
    };
}
/**
 * Create a paginated list response
 */
function paginatedList(items, options = {}) {
    const { total, offset, limit, hasMore, resourceName = 'items' } = options;
    const response = {
        [resourceName]: items,
        count: items.length,
    };
    if (total !== undefined) {
        response.total = total;
    }
    if (offset !== undefined) {
        response.offset = offset;
    }
    if (limit !== undefined) {
        response.limit = limit;
    }
    if (hasMore !== undefined) {
        response.has_more = hasMore;
    }
    return {
        statusCode: 200,
        body: response,
    };
}
/**
 * Create a list response
 */
function listResponse(items, resourceName = 'items') {
    return {
        statusCode: 200,
        body: {
            [resourceName]: items,
            count: items.length,
        },
    };
}
/**
 * Add headers to a response
 */
function withHeaders(response, headers) {
    return {
        ...response,
        headers: {
            ...response.headers,
            ...headers,
        },
    };
}
/**
 * Set content type on response
 */
function withContentType(response, contentType) {
    return withHeaders(response, { 'Content-Type': contentType });
}
//# sourceMappingURL=response.js.map