import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  redactWorkspaceName,
  redactProjectName,
  redactEventId,
  redactRequestId,
  redactEndpointId,
  redactId,
  redactUrl,
  redactWebhookIngestUrl,
  redactEmail,
  redactUserName,
  redactSecret,
  redactCurlSnippet,
  redactDestinationUrl,
  redactPayload,
  redactHeaders,
} from './privacyRedactor.js';

describe('privacyRedactor unit tests', () => {
  describe('redactWorkspaceName', () => {
    it('redacts normal workspace name with masked string', () => {
      assert.equal(redactWorkspaceName('Production Workspace'), 'Workspace ••••');
      assert.equal(redactWorkspaceName('Acme Corp Internal'), 'Workspace ••••');
    });

    it('handles empty or missing name gracefully', () => {
      assert.equal(redactWorkspaceName(''), 'Workspace');
      assert.equal(redactWorkspaceName(null), 'Workspace');
      assert.equal(redactWorkspaceName(undefined), 'Workspace');
    });
  });

  describe('redactProjectName', () => {
    it('redacts project name to Demo Project', () => {
      assert.equal(redactProjectName('Billing Service'), 'Demo Project');
      assert.equal(redactProjectName('Auth API'), 'Demo Project');
    });

    it('handles empty or missing project name', () => {
      assert.equal(redactProjectName(''), 'Project');
      assert.equal(redactProjectName(null), 'Project');
    });
  });

  describe('redactEventId, redactRequestId, redactEndpointId, redactId', () => {
    it('redacts event ID to evt_••••••••', () => {
      assert.equal(redactEventId('beec3367cabf88ee8bc7c073'), 'evt_••••••••');
      assert.equal(redactEventId(''), 'evt_••••••••');
      assert.equal(redactEventId(null), 'evt_••••••••');
    });

    it('redacts request ID to req_••••••••', () => {
      assert.equal(redactRequestId('req_987654321'), 'req_••••••••');
      assert.equal(redactRequestId(''), '');
      assert.equal(redactRequestId(null), '');
    });

    it('redacts endpoint ID to ep_••••••••', () => {
      assert.equal(redactEndpointId('ep_60d5ec49f1b2'), 'ep_••••••••');
      assert.equal(redactEndpointId(''), 'ep_••••••••');
    });

    it('redacts generic ID to ••••••••', () => {
      assert.equal(redactId('60d5ec49f1b2c8b1f8e4e1a1'), '••••••••');
      assert.equal(redactId(''), '••••••••');
    });
  });

  describe('redactUrl and redactDestinationUrl', () => {
    it('preserves protocol and domain while masking path tokens', () => {
      assert.equal(redactUrl('https://webhook.site/84c0a6a7-3333-4444'), 'https://webhook.site/••••••••');
      assert.equal(redactDestinationUrl('http://localhost:3000/webhook'), 'http://localhost:3000/••••••••');
    });

    it('handles invalid or empty URLs', () => {
      assert.equal(redactUrl(''), '');
      assert.equal(redactUrl('not-a-url'), '••••••••');
    });
  });

  describe('redactWebhookIngestUrl', () => {
    it('replaces webhook endpoint token with masked string', () => {
      const url = 'https://webhook-event.onrender.com/api/webhooks/a4715a2a1f232f623e7be3d2';
      assert.equal(redactWebhookIngestUrl(url), 'https://webhook-event.onrender.com/api/webhooks/••••••••');
    });

    it('falls back to redactUrl if path does not contain /api/webhooks/', () => {
      const url = 'https://example.com/custom/target';
      assert.equal(redactWebhookIngestUrl(url), 'https://example.com/••••••••');
    });

    it('handles empty input', () => {
      assert.equal(redactWebhookIngestUrl(''), '');
    });
  });

  describe('redactEmail and redactUserName', () => {
    it('redacts email address', () => {
      assert.equal(redactEmail('john.doe@company.org'), '•••••@••••.com');
      assert.equal(redactEmail(''), '');
    });

    it('redacts user display name', () => {
      assert.equal(redactUserName('John Doe'), 'Developer');
      assert.equal(redactUserName(''), 'Developer');
      assert.equal(redactUserName(null), 'Developer');
    });
  });

  describe('redactSecret', () => {
    it('returns a 16-character mask', () => {
      assert.equal(redactSecret('whsec_1234567890abcdef'), '••••••••••••••••');
    });
  });

  describe('redactCurlSnippet', () => {
    it('masks endpoint IDs in curl commands', () => {
      const snippet = 'curl -X POST https://api.hooksight.com/api/webhooks/a4715a2a1f232f623e7be3d2 -H "Content-Type: application/json"';
      const redacted = redactCurlSnippet(snippet);
      assert.ok(!redacted.includes('a4715a2a1f232f623e7be3d2'));
      assert.ok(redacted.includes('/api/webhooks/••••••••'));
    });

    it('handles empty snippet', () => {
      assert.equal(redactCurlSnippet(''), '');
    });
  });

  describe('redactPayload', () => {
    it('redacts sensitive fields in payload object and preserves non-sensitive fields', () => {
      const payload = {
        event: 'order.completed',
        status: 'paid',
        amount: 49.99,
        customer: 'cust_12345',
        email: 'alice@wonderland.com',
        apiKey: 'secret_key_123',
        metadata: {
          orderId: 'ord_999',
          card_number: '4111-2222-3333-4444',
          subtotal: 45.0,
        },
      };

      const redacted = redactPayload(payload);

      assert.equal(redacted.event, 'order.completed');
      assert.equal(redacted.status, 'paid');
      assert.equal(redacted.amount, 49.99);
      assert.equal(redacted.customer, '••••••••');
      assert.equal(redacted.email, '••••••••');
      assert.equal(redacted.apiKey, '••••••••');
      assert.equal(redacted.metadata.orderId, 'ord_999');
      assert.equal(redacted.metadata.card_number, '••••••••');
      assert.equal(redacted.metadata.subtotal, 45.0);
    });

    it('redacts sensitive fields in array items', () => {
      const payload = [
        { id: 1, token: 'xyz123' },
        { id: 2, token: 'abc456' },
      ];
      const redacted = redactPayload(payload);
      assert.equal(redacted[0].id, 1);
      assert.equal(redacted[0].token, '••••••••');
      assert.equal(redacted[1].id, 2);
      assert.equal(redacted[1].token, '••••••••');
    });

    it('parses and redacts JSON strings', () => {
      const jsonString = JSON.stringify({
        action: 'login',
        password: 'super-secret-password',
      });
      const redactedString = redactPayload(jsonString);
      const parsed = JSON.parse(redactedString);
      assert.equal(parsed.action, 'login');
      assert.equal(parsed.password, '••••••••');
    });

    it('returns null, undefined, or primitives as-is', () => {
      assert.equal(redactPayload(null), null);
      assert.equal(redactPayload(undefined), undefined);
      assert.equal(redactPayload('plain text message'), 'plain text message');
      assert.equal(redactPayload(123), 123);
    });
  });

  describe('redactHeaders', () => {
    it('masks sensitive authorization and cookie headers', () => {
      const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer super-secret-jwt-token',
        'cookie': 'session_id=abc12345',
        'x-api-key': 'live_key_999',
        'user-agent': 'HookSight-Worker/1.0',
      };

      const redacted = redactHeaders(headers);

      assert.equal(redacted['content-type'], 'application/json');
      assert.equal(redacted['user-agent'], 'HookSight-Worker/1.0');
      assert.equal(redacted['authorization'], '••••••••');
      assert.equal(redacted['cookie'], '••••••••');
      assert.equal(redacted['x-api-key'], '••••••••');
    });

    it('handles non-object headers gracefully', () => {
      assert.equal(redactHeaders(null), null);
      assert.equal(redactHeaders(undefined), undefined);
      assert.equal(redactHeaders('header string'), 'header string');
    });
  });
});
