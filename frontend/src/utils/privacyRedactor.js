/**
 * HookSight Ghost Mode — Centralized Privacy Redaction Utilities
 *
 * Deterministic, semantic masking for presentation/demo privacy.
 * All functions are pure and produce consistent output for the same input.
 *
 * Ghost Mode is a PRESENTATION layer — it does NOT alter backend data,
 * authentication, authorization, or API behavior in any way.
 */

const MASK_CHAR = '•';
const SHORT_MASK = MASK_CHAR.repeat(8);
const LONG_MASK = MASK_CHAR.repeat(16);

// Keys whose values should be redacted in payload objects
const SENSITIVE_PAYLOAD_KEYS = new Set([
  'token', 'secret', 'authorization', 'password', 'api_key', 'apiKey',
  'api_secret', 'apiSecret', 'access_token', 'accessToken', 'refresh_token',
  'refreshToken', 'private_key', 'privateKey', 'client_secret', 'clientSecret',
  'ssn', 'social_security', 'card', 'card_number', 'cardNumber', 'cvv',
  'credit_card', 'creditCard', 'account_number', 'accountNumber',
  'email', 'phone', 'address', 'customer', 'customer_id', 'customerId',
  'user', 'userId', 'user_id', 'name', 'first_name', 'firstName',
  'last_name', 'lastName', 'ip', 'ip_address', 'ipAddress',
]);

/**
 * Redacts a workspace name for presentation.
 * @param {string} name
 * @returns {string}
 */
export function redactWorkspaceName(name) {
  if (!name) return 'Workspace';
  return `Workspace ${MASK_CHAR.repeat(4)}`;
}

/**
 * Redacts a project name for presentation.
 * @param {string} name
 * @returns {string}
 */
export function redactProjectName(name) {
  if (!name) return 'Project';
  return 'Demo Project';
}

/**
 * Redacts an event ID (typically a hex string like "beec3367cabf88ee8bc7c073").
 * @param {string} id
 * @returns {string}
 */
export function redactEventId(id) {
  if (!id) return `evt_${SHORT_MASK}`;
  return `evt_${SHORT_MASK}`;
}

/**
 * Redacts a request ID (typically "req_xxxxxxxx").
 * @param {string} id
 * @returns {string}
 */
export function redactRequestId(id) {
  if (!id) return '';
  return `req_${SHORT_MASK}`;
}

/**
 * Redacts an endpoint ID.
 * @param {string} id
 * @returns {string}
 */
export function redactEndpointId(id) {
  if (!id) return `ep_${SHORT_MASK}`;
  return `ep_${SHORT_MASK}`;
}

/**
 * Redacts a generic MongoDB-style _id.
 * @param {string} id
 * @returns {string}
 */
export function redactId(id) {
  if (!id) return SHORT_MASK;
  return SHORT_MASK;
}

/**
 * Redacts a URL by preserving the protocol + host but masking the path tokens/UUIDs.
 * Example: "https://webhook.site/84c0a6a7-..." → "https://webhook.site/••••••••"
 * @param {string} url
 * @returns {string}
 */
export function redactUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/${SHORT_MASK}`;
  } catch {
    // If not a valid URL, just mask the whole thing
    return SHORT_MASK;
  }
}

/**
 * Redacts a webhook ingestion URL, preserving the /api/webhooks/ path structure.
 * Example: ".../api/webhooks/a4715a2a..." → ".../api/webhooks/••••••••"
 * @param {string} url
 * @returns {string}
 */
export function redactWebhookIngestUrl(url) {
  if (!url) return '';
  const webhookPathPattern = /\/api\/webhooks\/[a-zA-Z0-9_-]+/;
  if (webhookPathPattern.test(url)) {
    return url.replace(webhookPathPattern, `/api/webhooks/${SHORT_MASK}`);
  }
  return redactUrl(url);
}

/**
 * Redacts an email address.
 * @param {string} email
 * @returns {string}
 */
export function redactEmail(email) {
  if (!email) return '';
  return `${MASK_CHAR.repeat(5)}@${MASK_CHAR.repeat(4)}.com`;
}

/**
 * Redacts a user display name.
 * @param {string} name
 * @returns {string}
 */
export function redactUserName(name) {
  if (!name) return 'Developer';
  return 'Developer';
}

/**
 * Redacts a secret/key value completely.
 * @param {string} _secret
 * @returns {string}
 */
export function redactSecret(_secret) {
  return LONG_MASK;
}

/**
 * Redacts a cURL snippet by masking the URL tokens.
 * @param {string} curlSnippet
 * @returns {string}
 */
export function redactCurlSnippet(curlSnippet) {
  if (!curlSnippet) return '';
  // Replace webhook endpoint IDs in URLs
  return curlSnippet.replace(
    /\/api\/webhooks\/[a-zA-Z0-9_-]+/g,
    `/api/webhooks/${SHORT_MASK}`
  );
}

/**
 * Redacts a full destination URL (for endpoint forwarding target).
 * @param {string} url
 * @returns {string}
 */
export function redactDestinationUrl(url) {
  return redactUrl(url);
}

/**
 * Recursively redacts sensitive values in a payload object.
 * Preserves structure and non-sensitive field values (event types, statuses, counts).
 * @param {*} payload
 * @returns {*}
 */
export function redactPayload(payload) {
  if (payload === null || payload === undefined) return payload;

  if (typeof payload === 'string') {
    // If the entire payload is a string, try to parse as JSON
    try {
      const parsed = JSON.parse(payload);
      if (typeof parsed === 'object' && parsed !== null) {
        return JSON.stringify(redactPayload(parsed), null, 2);
      }
    } catch {
      // Not JSON, return as-is (could be a simple message)
    }
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => redactPayload(item));
  }

  if (typeof payload === 'object') {
    const redacted = {};
    for (const [key, value] of Object.entries(payload)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_PAYLOAD_KEYS.has(key) || SENSITIVE_PAYLOAD_KEYS.has(lowerKey)) {
        // Redact the value but preserve type hint
        if (typeof value === 'string') {
          redacted[key] = SHORT_MASK;
        } else if (typeof value === 'number') {
          redacted[key] = 0;
        } else if (typeof value === 'object' && value !== null) {
          redacted[key] = SHORT_MASK;
        } else {
          redacted[key] = SHORT_MASK;
        }
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactPayload(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  return payload;
}

/**
 * Redacts request/response headers. Masks Authorization/Cookie/Set-Cookie values.
 * @param {object} headers
 * @returns {object}
 */
export function redactHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;

  const sensitiveHeaderKeys = new Set([
    'authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token',
    'proxy-authorization', 'x-forwarded-for', 'x-real-ip',
  ]);

  const redacted = {};
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaderKeys.has(key.toLowerCase())) {
      redacted[key] = SHORT_MASK;
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
