#!/usr/bin/env node

/**
 * Authorize a user by creating necessary DynamoDB records and setting Cognito attributes
 * Usage: node scripts/admin/authorize-user.js <email>
 */

const { CognitoIdentityProviderClient, AdminGetUserCommand, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const crypto = require('crypto');
require('dotenv').config();

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || 'us-east-1_asu0YOrBD';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users';
const CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE || 'leadmagnet-customers';
const STRIPE_SECRET_NAME = process.env.STRIPE_SECRET_NAME || 'leadmagnet/stripe-api-key';

const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

async function getStripeApiKey() {
  try {
    const command = new GetSecretValueCommand({ SecretId: STRIPE_SECRET_NAME });
    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      return null;
    }

    try {
      const parsed = JSON.parse(response.SecretString);
      return parsed.STRIPE_SECRET_KEY || parsed.secretKey || parsed.secret_key || response.SecretString;
    } catch {
      return response.SecretString;
    }
  } catch (error) {
    console.error('Error fetching Stripe API key:', error);
    return null;
  }
}

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
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode === 200 || res.statusCode === 201) {
              console.log('✓ Created Stripe customer:', response.id);
              resolve(response.id);
            } else {
              console.warn('⚠️  Stripe API error:', response);
              resolve(null);
            }
          } catch (error) {
            console.warn('⚠️  Error parsing Stripe response:', error.message);
            resolve(null);
          }
        });
      });
      req.on('error', (error) => {
        console.warn('⚠️  Error creating Stripe customer:', error.message);
        resolve(null);
      });
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.warn('⚠️  Error in createStripeCustomer:', error.message);
    return null;
  }
}

async function authorizeUser(email) {
  console.log(`\n🔐 Authorizing user: ${email}`);
  console.log(`User Pool: ${USER_POOL_ID}`);
  console.log(`Region: ${AWS_REGION}\n`);

  // Step 1: Get user from Cognito
  console.log('Step 1: Getting user from Cognito...');
  let cognitoUser;
  try {
    const response = await cognitoClient.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    }));
    cognitoUser = response;
    console.log('✓ User found in Cognito');
    console.log(`   User ID: ${response.Username}`);
    console.log(`   Status: ${response.UserStatus}`);
  } catch (error) {
    console.error('❌ Error getting user from Cognito:', error.message);
    process.exit(1);
  }

  const userId = cognitoUser.Username;
  const userEmail = cognitoUser.UserAttributes.find(attr => attr.Name === 'email')?.Value || email;
  const userName = cognitoUser.UserAttributes.find(attr => attr.Name === 'name')?.Value || 
                   cognitoUser.UserAttributes.find(attr => attr.Name === 'custom:name')?.Value ||
                   email.split('@')[0];

  // Step 2: Generate or get customer_id
  console.log('\nStep 2: Generating customer_id...');
  let customerId = cognitoUser.UserAttributes.find(attr => attr.Name === 'custom:customer_id')?.Value;
  
  if (!customerId) {
    // Generate customer_id using same algorithm as postConfirmation Lambda
    customerId = crypto.createHash('sha256')
      .update(userEmail.toLowerCase())
      .digest('hex')
      .substring(0, 16);
    console.log(`✓ Generated customer_id: ${customerId}`);
  } else {
    console.log(`✓ Found existing customer_id: ${customerId}`);
  }

  // Step 3: Set customer_id in Cognito
  console.log('\nStep 3: Setting customer_id in Cognito...');
  try {
    await cognitoClient.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
      UserAttributes: [
        {
          Name: 'custom:customer_id',
          Value: customerId,
        },
      ],
    }));
    console.log('✓ Set customer_id in Cognito');
  } catch (error) {
    console.error('❌ Error setting customer_id:', error.message);
    process.exit(1);
  }

  // Step 4: Create Stripe customer
  console.log('\nStep 4: Creating Stripe customer...');
  const stripeCustomerId = await createStripeCustomer(userEmail, userName, customerId);

  // Step 5: Create customer record in DynamoDB
  console.log('\nStep 5: Creating customer record in DynamoDB...');
  const now = new Date().toISOString();
  try {
    const customerItem = {
      customer_id: customerId,
      name: userName,
      email: userEmail,
      created_at: now,
      updated_at: now,
      current_period_usage: 0,
      current_period_tokens: 0,
      current_period_cost_usd: 0,
      current_period_upcharge_usd: 0,
    };
    
    if (stripeCustomerId) {
      customerItem.stripe_customer_id = stripeCustomerId;
    }
    
    await dynamodb.send(new PutCommand({
      TableName: CUSTOMERS_TABLE,
      Item: customerItem,
    }));
    console.log('✓ Created customer record');
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      console.log('⚠️  Customer record already exists, updating...');
      const updateExpression = stripeCustomerId 
        ? 'SET updated_at = :updated_at, stripe_customer_id = :stripe_customer_id'
        : 'SET updated_at = :updated_at';
      
      const expressionValues = {
        ':updated_at': now,
      };
      
      if (stripeCustomerId) {
        expressionValues[':stripe_customer_id'] = stripeCustomerId;
      }
      
      const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
      await dynamodb.send(new UpdateCommand({
        TableName: CUSTOMERS_TABLE,
        Key: { customer_id: customerId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionValues,
      }));
      console.log('✓ Updated customer record');
    } else {
      console.error('❌ Error creating customer record:', error.message);
      process.exit(1);
    }
  }

  // Step 6: Create user record in DynamoDB
  console.log('\nStep 6: Creating user record in DynamoDB...');
  try {
    const role = cognitoUser.UserAttributes.find(attr => attr.Name === 'custom:role')?.Value || 'USER';
    
    await dynamodb.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        user_id: userId,
        email: userEmail,
        name: userName,
        customer_id: customerId,
        role: role,
        created_at: now,
        updated_at: now,
      },
    }));
    console.log('✓ Created user record');
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      console.log('⚠️  User record already exists, updating...');
      const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
      await dynamodb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { user_id: userId },
        UpdateExpression: 'SET customer_id = :customer_id, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':customer_id': customerId,
          ':updated_at': now,
        },
      }));
      console.log('✓ Updated user record');
    } else {
      console.error('❌ Error creating user record:', error.message);
      process.exit(1);
    }
  }

  console.log('\n✅ User authorized successfully!');
  console.log(`   Email: ${userEmail}`);
  console.log(`   Name: ${userName}`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Customer ID: ${customerId}`);
  if (stripeCustomerId) {
    console.log(`   Stripe Customer ID: ${stripeCustomerId}`);
  }
  console.log('\nThe user can now log in and access the application.');
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/admin/authorize-user.js <email>');
  console.error('Example: node scripts/admin/authorize-user.js user@example.com');
  process.exit(1);
}

if (!email.includes('@')) {
  console.error('Error: Invalid email format');
  process.exit(1);
}

authorizeUser(email)
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });









