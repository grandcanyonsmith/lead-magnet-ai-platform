/**
 * Cognito PostConfirmation Lambda handler
 * Sets customer_id custom attribute for new users
 * Creates a new customer record if needed
 * Creates Stripe customer for billing
 */
const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const crypto = require('crypto');

const cognitoClient = new CognitoIdentityProviderClient({});
const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({});

const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users';
const CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE || 'leadmagnet-customers';
const STRIPE_SECRET_NAME = process.env.STRIPE_SECRET_NAME || 'leadmagnet/stripe-api-key';

// Cache Stripe API key
let cachedStripeKey = null;

/**
 * Get Stripe API key from Secrets Manager (cached)
 */
async function getStripeApiKey() {
  if (cachedStripeKey) {
    return cachedStripeKey;
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: STRIPE_SECRET_NAME });
    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      console.warn('Stripe API key not found in secrets manager');
      return null;
    }

    let apiKey;
    try {
      const parsed = JSON.parse(response.SecretString);
      apiKey = parsed.STRIPE_SECRET_KEY || parsed.secretKey || parsed.secret_key || response.SecretString;
    } catch {
      apiKey = response.SecretString;
    }

    cachedStripeKey = apiKey;
    return apiKey;
  } catch (error) {
    console.error('Error fetching Stripe API key:', error);
    return null;
  }
}

/**
 * Create Stripe customer using Stripe API
 * Uses native https module to avoid bundling Stripe SDK
 */
async function createStripeCustomer(email, name, customerId) {
  try {
    const apiKey = await getStripeApiKey();
    
    if (!apiKey) {
      console.warn('Stripe API key not available, skipping Stripe customer creation');
      return null;
    }

    const https = require('https');
    const querystring = require('querystring');

    const postData = querystring.stringify({
      email: email,
      name: name,
      'metadata[customer_id]': customerId,
    });

    const options = {
      hostname: 'api.stripe.com',
      port: 443,
      path: '/v1/customers',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode === 200 || res.statusCode === 201) {
              console.log('Created Stripe customer:', response.id);
              resolve(response.id);
            } else {
              console.error('Stripe API error:', response);
              resolve(null);
            }
          } catch (error) {
            console.error('Error parsing Stripe response:', error);
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error creating Stripe customer:', error);
        resolve(null);
      });

      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('Error in createStripeCustomer:', error);
    return null;
  }
}

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
      await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: userId,
        UserAttributes: [
          {
            Name: 'custom:customer_id',
            Value: customerId,
          },
        ],
      }));
      
      console.log('Set customer_id for user', { userId, customerId });
    }
    
    // Create Stripe customer
    const stripeCustomerId = await createStripeCustomer(email, name, customerId);
    
    // Create or update customer record
    const now = new Date().toISOString();
    try {
      const customerItem = {
        customer_id: customerId,
        name: name,
        email: email,
        created_at: now,
        updated_at: now,
        current_period_usage: 0,
      };
      
      // Add Stripe customer ID if created successfully
      if (stripeCustomerId) {
        customerItem.stripe_customer_id = stripeCustomerId;
      }
      
      await dynamodb.send(new PutCommand({
        TableName: CUSTOMERS_TABLE,
        Item: customerItem,
        ConditionExpression: 'attribute_not_exists(customer_id)', // Only create if doesn't exist
      }));
      console.log('Created customer record', { customerId, stripeCustomerId });
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        // Customer already exists, update timestamp and Stripe ID if available
        const updateExpression = stripeCustomerId 
          ? 'SET updated_at = :updated_at, stripe_customer_id = :stripe_customer_id'
          : 'SET updated_at = :updated_at';
        
        const expressionValues = {
          ':updated_at': now,
        };
        
        if (stripeCustomerId) {
          expressionValues[':stripe_customer_id'] = stripeCustomerId;
        }
        
        await dynamodb.send(new UpdateCommand({
          TableName: CUSTOMERS_TABLE,
          Key: { customer_id: customerId },
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionValues,
        }));
        console.log('Updated existing customer record', { customerId, stripeCustomerId });
      } else {
        throw error;
      }
    }
    
    // Create or update user record
    const role = event.request.userAttributes['custom:role'] || 'USER';
    try {
      await dynamodb.send(new PutCommand({
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
      }));
      console.log('Created user record', { userId, customerId });
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        // User already exists, update it
        await dynamodb.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { user_id: userId },
          UpdateExpression: 'SET customer_id = :customer_id, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':customer_id': customerId,
            ':updated_at': now,
          },
        }));
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
