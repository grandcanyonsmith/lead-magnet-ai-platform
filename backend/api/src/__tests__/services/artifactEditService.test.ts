const sendMock = jest.fn();
const responsesCreateMock = jest.fn();
const generateUrlMock = jest.fn();
const invalidateCloudFrontPathsMock = jest.fn();
const notificationsCreateMock = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({ send: sendMock })),
  GetObjectCommand: jest.fn((input) => ({ input, type: "GetObjectCommand" })),
  PutObjectCommand: jest.fn((input) => ({ input, type: "PutObjectCommand" })),
}));

jest.mock("../../services/openaiService", () => ({
  getOpenAIClient: jest.fn(async () => ({
    responses: {
      create: responsesCreateMock,
    },
  })),
}));

jest.mock("../../services/artifactUrlService", () => ({
  ArtifactUrlService: {
    generateUrl: (...args: any[]) => generateUrlMock(...args),
    isPresignedUrl: jest.fn(() => false),
  },
}));

jest.mock("../../services/cloudfrontInvalidationService", () => ({
  invalidateCloudFrontPaths: (...args: any[]) =>
    invalidateCloudFrontPathsMock(...args),
}));

jest.mock("../../controllers/notifications", () => ({
  notificationsController: {
    create: (...args: any[]) => notificationsCreateMock(...args),
  },
}));

import { db } from "../../utils/db";
import { artifactEditService } from "../../services/artifactEditService";
import { getOpenAIClient } from "../../services/openaiService";
import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

describe("artifactEditService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getOpenAIClient as jest.Mock).mockResolvedValue({
      responses: {
        create: responsesCreateMock,
      },
    });
    (GetObjectCommand as unknown as jest.Mock).mockImplementation((input) => ({
      input,
      type: "GetObjectCommand",
    }));
    (PutObjectCommand as unknown as jest.Mock).mockImplementation((input) => ({
      input,
      type: "PutObjectCommand",
    }));
  });

  it("rejects artifacts owned by another tenant", async () => {
    jest.spyOn(db, "get").mockResolvedValueOnce({
      artifact_id: "art_1",
      tenant_id: "tenant_other",
      s3_key: "tenant_other/jobs/job_1/file.txt",
      artifact_name: "file.txt",
      content_type: "text/plain",
    } as any);

    await expect(
      artifactEditService.getOwnedEditableArtifact("tenant_1", "art_1"),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("rejects unsupported artifact mime types", async () => {
    jest.spyOn(db, "get").mockResolvedValueOnce({
      artifact_id: "art_2",
      tenant_id: "tenant_1",
      s3_key: "tenant_1/jobs/job_1/image.png",
      artifact_name: "image.png",
      content_type: "image/png",
    } as any);

    await expect(
      artifactEditService.createRequest({
        tenantId: "tenant_1",
        artifactId: "art_2",
        prompt: "Make it brighter",
        model: "gpt-5.2",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("processes a JSON artifact edit and overwrites the same S3 key", async () => {
    const requestRecord = {
      edit_id: "edit_1",
      tenant_id: "tenant_1",
      artifact_id: "art_1",
      job_id: "job_1",
      s3_key: "tenant_1/jobs/job_1/data.json",
      file_name: "data.json",
      content_type: "application/json",
      prompt: "Rename the title field value to New",
      model: "gpt-5.2",
      status: "pending",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
      ttl: 123,
    };
    const artifactRecord = {
      artifact_id: "art_1",
      tenant_id: "tenant_1",
      job_id: "job_1",
      s3_key: "tenant_1/jobs/job_1/data.json",
      artifact_name: "data.json",
      content_type: "application/json",
      public_url: "https://assets.mycoursecreator360.com/tenant_1/jobs/job_1/data.json",
    };

    jest
      .spyOn(db, "get")
      .mockResolvedValueOnce(requestRecord as any)
      .mockResolvedValueOnce(artifactRecord as any);
    const updateSpy = jest
      .spyOn(db, "update")
      .mockResolvedValue({} as any);

    sendMock
      .mockResolvedValueOnce({
        Body: {
          transformToString: jest
            .fn()
            .mockResolvedValue('{"title":"Old"}'),
        },
      })
      .mockResolvedValueOnce({});

    responsesCreateMock.mockResolvedValue({
      output_text: '{"title":"New"}',
    });
    generateUrlMock.mockResolvedValue({
      url: "https://assets.mycoursecreator360.com/tenant_1/jobs/job_1/data.json",
      expiresAt: null,
    });
    invalidateCloudFrontPathsMock.mockResolvedValue(undefined);
    notificationsCreateMock.mockResolvedValue(undefined);

    await artifactEditService.processRequest("edit_1");

    const requestTableUpdates = updateSpy.mock.calls.filter(
      ([tableName]) =>
        tableName === "leadmagnet-artifact-edit-requests",
    );
    expect(
      requestTableUpdates
        .map(([, , updates]) => updates.status)
        .filter(Boolean),
    ).toEqual(["fetching", "editing", "saving", "completed"]);

    const artifactUpdateCall = updateSpy.mock.calls.find(
      ([tableName]) => tableName === "test-artifacts",
    );
    expect(artifactUpdateCall?.[2]).toEqual(
      expect.objectContaining({
        file_size_bytes: expect.any(Number),
        public_url: expect.stringContaining("https://assets.mycoursecreator360.com/tenant_1/jobs/job_1/data.json?v="),
        mime_type: "application/json",
      }),
    );

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[1][0].input).toEqual(
      expect.objectContaining({
        Bucket: "test-artifacts-bucket",
        Key: "tenant_1/jobs/job_1/data.json",
        Body: "{\n  \"title\": \"New\"\n}\n",
      }),
    );

    expect(notificationsCreateMock).toHaveBeenCalledWith(
      "tenant_1",
      "artifact_edit_completed",
      "File edit completed",
      expect.stringContaining("data.json"),
      "job_1",
      "job",
    );
  });

  it("marks the request failed when the edited JSON is invalid", async () => {
    const requestRecord = {
      edit_id: "edit_2",
      tenant_id: "tenant_1",
      artifact_id: "art_2",
      job_id: "job_1",
      s3_key: "tenant_1/jobs/job_1/data.json",
      file_name: "data.json",
      content_type: "application/json",
      prompt: "Break the JSON",
      model: "gpt-5.2",
      status: "pending",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
      ttl: 123,
    };
    const artifactRecord = {
      artifact_id: "art_2",
      tenant_id: "tenant_1",
      job_id: "job_1",
      s3_key: "tenant_1/jobs/job_1/data.json",
      artifact_name: "data.json",
      content_type: "application/json",
    };

    jest
      .spyOn(db, "get")
      .mockResolvedValueOnce(requestRecord as any)
      .mockResolvedValueOnce(artifactRecord as any);
    const updateSpy = jest
      .spyOn(db, "update")
      .mockResolvedValue({} as any);

    sendMock.mockResolvedValueOnce({
      Body: {
        transformToString: jest.fn().mockResolvedValue('{"title":"Old"}'),
      },
    });
    responsesCreateMock.mockResolvedValue({
      output_text: '{"title": invalid json}',
    });
    notificationsCreateMock.mockResolvedValue(undefined);

    await expect(artifactEditService.processRequest("edit_2")).rejects.toThrow(
      "The edited JSON is invalid",
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(
      "leadmagnet-artifact-edit-requests",
      { edit_id: "edit_2" },
      expect.objectContaining({
        status: "failed",
        error_message: expect.stringContaining("The edited JSON is invalid"),
      }),
    );
    expect(notificationsCreateMock).toHaveBeenCalledWith(
      "tenant_1",
      "artifact_edit_failed",
      "File edit failed",
      expect.stringContaining("data.json"),
      "job_1",
      "job",
    );
  });
});
