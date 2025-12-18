'use strict';

/**
 * Cognito Pre Sign-up trigger
 *
 * Purpose:
 * - Auto-confirm users (no email confirmation UX)
 * - Auto-verify email
 * - Ensure `custom:tenant_id` exists (immutable attribute; must be set at sign-up)
 * - Set a default `custom:role` if not provided
 */

const crypto = require('crypto');

exports.handler = async (event) => {
  event.response = event.response || {};
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;

  const attrs = (event.request && event.request.userAttributes) || {};

  if (!attrs['custom:tenant_id']) {
    attrs['custom:tenant_id'] = crypto.randomUUID();
  }

  if (!attrs['custom:role']) {
    attrs['custom:role'] = 'USER';
  }

  event.request = event.request || {};
  event.request.userAttributes = attrs;

  return event;
};


