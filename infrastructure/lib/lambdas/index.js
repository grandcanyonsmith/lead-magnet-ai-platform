exports.handler = async (event) => {
  // Auto-confirm the user
  event.response.autoConfirmUser = true;
  
  // Auto-verify email
  event.response.autoVerifyEmail = true;

  return event;
};
