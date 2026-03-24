describe("EnvConfig#getLambdaInvokeTarget", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns the configured Lambda function name", () => {
    process.env.LAMBDA_FUNCTION_NAME = "custom-api-handler";

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EnvConfig } = require("@utils/env");
    const envConfig = new EnvConfig();

    expect(envConfig.getLambdaInvokeTarget()).toBe("custom-api-handler");
  });

  it("returns a configured Lambda ARN unchanged", () => {
    const lambdaArn =
      "arn:aws:lambda:us-east-1:123456789012:function:custom-api-handler";
    process.env.LAMBDA_FUNCTION_NAME = lambdaArn;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EnvConfig } = require("@utils/env");
    const envConfig = new EnvConfig();

    expect(envConfig.getLambdaInvokeTarget()).toBe(lambdaArn);
  });

  it("throws when the invoke target is missing", () => {
    delete process.env.LAMBDA_FUNCTION_NAME;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EnvConfig } = require("@utils/env");
    const envConfig = new EnvConfig();

    expect(() => envConfig.getLambdaInvokeTarget()).toThrow(
      "LAMBDA_FUNCTION_NAME must be configured for async Lambda invocation",
    );
  });
});
