import crypto from "crypto";
import path from "path";

describe("postConfirmation handler", () => {
  const originalEnv = process.env;
  const lambdaPath = path.resolve(
    process.cwd(),
    "../..",
    "infrastructure/lib/lambdas/postConfirmation.js",
  );

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      USERS_TABLE: "test-users",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("bootstraps Cognito attributes and a user record", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dynamodb = require("@aws-sdk/client-dynamodb");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cognito = require("@aws-sdk/client-cognito-identity-provider");

    const ddbSend = jest.fn().mockResolvedValue({});
    const cognitoSend = jest.fn().mockResolvedValue({});

    dynamodb.DynamoDBClient.mockImplementation(() => ({ send: ddbSend }));
    dynamodb.UpdateItemCommand.mockImplementation((input: unknown) => input);
    cognito.CognitoIdentityProviderClient.mockImplementation(() => ({
      send: cognitoSend,
    }));
    cognito.AdminUpdateUserAttributesCommand.mockImplementation(
      (input: unknown) => input,
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { handler } = require(lambdaPath);

    const event = {
      userPoolId: "pool-123",
      userName: "signup-user",
      request: {
        userAttributes: {
          sub: "user-123",
          email: "User@example.com",
          fullname: "Test User",
        },
      },
    };

    const result = await handler(event);
    const expectedCustomerId = crypto
      .createHash("sha256")
      .update("user@example.com")
      .digest("hex")
      .substring(0, 16);

    expect(result).toBe(event);
    expect(cognitoSend).toHaveBeenCalledWith(
      expect.objectContaining({
        UserPoolId: "pool-123",
        Username: "signup-user",
        UserAttributes: expect.arrayContaining([
          { Name: "custom:customer_id", Value: expectedCustomerId },
          { Name: "custom:role", Value: "USER" },
          { Name: "custom:tenant_id", Value: expectedCustomerId },
        ]),
      }),
    );
    expect(ddbSend).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: "test-users",
        Key: {
          user_id: { S: "user-123" },
        },
        ExpressionAttributeValues: expect.objectContaining({
          ":email": { S: "User@example.com" },
          ":name": { S: "Test User" },
          ":customer_id": { S: expectedCustomerId },
          ":role": { S: "USER" },
        }),
      }),
    );
  });

  it("skips work when required identity attributes are missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dynamodb = require("@aws-sdk/client-dynamodb");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cognito = require("@aws-sdk/client-cognito-identity-provider");

    const ddbSend = jest.fn().mockResolvedValue({});
    const cognitoSend = jest.fn().mockResolvedValue({});

    dynamodb.DynamoDBClient.mockImplementation(() => ({ send: ddbSend }));
    cognito.CognitoIdentityProviderClient.mockImplementation(() => ({
      send: cognitoSend,
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { handler } = require(lambdaPath);

    const event = {
      userPoolId: "pool-123",
      userName: "signup-user",
      request: {
        userAttributes: {
          email: "missing-sub@example.com",
        },
      },
    };

    await expect(handler(event)).resolves.toBe(event);
    expect(cognitoSend).not.toHaveBeenCalled();
    expect(ddbSend).not.toHaveBeenCalled();
  });
});
