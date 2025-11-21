/**
 * OpenAI File Service
 * Handles file upload, indexing, and search using OpenAI's Files API and Assistants API
 */
/**
 * Upload a file to OpenAI for indexing
 * @param fileBuffer - File buffer
 * @param filename - Original filename
 * @param customerId - Customer ID for metadata
 * @param purpose - File purpose (default: 'assistants' for file search)
 * @returns OpenAI file ID
 */
export declare function uploadFileToOpenAI(fileBuffer: Buffer, filename: string, customerId: string, purpose?: 'assistants' | 'fine-tune'): Promise<string>;
/**
 * Search files for a customer using OpenAI
 * Uses Assistants API with file search capability
 * @param customerId - Customer ID to filter files
 * @param query - Search query
 * @param openaiFileIds - List of OpenAI file IDs to search (should be filtered by customerId)
 * @returns Search results with AI response
 */
export declare function searchFiles(customerId: string, query: string, openaiFileIds: string[]): Promise<{
    response: string;
    fileIds: string[];
}>;
/**
 * Simplified file search using direct file retrieval
 * This is a simpler approach that retrieves file content and uses chat completion
 * @param customerId - Customer ID
 * @param query - Search query
 * @param openaiFileIds - List of OpenAI file IDs
 * @returns Search results
 */
export declare function searchFilesSimple(customerId: string, query: string, openaiFileIds: string[]): Promise<{
    response: string;
    fileIds: string[];
}>;
/**
 * Delete a file from OpenAI
 * @param openaiFileId - OpenAI file ID
 */
export declare function deleteFileFromOpenAI(openaiFileId: string): Promise<void>;
//# sourceMappingURL=openaiFileService.d.ts.map