/**
 * Example test for BaseController
 */

import { BaseController } from '../../controllers/base.controller';
import { ApiError } from '../../utils/errors';
import { setupDynamoDBItem, resetMocks } from '../utils/awsMocks';
import { db } from '../../utils/db';

// Create a test controller that extends BaseController
class TestController extends BaseController {
  async testGet(tableName: string, key: Record<string, any>, tenantId: string) {
    return this.get(tableName, key, tenantId, 'test-resource');
  }

  async testList(tableName: string, indexName: string | undefined, tenantId: string, queryParams: Record<string, any>) {
    return this.list(tableName, indexName, tenantId, queryParams);
  }
}

describe('BaseController', () => {
  let controller: TestController;

  beforeEach(() => {
    controller = new TestController();
    resetMocks();
  });

  describe('validateTenantAccess', () => {
    it('should throw 404 if resource does not exist', async () => {
      await expect(
        controller.testGet('test-table', { id: 'missing' }, 'tenant-1')
      ).rejects.toThrow(ApiError);
    });

    it('should throw 403 if resource belongs to different tenant', async () => {
      setupDynamoDBItem('test-table', { id: 'test-1' }, {
        id: 'test-1',
        tenant_id: 'tenant-2',
      });

      await expect(
        controller.testGet('test-table', { id: 'test-1' }, 'tenant-1')
      ).rejects.toThrow(ApiError);
    });

    it('should return resource if tenant matches', async () => {
      const item = {
        id: 'test-1',
        tenant_id: 'tenant-1',
        name: 'Test Resource',
      };
      setupDynamoDBItem('test-table', { id: 'test-1' }, item);

      const result = await controller.testGet('test-table', { id: 'test-1' }, 'tenant-1');
      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual(item);
    });
  });

  describe('filterDeleted', () => {
    it('should filter out soft-deleted items', () => {
      const items = [
        { id: '1', deleted_at: null },
        { id: '2', deleted_at: '2024-01-01T00:00:00Z' },
        { id: '3' },
      ];
      const filtered = (controller as any).filterDeleted(items);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((i: any) => i.id)).toEqual(['1', '3']);
    });
  });

  describe('sortByCreatedAtDesc', () => {
    it('should sort items by created_at descending', () => {
      const items = [
        { id: '1', created_at: '2024-01-01T00:00:00Z' },
        { id: '2', created_at: '2024-01-03T00:00:00Z' },
        { id: '3', created_at: '2024-01-02T00:00:00Z' },
      ];
      const sorted = (controller as any).sortByCreatedAtDesc(items);
      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });
  });
});

