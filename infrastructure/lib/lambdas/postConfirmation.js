const crypto = require("crypto");
const {
  DynamoDBClient,
  UpdateItemCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

const ddb = new DynamoDBClient();
const cognito = new CognitoIdentityProviderClient();

function generateCustomerId(email) {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase())
    .digest("hex")
    .substring(0, 16);
}

exports.handler = async (event) => {
  console.log("PostConfirmation event:", JSON.stringify(event, null, 2));

  const attributes = event.request?.userAttributes || {};
  const { sub, email, name, fullname } = attributes;
  const { userPoolId, userName } = event;

  if (!sub || !email) {
    console.log("Missing sub or email, skipping.");
    return event;
  }

  // TODO: Implement Stripe customer creation.
  // This handler only bootstraps app identity data so auth/customer resolution works.
  // Stripe customer creation should be added separately once that flow is implemented.

  try {
    const usersTable = process.env.USERS_TABLE;
    const now = new Date().toISOString();
    const customerId =
      attributes["custom:customer_id"] || generateCustomerId(email);
    const role = attributes["custom:role"] || "USER";
    const displayName = name || fullname || userName || email.split("@")[0];

    if (userPoolId && userName) {
      const userAttributes = [
        {
          Name: "custom:customer_id",
          Value: customerId,
        },
        {
          Name: "custom:role",
          Value: role,
        },
      ];

      if (!attributes["custom:tenant_id"]) {
        userAttributes.push({
          Name: "custom:tenant_id",
          Value: customerId,
        });
      }

      await cognito.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: userPoolId,
          Username: userName,
          UserAttributes: userAttributes,
        }),
      );
    }

    if (usersTable) {
      await ddb.send(
        new UpdateItemCommand({
          TableName: usersTable,
          Key: {
            user_id: { S: sub },
          },
          UpdateExpression:
            "SET email = if_not_exists(email, :email), " +
            "#name = if_not_exists(#name, :name), " +
            "customer_id = if_not_exists(customer_id, :customer_id), " +
            "#role = if_not_exists(#role, :role), " +
            "created_at = if_not_exists(created_at, :created_at), " +
            "updated_at = :updated_at",
          ExpressionAttributeNames: {
            "#name": "name",
            "#role": "role",
          },
          ExpressionAttributeValues: {
            ":email": { S: email },
            ":name": { S: displayName },
            ":customer_id": { S: customerId },
            ":role": { S: role },
            ":created_at": { S: now },
            ":updated_at": { S: now },
          },
        }),
      );
      console.log("Ensured user record exists for confirmed user", {
        userId: sub,
        customerId,
      });
    } else {
      console.log("USERS_TABLE not configured, skipping user bootstrap");
    }
  } catch (error) {
    console.error("Error in PostConfirmation:", error);
    // Don't fail the auth flow just because of this background step failure in this temporary fix
  }

  return event;
};
