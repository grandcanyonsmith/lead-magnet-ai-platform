import { jobsController } from "../../controllers/jobs";
import { artifactsController } from "../../controllers/artifacts";
import { db } from "../../utils/db";

describe("jobsController document routing", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("prefers the artifact that matches job.output_url", async () => {
    jest.spyOn(db, "get").mockResolvedValueOnce({
      job_id: "job_123",
      tenant_id: "tenant_123",
      output_url: "https://cdn.example.com/final.json",
      artifacts: ["artifact_report", "artifact_final", "artifact_image"],
    } as any);
    jest.spyOn(db, "batchGet").mockResolvedValueOnce([
      {
        artifact_id: "artifact_report",
        artifact_type: "report_markdown",
        artifact_name: "report.md",
      },
      {
        artifact_id: "artifact_final",
        artifact_type: "json_final",
        artifact_name: "final.json",
        public_url: "https://cdn.example.com/final.json",
      },
      {
        artifact_id: "artifact_image",
        artifact_type: "image",
        artifact_name: "hero.png",
      },
    ] as any);
    const getContentSpy = jest
      .spyOn(artifactsController, "getContent")
      .mockResolvedValue({
        statusCode: 200,
        body: '{"ok":true}',
      } as any);

    await jobsController.getDocument("tenant_123", "job_123");

    expect(getContentSpy).toHaveBeenCalledWith("tenant_123", "artifact_final");
  });

  it("serves json_final documents from the public route", async () => {
    jest.spyOn(db, "get").mockResolvedValueOnce({
      job_id: "job_456",
      tenant_id: "tenant_456",
      artifacts: ["artifact_report", "artifact_final", "artifact_image"],
    } as any);
    jest.spyOn(db, "batchGet").mockResolvedValueOnce([
      {
        artifact_id: "artifact_report",
        artifact_type: "report_markdown",
        artifact_name: "report.md",
      },
      {
        artifact_id: "artifact_final",
        artifact_type: "json_final",
        artifact_name: "final.json",
      },
      {
        artifact_id: "artifact_image",
        artifact_type: "image",
        artifact_name: "cover.png",
      },
    ] as any);
    const getContentSpy = jest
      .spyOn(artifactsController, "getContent")
      .mockResolvedValue({
        statusCode: 200,
        body: '{"public":true}',
      } as any);

    await jobsController.getPublicDocument("job_456");

    expect(getContentSpy).toHaveBeenCalledWith("tenant_456", "artifact_final");
  });
});
