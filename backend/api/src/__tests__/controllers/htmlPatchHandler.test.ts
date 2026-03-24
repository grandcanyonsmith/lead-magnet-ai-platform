import { handleHtmlPatchRequest } from "../../controllers/htmlPatchHandler";
import { db } from "../../utils/db";

describe("handleHtmlPatchRequest", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("does not create or update rows when the patch request is missing", async () => {
    const getSpy = jest.spyOn(db, "get").mockResolvedValueOnce(undefined as any);
    const updateSpy = jest.spyOn(db, "update").mockResolvedValue({} as any);

    const response = (await handleHtmlPatchRequest({
      patch_id: "patch_missing",
      job_id: "job_1",
      tenant_id: "tenant_123",
    })) as { statusCode: number };

    expect(response.statusCode).toBe(500);
    expect(getSpy).toHaveBeenCalledWith(expect.any(String), {
      patch_id: "patch_missing",
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
