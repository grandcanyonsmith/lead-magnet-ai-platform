/**
 * Example test for error handling utilities
 */

import { ApiError, ValidationError, NotFoundError, handleError } from '../../utils/errors';

describe('Error Handling', () => {
  describe('ApiError', () => {
    it('should create an error with message and status code', () => {
      const error = new ApiError('Test error', 400);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ApiError');
    });

    it('should include error code and details', () => {
      const error = new ApiError('Test error', 400, 'TEST_ERROR', { field: 'value' });
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ field: 'value' });
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with 400 status', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error with 404 status', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('handleError', () => {
    it('should handle ApiError instances', () => {
      const error = new ApiError('Test error', 400, 'TEST_ERROR');
      const result = handleError(error);
      expect(result.statusCode).toBe(400);
      expect(result.body.error).toBe('Test error');
      expect(result.body.code).toBe('TEST_ERROR');
    });

    it('should handle standard Error instances', () => {
      const error = new Error('Standard error');
      const result = handleError(error);
      expect(result.statusCode).toBe(500);
      expect(result.body.error).toBe('Internal server error');
    });

    it('should include stack trace in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      const result = handleError(error);
      expect(result.body.message).toBe('Test error');
      expect(result.body.stack).toBeDefined();
    });
  });
});

