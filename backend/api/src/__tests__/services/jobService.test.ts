import { db } from "../../utils/db";
import { jobService } from "../../services/jobs/jobService";

describe("jobService.listJobs", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("falls back to safe pagination defaults for invalid query params", async () => {
    const querySpy = jest
      .spyOn(db, "query")
      .mockResolvedValueOnce({
        items: [
          {
            job_id: "job_1",
            tenant_id: "tenant_123",
            created_at: "2024-01-02T00:00:00Z",
          },
          {
            job_id: "job_2",
            tenant_id: "tenant_123",
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
        lastEvaluatedKey: undefined,
      } as any)
      .mockResolvedValueOnce({
        items: [
          {
            job_id: "job_1",
            tenant_id: "tenant_123",
            created_at: "2024-01-02T00:00:00Z",
          },
          {
            job_id: "job_2",
            tenant_id: "tenant_123",
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
      } as any);

    const result = await jobService.listJobs("tenant_123", {
      limit: "abc",
      offset: "not-a-number",
    });

    expect(querySpy).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      "gsi_tenant_created",
      "tenant_id = :tenant_id",
      { ":tenant_id": "tenant_123" },
      undefined,
      20,
    );
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
    expect(result.jobs).toHaveLength(2);
  });
});
