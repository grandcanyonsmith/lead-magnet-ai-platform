#!/usr/bin/env node
/**
 * Script to create a template via API
 * Usage: node create-template.js <email> <password>
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'https://czp5b77azd.execute-api.us-east-1.amazonaws.com';

async function createTemplate(email, password) {
  try {
    // Step 1: Authenticate with Cognito
    console.log('Authenticating...');
    const cognitoResponse = await axios.post(
      'https://cognito-idp.us-east-1.amazonaws.com/',
      {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.COGNITO_CLIENT_ID || '', // You'll need to set this
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      },
      {
        headers: {
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
          'Content-Type': 'application/x-amz-json-1.1',
        },
      }
    );

    const idToken = cognitoResponse.data.AuthenticationResult.IdToken;

    // Step 2: Read template HTML
    const templateHtml = fs.readFileSync(
      path.join(__dirname, 'templates/sample-template.html'),
      'utf-8'
    );

    // Step 3: Create template via API
    console.log('Creating template...');
    const response = await axios.post(
      `${API_URL}/admin/templates`,
      {
        template_name: 'Professional Lead Magnet Template',
        template_description: 'A beautiful, responsive template for lead magnets',
        html_content: templateHtml,
        is_published: true,
      },
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Template created successfully!');
    console.log('Template ID:', response.data.template_id);
    console.log('Template Version:', response.data.version);
    return response.data;
  } catch (error) {
    console.error('Error creating template:', error.response?.data || error.message);
    throw error;
  }
}

// Get email and password from command line or environment
const email = process.argv[2] || process.env.EMAIL;
const password = process.argv[3] || process.env.PASSWORD;

if (!email || !password) {
  console.error('Usage: node create-template.js <email> <password>');
  console.error('Or set EMAIL and PASSWORD environment variables');
  process.exit(1);
}

createTemplate(email, password)
  .then((template) => {
    console.log('\nTemplate created:', template);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to create template:', error);
    process.exit(1);
  });

