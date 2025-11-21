"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const index_1 = require("./routes/index");
const errors_1 = require("./utils/errors");
const logger_1 = require("./utils/logger");
const workflowGenerationHandler_1 = require("./handlers/workflowGenerationHandler");
const cors_handler_1 = require("./cors-handler");
const securityHeaders_1 = require("./middleware/securityHeaders");
const handler = async (event, context) => {
    // Handle workflow generation job (async Lambda invocation)
    if (event.source === 'workflow-generation-job' && event.job_id) {
        try {
            return await (0, workflowGenerationHandler_1.handleWorkflowGenerationJob)(event);
        }
        catch (error) {
            logger_1.logger.error('Error processing workflow generation job', {
                error: error.message,
                jobId: event.job_id,
                stack: error.stack,
            });
            throw error;
        }
    }
    // Normal API Gateway request
    const apiEvent = event;
    logger_1.logger.info('Incoming request', {
        path: apiEvent.rawPath,
        method: apiEvent.requestContext?.http?.method,
        requestId: context.awsRequestId,
    });
    // Handle CORS preflight requests
    if (apiEvent.requestContext?.http?.method === 'OPTIONS') {
        const origin = apiEvent.headers?.origin || apiEvent.headers?.Origin;
        const corsHeaders = (0, cors_handler_1.handleCORS)(origin);
        const securityHeaders = (0, securityHeaders_1.addSecurityHeaders)({
            statusCode: 204,
            headers: corsHeaders,
            body: {},
        });
        return {
            statusCode: 204,
            headers: securityHeaders.headers,
            body: '',
        };
    }
    try {
        // Route the request
        // Router will extract auth context internally and use customerId as tenantId
        const result = await (0, index_1.routerHandler)(apiEvent, undefined);
        // Format response
        const contentType = result.headers?.['Content-Type'] || 'application/json';
        const isTextContent = contentType.startsWith('text/') || contentType.includes('markdown');
        const body = isTextContent ? result.body : JSON.stringify(result.body);
        // Add CORS headers to all responses
        const origin = apiEvent.headers?.origin || apiEvent.headers?.Origin;
        const corsHeaders = (0, cors_handler_1.handleCORS)(origin);
        // Add security headers
        const responseWithSecurity = (0, securityHeaders_1.addSecurityHeaders)({
            statusCode: result.statusCode || 200,
            headers: {
                'Content-Type': contentType,
                ...corsHeaders,
                ...result.headers,
            },
            body: result.body,
        });
        return {
            statusCode: responseWithSecurity.statusCode,
            headers: responseWithSecurity.headers,
            body,
        };
    }
    catch (error) {
        logger_1.logger.error('Request error', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            path: apiEvent.rawPath,
            requestId: context.awsRequestId,
        });
        const errorResponse = (0, errors_1.handleError)(error, {
            requestId: context.awsRequestId,
            path: apiEvent.rawPath,
            method: apiEvent.requestContext?.http?.method,
        });
        // Add CORS headers to error responses
        const origin = apiEvent.headers?.origin || apiEvent.headers?.Origin;
        const corsHeaders = (0, cors_handler_1.handleCORS)(origin);
        // Add security headers
        const responseWithSecurity = (0, securityHeaders_1.addSecurityHeaders)({
            statusCode: errorResponse.statusCode,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
            body: errorResponse.body,
        });
        return {
            statusCode: responseWithSecurity.statusCode,
            headers: responseWithSecurity.headers,
            body: JSON.stringify(responseWithSecurity.body),
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=index.js.map