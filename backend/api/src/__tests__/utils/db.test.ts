import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

// Unmock AWS SDK to allow aws-sdk-client-mock to work
jest.unmock("@aws-sdk/client-dynamodb");
jest.unmock("@aws-sdk/lib-dynamodb");

// Set env vars before importing db
process.env.WORKFLOWS_TABLE = "workflows";
process.env.WORKFLOW_VERSIONS_TABLE = "workflow-versions";
process.env.FORMS_TABLE = "forms";
process.env.TEMPLATES_TABLE = "templates";
process.env.SUBMISSIONS_TABLE = "submissions";
process.env.NOTIFICATIONS_TABLE = "notifications";
process.env.USER_SETTINGS_TABLE = "settings";
process.env.AWS_REGION = "us-east-1";

import { db, normalizeQueryResult, docClient } from "../../utils/db";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("DynamoDB Service", () => {
  beforeAll(() => {
    console.error("docClient:", docClient);
  });

  it("check docClient", () => {
    expect(docClient).toBeDefined();
  });

  beforeEach(() => {
    ddbMock.reset();
  });

  describe("get", () => {
    it("should get an item", async () => {
      ddbMock.on(GetCommand).resolves({
        Item: { id: "1", name: "test" },
      });

      const result = await db.get("test-table", { id: "1" });
      expect(result).toEqual({ id: "1", name: "test" });
      expect(ddbMock.calls()).toHaveLength(1);
    });

    it("should return undefined if item not found", async () => {
      ddbMock.on(GetCommand).resolves({});

      const result = await db.get("test-table", { id: "1" });
      expect(result).toBeUndefined();
    });
  });

  describe("put", () => {
    it("should put an item", async () => {
      ddbMock.on(PutCommand).resolves({});

      const item = { id: "1", name: "test" };
      const result = await db.put("test-table", item);
      expect(result).toEqual(item);
      expect(ddbMock.calls()).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("should update an item", async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: { id: "1", name: "updated" },
      });

      const result = await db.update(
        "test-table",
        { id: "1" },
        { name: "updated" }
      );
      expect(result).toEqual({ id: "1", name: "updated" });
      expect(ddbMock.calls()).toHaveLength(1);
    });

    it("should throw error if table name is invalid", async () => {
      await expect(db.update("", { id: "1" }, { name: "u" })).rejects.toThrow("Table name is required");
    });

    it("should throw error if key is invalid", async () => {
      await expect(db.update("t", {}, { name: "u" })).rejects.toThrow("Key is required");
    });

    it("should throw error if updates are empty", async () => {
      await expect(db.update("t", { id: "1" }, {})).rejects.toThrow("Updates object is required");
    });

    it("should throw error if all updates are undefined", async () => {
        await expect(db.update("t", { id: "1" }, { name: undefined })).rejects.toThrow("Updates object must contain at least one non-undefined value");
    });

    it("should throw error if update returns no attributes", async () => {
        ddbMock.on(UpdateCommand).resolves({});
        await expect(db.update("t", { id: "1" }, { name: "test" })).rejects.toThrow("DynamoDB update operation completed but returned no attributes");
    });
  });

  describe("delete", () => {
    it("should delete an item", async () => {
      ddbMock.on(DeleteCommand).resolves({});

      await db.delete("test-table", { id: "1" });
      expect(ddbMock.calls()).toHaveLength(1);
    });
  });

  describe("query", () => {
    it("should query items", async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [{ id: "1" }, { id: "2" }],
        LastEvaluatedKey: { id: "2" },
      });

      const result = await db.query(
        "test-table",
        "index",
        "pk = :pk",
        { ":pk": "123" }
      );

      expect(result.items).toHaveLength(2);
      expect(result.lastEvaluatedKey).toEqual({ id: "2" });
    });

    it("should handle optional params", async () => {
        ddbMock.on(QueryCommand).resolves({ Items: [] });
        await db.query("t", undefined, "pk=:pk", { ":pk": "1" }, { "#n": "name" }, 10, { id: "start" });
        expect(ddbMock.calls()).toHaveLength(1);
    });
  });

  describe("scan", () => {
    it("should scan items", async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [{ id: "1" }],
      });

      const result = await db.scan("test-table", 10);
      expect(result).toHaveLength(1);
    });
  });

  describe("normalizeQueryResult", () => {
      it("should handle array input", () => {
          expect(normalizeQueryResult([1, 2])).toEqual([1, 2]);
      });

      it("should handle object input with items", () => {
          expect(normalizeQueryResult({ items: [1, 2] })).toEqual([1, 2]);
      });
  });
});
