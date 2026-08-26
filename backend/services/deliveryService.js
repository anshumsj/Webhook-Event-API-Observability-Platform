/**
 * deliveryService.js
 * 
 * Handles the actual HTTP delivery of webhook payloads to the customer's configured destinationUrl.
 * 
 * Requirements:
 * - 5-10 second timeout using AbortController
 * - Only forwards safe headers (Content-Type, User-Agent)
 * - Returns success or throws an error to allow BullMQ to handle retries
 */

const TIMEOUT_MS = 10000; // 10 seconds

/**
 * Deliver a webhook payload to the given destination URL.
 * 
 * @param {Object} eventDoc - The WebhookEvent mongoose document.
 * @param {String} destinationUrl - The customer's target URL.
 * @param {String} endpointSecret - The customer's endpoint secret used for HMAC signing.
 * @returns {Object} { status, statusText } on success (2xx).
 * @throws {Error} On network failure, timeout, or non-2xx status code.
 */
const deliverWebhook = async (eventDoc, destinationUrl, endpointSecret, attemptNumber = 1) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // We only forward safe headers. Do not blindly copy all incoming headers.
  const safeHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'HookSight-Delivery-Agent/1.0',
    'X-HookSight-Event-Id': eventDoc.eventId,
    'X-HookSight-Event-Type': eventDoc.eventType,
    'Idempotency-Key': `${eventDoc.eventId}-attempt-${attemptNumber}`
  };

  // Forward x-github-event if it was present in the original headers
  if (eventDoc.headers && (eventDoc.headers.get ? eventDoc.headers.get('x-github-event') : eventDoc.headers['x-github-event'])) {
    safeHeaders['X-GitHub-Event'] = eventDoc.headers.get ? eventDoc.headers.get('x-github-event') : eventDoc.headers['x-github-event'];
  }

  const payloadString = typeof eventDoc.payload === 'object' 
    ? JSON.stringify(eventDoc.payload) 
    : String(eventDoc.payload);

  if (endpointSecret) {
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', endpointSecret)
                            .update(payloadString)
                            .digest('hex');
    safeHeaders['X-HookSight-Signature'] = `sha256=${signature}`;
  }

  try {
    const response = await fetch(destinationUrl, {
      method: 'POST',
      headers: safeHeaders,
      body: payloadString,
      signal: controller.signal
    });

    const responseHeaders = {};
    if (response.headers) {
      for (const [key, val] of response.headers.entries()) {
        responseHeaders[key] = val;
      }
    }

    if (!response.ok) {
      // For Commit 30, we throw on all non-2xx to let BullMQ retry.
      // This preserves existing compatibility.
      const errorText = await response.text().catch(() => '');
      const err = new Error(`Delivery failed with status: ${response.status} ${response.statusText}`);
      err.responseStatusCode = response.status;
      err.responseBody = errorText;
      err.requestHeaders = safeHeaders;
      err.responseHeaders = responseHeaders;
      throw err;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      requestHeaders: safeHeaders,
      responseHeaders: responseHeaders
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error(`Delivery timed out after ${TIMEOUT_MS}ms`);
      err.requestHeaders = safeHeaders;
      throw err;
    }
    // Re-throw network errors or non-2xx errors so the worker catches them
    error.requestHeaders = safeHeaders;
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

module.exports = {
  deliverWebhook
};
