import { settingsController } from "../../controllers/settings";
import { ValidationError } from "../../utils/errors";

const context = {
  sourceIp: "127.0.0.1",
  event: {
    headers: {},
    requestContext: {},
  } as any,
  auth: {
    realUserId: "user_123",
    actingUserId: "user_123",
    role: "ADMIN",
    customerId: "customer_123",
    isImpersonating: false,
  },
};

describe("settingsController.update", () => {
  it("does not echo the request body in validation errors", async () => {
    expect.assertions(4);

    try {
      await settingsController.update(
        {},
        {
          contact_email: "not-an-email",
          tool_secrets: { openai: "sk-secret" },
        },
        {},
        undefined,
        context as any,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details).not.toHaveProperty("body");
      expect((error as ValidationError).details).toHaveProperty("errors");
      expect((error as ValidationError).details?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "contact_email" }),
        ]),
      );
    }
  });
});
