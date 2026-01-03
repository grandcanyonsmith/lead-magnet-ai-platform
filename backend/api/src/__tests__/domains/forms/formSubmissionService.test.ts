jest.mock("@utils/db", () => ({
  db: {
    get: jest.fn().mockResolvedValue(undefined),
    put: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@aws-sdk/client-sfn", () => ({
  SFNClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  StartExecutionCommand: jest.fn().mockImplementation((args) => args),
}));

describe("FormSubmissionService", () => {
  it("does not require name/email/phone in submission_data", async () => {
    const originalArn = process.env.STEP_FUNCTIONS_ARN;
    process.env.STEP_FUNCTIONS_ARN =
      "arn:aws:states:us-east-1:123456789012:stateMachine:test";

    // Reload module singletons (env + sfnClient) with updated env var
    jest.resetModules();

    const { db } = await import("@utils/db");
    const { SFNClient } = await import("@aws-sdk/client-sfn");
    const { formSubmissionService } = await import(
      "../../../domains/forms/services/formSubmissionService"
    );

    const result = await formSubmissionService.submitFormAndStartJob(
      {
        tenant_id: "t_1",
        form_id: "form_1",
        workflow_id: "wf_1",
        rate_limit_enabled: false,
      },
      { field_1: "hello" } as any,
      "1.2.3.4",
    );

    expect(result.jobId).toMatch(/^job_/);

    // Submission record should be written with null contact fields when not provided
    expect((db.put as any).mock.calls.length).toBeGreaterThanOrEqual(1);
    const submissionPutCall = (db.put as any).mock.calls.find(
      (call: any[]) => call[0] === process.env.SUBMISSIONS_TABLE,
    );
    expect(submissionPutCall).toBeTruthy();
    const submissionItem = submissionPutCall[1];
    expect(submissionItem).toMatchObject({
      submitter_email: null,
      submitter_name: null,
      submitter_phone: null,
    });

    // Should use Step Functions path (not local processing)
    expect(SFNClient).toHaveBeenCalled();

    process.env.STEP_FUNCTIONS_ARN = originalArn;
  });
});

