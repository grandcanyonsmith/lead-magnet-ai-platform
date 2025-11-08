/**
 * Cognito PreSignUp Lambda handler
 * Auto-confirms users and auto-verifies email addresses
 */
exports.handler = async (event) => {
  try {
    console.log('PreSignUp Lambda triggered', JSON.stringify(event, null, 2));
    
    // Ensure event structure is correct
    if (!event) {
      throw new Error('Event is null or undefined');
    }
    
    // Initialize response object if it doesn't exist
    if (!event.response) {
      event.response = {};
    }
    
    // Auto-confirm user and auto-verify email
    // These are the only fields allowed in PreSignUp response
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
    
    // Note: Custom attributes cannot be set in PreSignUp trigger response
    // They must be set via PostConfirmation trigger or AdminUpdateUserAttributes
    
    console.log('PreSignUp Lambda response', JSON.stringify(event.response, null, 2));
    
    // Return the event object - Cognito expects the full event object back
    return event;
  } catch (error) {
    console.error('PreSignUp Lambda error:', error);
    // Return a valid response even on error to prevent Cognito from failing
    // Must return the full event object structure
    if (!event) {
      event = {};
    }
    if (!event.response) {
      event.response = {};
    }
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
    return event;
  }
};

