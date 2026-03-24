import { leadMagnetHtmlEditorController } from "../../controllers/leadMagnetHtmlEditor";
import { db } from "../../utils/db";

describe("leadMagnetHtmlEditorController", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects patch requests for jobs outside the authenticated tenant", async () => {
    jest.spyOn(db, "get").mockResolvedValueOnce({
      job_id: "job_1",
      tenant_id: "tenant_other",
    } as any);

    await expect(
      leadMagnetHtmlEditorController.patch(
        "job_1",
        { prompt: "Change the headline" },
        "tenant_123",
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("binds patch status to both job and tenant", async () => {
    jest.spyOn(db, "get").mockResolvedValueOnce({
      patch_id: "patch_1",
      job_id: "job_2",
      tenant_id: "tenant_123",
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    await expect(
      leadMagnetHtmlEditorController.getPatchStatus(
        "job_1",
        "patch_1",
        "tenant_123",
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("rejects save requests for jobs outside the authenticated tenant", async () => {
    jest.spyOn(db, "get").mockResolvedValueOnce({
      job_id: "job_1",
      tenant_id: "tenant_other",
    } as any);

    await expect(
      leadMagnetHtmlEditorController.save(
        "job_1",
        { patched_html: "<html></html>" },
        "tenant_123",
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
