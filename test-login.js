#!/usr/bin/env node

/**
 * Test login script using amazon-cognito-identity-js (same as frontend)
 */

const {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} = require('amazon-cognito-identity-js');

const USER_POOL_ID = 'us-east-1_asu0YOrBD';
const CLIENT_ID = '4lb3j8kqfvfgkvfeb4h4naani5';

const email = 'thurstoncapitalgoods@gmail.com';
const password = 'BradenThurston2024!';

console.log('🧪 Testing login for:', email);
console.log('User Pool:', USER_POOL_ID);
console.log('Client ID:', CLIENT_ID);
console.log('');

const poolData = {
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID,
};

const userPool = new CognitoUserPool(poolData);

const authenticationData = {
  Username: email,
  Password: password,
};

const authenticationDetails = new AuthenticationDetails(authenticationData);

const userData = {
  Username: email,
  Pool: userPool,
};

const cognitoUser = new CognitoUser(userData);

console.log('Attempting authentication...');

cognitoUser.authenticateUser(authenticationDetails, {
  onSuccess: (session) => {
    console.log('✅ Login successful!');
    console.log('');
    console.log('Session details:');
    console.log('  Access Token:', session.getAccessToken().getJwtToken().substring(0, 50) + '...');
    console.log('  ID Token:', session.getIdToken().getJwtToken().substring(0, 50) + '...');
    console.log('  Refresh Token:', session.getRefreshToken().getToken().substring(0, 50) + '...');
    console.log('');
    
    // Get user attributes
    cognitoUser.getUserAttributes((err, attributes) => {
      if (err) {
        console.error('⚠️  Could not get user attributes:', err.message);
      } else {
        console.log('User attributes:');
        attributes.forEach(attr => {
          console.log(`  ${attr.getName()}: ${attr.getValue()}`);
        });
      }
      console.log('');
      console.log('✅ User can successfully log in!');
      process.exit(0);
    });
  },
  onFailure: (err) => {
    console.error('❌ Login failed:', err.message);
    console.error('Error code:', err.code);
    if (err.name) {
      console.error('Error name:', err.name);
    }
    process.exit(1);
  },
  newPasswordRequired: (userAttributes, requiredAttributes) => {
    console.log('⚠️  New password required');
    console.log('Required attributes:', requiredAttributes);
    // This shouldn't happen since we set a permanent password
    process.exit(1);
  },
});







