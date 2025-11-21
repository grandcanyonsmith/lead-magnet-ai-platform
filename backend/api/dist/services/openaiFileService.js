"use strict";
/**
 * OpenAI File Service
 * Handles file upload, indexing, and search using OpenAI's Files API and Assistants API
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFileToOpenAI = uploadFileToOpenAI;
exports.searchFiles = searchFiles;
exports.searchFilesSimple = searchFilesSimple;
exports.deleteFileFromOpenAI = deleteFileFromOpenAI;
const openaiService_1 = require("./openaiService");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
/**
 * Upload a file to OpenAI for indexing
 * @param fileBuffer - File buffer
 * @param filename - Original filename
 * @param customerId - Customer ID for metadata
 * @param purpose - File purpose (default: 'assistants' for file search)
 * @returns OpenAI file ID
 */
async function uploadFileToOpenAI(fileBuffer, filename, customerId, purpose = 'assistants') {
    try {
        const openai = await (0, openaiService_1.getOpenAIClient)();
        // In Node.js, OpenAI SDK accepts File, Blob, or ReadableStream
        // Create a File-like object using the buffer
        // For Node.js, we can use the buffer directly or create a Blob
        const { Readable } = await Promise.resolve().then(() => __importStar(require('stream')));
        const stream = Readable.from(fileBuffer);
        // Upload file to OpenAI
        // OpenAI SDK for Node.js accepts File, Blob, or a stream
        const uploadedFile = await openai.files.create({
            file: stream, // Cast to any since OpenAI SDK accepts various types
            purpose: purpose,
        });
        logger_1.logger.info('[OpenAI File Service] File uploaded to OpenAI', {
            openaiFileId: uploadedFile.id,
            filename,
            customerId,
            size: fileBuffer.length,
        });
        return uploadedFile.id;
    }
    catch (error) {
        logger_1.logger.error('[OpenAI File Service] Error uploading file to OpenAI', {
            error: error instanceof Error ? error.message : String(error),
            filename,
            customerId,
        });
        throw new errors_1.ApiError('Failed to upload file to OpenAI', 500);
    }
}
/**
 * Search files for a customer using OpenAI
 * Uses Assistants API with file search capability
 * @param customerId - Customer ID to filter files
 * @param query - Search query
 * @param openaiFileIds - List of OpenAI file IDs to search (should be filtered by customerId)
 * @returns Search results with AI response
 */
async function searchFiles(customerId, query, openaiFileIds) {
    try {
        if (openaiFileIds.length === 0) {
            return {
                response: 'No files available to search.',
                fileIds: [],
            };
        }
        const openai = await (0, openaiService_1.getOpenAIClient)();
        // Create a temporary assistant for file search
        // Note: In production, you might want to maintain a persistent assistant per customer
        const assistant = await openai.beta.assistants.create({
            name: `File Search Assistant - ${customerId}`,
            instructions: 'You are a helpful assistant that searches through customer files and provides relevant information based on the query.',
            model: 'gpt-4o',
            tools: [{ type: 'file_search' }],
        });
        try {
            // Create a thread
            const thread = await openai.beta.threads.create({
                tool_resources: {
                    file_search: {
                        vector_store_ids: [],
                    },
                },
            });
            // Add files to vector store
            // Note: OpenAI's file_search requires files to be in a vector store
            // For now, we'll use a simpler approach with the Assistants API
            // In production, you'd want to create vector stores per customer
            // Add message to thread
            await openai.beta.threads.messages.create(thread.id, {
                role: 'user',
                content: query,
            });
            // Run the assistant
            const run = await openai.beta.threads.runs.create(thread.id, {
                assistant_id: assistant.id,
            });
            // Wait for completion (simplified - in production use polling)
            let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            let attempts = 0;
            while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
                if (attempts++ > 30) {
                    throw new errors_1.ApiError('Search timeout', 500);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            }
            if (runStatus.status !== 'completed') {
                throw new errors_1.ApiError(`Search failed: ${runStatus.status}`, 500);
            }
            // Get messages
            const messages = await openai.beta.threads.messages.list(thread.id);
            const assistantMessage = messages.data.find(m => m.role === 'assistant');
            if (!assistantMessage || !assistantMessage.content[0] || assistantMessage.content[0].type !== 'text') {
                throw new errors_1.ApiError('No response from assistant', 500);
            }
            const responseText = assistantMessage.content[0].text.value;
            // Extract referenced file IDs from annotations
            const referencedFileIds = [];
            if (assistantMessage.content[0].type === 'text' && assistantMessage.content[0].text.annotations) {
                for (const annotation of assistantMessage.content[0].text.annotations) {
                    if (annotation.type === 'file_citation' && 'file_id' in annotation) {
                        referencedFileIds.push(annotation.file_id);
                    }
                }
            }
            logger_1.logger.info('[OpenAI File Service] File search completed', {
                customerId,
                query: query.substring(0, 100),
                referencedFileIds: referencedFileIds.length,
            });
            return {
                response: responseText,
                fileIds: referencedFileIds,
            };
        }
        finally {
            // Clean up assistant
            try {
                await openai.beta.assistants.del(assistant.id);
            }
            catch (error) {
                logger_1.logger.warn('[OpenAI File Service] Error deleting assistant', { error });
            }
        }
    }
    catch (error) {
        logger_1.logger.error('[OpenAI File Service] Error searching files', {
            error: error instanceof Error ? error.message : String(error),
            customerId,
            query,
        });
        if (error instanceof errors_1.ApiError) {
            throw error;
        }
        throw new errors_1.ApiError('Failed to search files', 500);
    }
}
/**
 * Simplified file search using direct file retrieval
 * This is a simpler approach that retrieves file content and uses chat completion
 * @param customerId - Customer ID
 * @param query - Search query
 * @param openaiFileIds - List of OpenAI file IDs
 * @returns Search results
 */
async function searchFilesSimple(customerId, query, openaiFileIds) {
    try {
        if (openaiFileIds.length === 0) {
            return {
                response: 'No files available to search.',
                fileIds: [],
            };
        }
        const openai = await (0, openaiService_1.getOpenAIClient)();
        // For each file, retrieve its content and include in context
        // Note: This is a simplified approach. For better results, use vector stores
        const fileContents = [];
        for (const fileId of openaiFileIds.slice(0, 10)) { // Limit to 10 files for context
            try {
                const fileContent = await openai.files.content(fileId);
                const text = await fileContent.text();
                fileContents.push({ fileId, content: text.substring(0, 5000) }); // Limit content length
            }
            catch (error) {
                logger_1.logger.warn('[OpenAI File Service] Error retrieving file content', {
                    fileId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        if (fileContents.length === 0) {
            return {
                response: 'No file content could be retrieved.',
                fileIds: [],
            };
        }
        // Build context from files
        const context = fileContents
            .map(fc => `[File ${fc.fileId}]:\n${fc.content}`)
            .join('\n\n---\n\n');
        // Use chat completion to answer query
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that searches through customer files and provides relevant information based on the query. Only reference information from the provided files.',
                },
                {
                    role: 'user',
                    content: `Query: ${query}\n\nFiles:\n${context}`,
                },
            ],
            max_tokens: 1000,
        });
        const response = completion.choices[0]?.message?.content || 'No response generated.';
        logger_1.logger.info('[OpenAI File Service] File search completed (simple)', {
            customerId,
            query: query.substring(0, 100),
            filesSearched: fileContents.length,
        });
        return {
            response,
            fileIds: fileContents.map(fc => fc.fileId),
        };
    }
    catch (error) {
        logger_1.logger.error('[OpenAI File Service] Error in simple file search', {
            error: error instanceof Error ? error.message : String(error),
            customerId,
            query,
        });
        throw new errors_1.ApiError('Failed to search files', 500);
    }
}
/**
 * Delete a file from OpenAI
 * @param openaiFileId - OpenAI file ID
 */
async function deleteFileFromOpenAI(openaiFileId) {
    try {
        const openai = await (0, openaiService_1.getOpenAIClient)();
        await openai.files.del(openaiFileId);
        logger_1.logger.info('[OpenAI File Service] File deleted from OpenAI', {
            openaiFileId,
        });
    }
    catch (error) {
        logger_1.logger.error('[OpenAI File Service] Error deleting file from OpenAI', {
            error: error instanceof Error ? error.message : String(error),
            openaiFileId,
        });
        // Don't throw - file might already be deleted
    }
}
//# sourceMappingURL=openaiFileService.js.map