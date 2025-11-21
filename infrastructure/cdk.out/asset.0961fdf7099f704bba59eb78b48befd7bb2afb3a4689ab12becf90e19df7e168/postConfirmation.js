/**
 * Cognito PostConfirmation Lambda handler
 * Sets customer_id custom attribute for new users
 * Creates a new customer record if needed
 */
const AWS = require('aws-sdk');
const crypto = require('crypto');

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users';
const CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE || 'leadmagnet-customers';

exports.handler = async (event) => {
  try {
    console.log('PostConfirmation Lambda triggered', JSON.stringify(event, null, 2));
    
    const userPoolId = event.userPoolId;
    const userId = event.request.userAttributes.sub;
    const email = event.request.userAttributes.email;
    const name = event.request.userAttributes.name || event.request.userAttributes['custom:name'] || email;
    
    // Check if customer_id is already set (for existing users)
    let customerId = event.request.userAttributes['custom:customer_id'];
    
    if (!customerId) {
      // Generate a new customer_id (using email-based hash for consistency)
      // This ensures same email always gets same customer_id
      customerId = crypto.createHash('sha256')
        .update(email.toLowerCase())
        .digest('hex')
        .substring(0, 16);
      
      // Set customer_id custom attribute
      await cognito.adminUpdateUserAttributes({
        UserPoolId: userPoolId,
        Username: userId,
        UserAttributes: [
          {
            Name: 'custom:customer_id',
            Value: customerId,
          },
        ],
      }).promise();
      
      console.log('Set customer_id for user', { userId, customerId });
    }
    
    // Create or update customer record
    const now = new Date().toISOString();
    try {
      await dynamodb.put({
        TableName: CUSTOMERS_TABLE,
        Item: {
          customer_id: customerId,
          name: name,
          email: email,
          created_at: now,
          updated_at: now,
        },
        ConditionExpression: 'attribute_not_exists(customer_id)', // Only create if doesn't exist
      }).promise();
      console.log('Created customer record', { customerId });
    } catch (error) {
      if (error.code === 'ConditionalCheckFailedException') {
        // Customer already exists, just update timestamp
        await dynamodb.update({
          TableName: CUSTOMERS_TABLE,
          Key: { customer_id: customerId },
          UpdateExpression: 'SET updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':updated_at': now,
          },
        }).promise();
        console.log('Updated existing customer record', { customerId });
      } else {
        throw error;
      }
    }
    
    // Create or update user record
    const role = event.request.userAttributes['custom:role'] || 'USER';
    try {
      await dynamodb.put({
        TableName: USERS_TABLE,
        Item: {
          user_id: userId,
          email: email,
          name: name,
          customer_id: customerId,
          role: role,
          created_at: now,
          updated_at: now,
        },
        ConditionExpression: 'attribute_not_exists(user_id)', // Only create if doesn't exist
      }).promise();
      console.log('Created user record', { userId, customerId });
    } catch (error) {
      if (error.code === 'ConditionalCheckFailedException') {
        // User already exists, update it
        await dynamodb.update({
          TableName: USERS_TABLE,
          Key: { user_id: userId },
          UpdateExpression: 'SET customer_id = :customer_id, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':customer_id': customerId,
            ':updated_at': now,
          },
        }).promise();
        console.log('Updated existing user record', { userId, customerId });
      } else {
        throw error;
      }
    }
    
    return event;
  } catch (error) {
    console.error('PostConfirmation Lambda error:', error);
    // Return event even on error to prevent blocking user creation
    return event;
  }
};

