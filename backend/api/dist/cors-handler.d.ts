/**
 * CORS handler for Lambda Function URLs
 * Use this if you're using Lambda Function URLs instead of API Gateway
 */
export interface CORSConfig {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    allowCredentials?: boolean;
    maxAge?: number;
}
export declare function handleCORS(origin: string | undefined, config?: Partial<CORSConfig>): {
    [key: string]: string;
};
export declare function handlePreflightRequest(config?: CORSConfig): {
    statusCode: number;
    headers: {
        [key: string]: string;
    };
    body: string;
};
//# sourceMappingURL=cors-handler.d.ts.map