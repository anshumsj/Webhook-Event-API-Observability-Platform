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
const axios = require('axios');
const http = require('http');
const https = require('https');
const { createSafeAgent } = require('../utils/ssrfValidator');

const safeHttpAgent = createSafeAgent(http.Agent);
const safeHttpsAgent = createSafeAgent(https.Agent);

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
const deliverWebhook = async (eventDoc, destinationUrl, endpointSecret, attemptNumber = 1, isManualReplay = false) => {
  // We only forward safe headers. Do not blindly copy all incoming headers.
  const safeHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'HookSight-Delivery-Agent/1.0',
    'X-HookSight-Event-Id': eventDoc.eventId,
    'X-HookSight-Event-Type': eventDoc.eventType,
    'Idempotency-Key': isManualReplay ? `${eventDoc.eventId}-replay-${attemptNumber}` : eventDoc.eventId
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
    const response = await axios({
      method: 'POST',
      url: destinationUrl,
      headers: safeHeaders,
      data: payloadString,
      timeout: TIMEOUT_MS,
      maxRedirects: 0, // Disallow redirects
      httpAgent: safeHttpAgent,
      httpsAgent: safeHttpsAgent,
      maxContentLength: 1024 * 1024, // 1 MB limit for response body
      responseType: 'text', // Read as text
      validateStatus: () => true // Do not throw on non-2xx status codes (we handle them below)
    });

    const responseHeaders = response.headers || {};

    if (response.status < 200 || response.status >= 300) {
      const errorText = response.data ? String(response.data) : '';
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
    // If it's a non-2xx error we manually threw above, just rethrow
    if (error.responseStatusCode) {
      throw error;
    }

    let errMessage = error.message;
    if (error.code === 'ECONNABORTED' || errMessage.includes('timeout')) {
      errMessage = `Delivery timed out after ${TIMEOUT_MS}ms`;
    } else if (errMessage.includes('maxContentLength size')) {
      errMessage = 'Response exceeded 1MB limit';
    }

    const err = new Error(errMessage);
    err.requestHeaders = safeHeaders;
    
    // Pass along response headers/body if axios captured them (e.g., redirect error)
    if (error.response) {
      err.responseStatusCode = error.response.status;
      err.responseBody = error.response.data ? String(error.response.data) : '';
      err.responseHeaders = error.response.headers || {};
    }
    
    throw err;
  }
};

module.exports = {
  deliverWebhook
};
