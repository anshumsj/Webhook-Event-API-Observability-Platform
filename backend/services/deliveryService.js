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
 * @returns {Object} { status, statusText } on success (2xx).
 * @throws {Error} On network failure, timeout, or non-2xx status code.
 */
const deliverWebhook = async (eventDoc, destinationUrl) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // We only forward safe headers. Do not blindly copy all incoming headers.
    const safeHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'HookSight-Delivery-Agent/1.0',
      'X-HookSight-Event-Id': eventDoc.eventId,
      'X-HookSight-Event-Type': eventDoc.eventType
    };

    // Forward x-github-event if it was present in the original headers
    if (eventDoc.headers && eventDoc.headers.get('x-github-event')) {
      safeHeaders['X-GitHub-Event'] = eventDoc.headers.get('x-github-event');
    }

    const payloadString = typeof eventDoc.payload === 'object' 
      ? JSON.stringify(eventDoc.payload) 
      : String(eventDoc.payload);

    const response = await fetch(destinationUrl, {
      method: 'POST',
      headers: safeHeaders,
      body: payloadString,
      signal: controller.signal
    });

    if (!response.ok) {
      // For Commit 30, we throw on all non-2xx to let BullMQ retry.
      // This preserves existing compatibility.
      const errorText = await response.text().catch(() => '');
      const err = new Error(`Delivery failed with status: ${response.status} ${response.statusText}`);
      err.responseStatusCode = response.status;
      err.responseBody = errorText;
      throw err;
    }

    return {
      status: response.status,
      statusText: response.statusText
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Delivery timed out after ${TIMEOUT_MS}ms`);
    }
    // Re-throw network errors or non-2xx errors so the worker catches them
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

module.exports = {
  deliverWebhook
};
