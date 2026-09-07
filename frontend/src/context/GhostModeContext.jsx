import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import * as redactors from '../utils/privacyRedactor';

const GhostModeContext = createContext();

const STORAGE_KEY = 'hooksight_ghost_mode';

/**
 * GhostModeProvider — Global presentation privacy state.
 *
 * When Ghost Mode is active, all redaction helpers return masked values.
 * When Ghost Mode is inactive, all redaction helpers act as identity/passthrough functions.
 *
 * This eliminates repetitive `isGhostMode ? redact(x) : x` ternaries throughout JSX.
 */
export function GhostModeProvider({ children }) {
  const [isGhostMode, setIsGhostMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleGhostMode = useCallback(() => {
    setIsGhostMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // localStorage might be unavailable
      }
      return next;
    });
  }, []);

  const setGhostMode = useCallback((value) => {
    const boolVal = Boolean(value);
    setIsGhostMode(boolVal);
    try {
      localStorage.setItem(STORAGE_KEY, String(boolVal));
    } catch {
      // localStorage might be unavailable
    }
  }, []);

  // Build redaction helpers: passthrough when OFF, actual redactors when ON
  const helpers = useMemo(() => {
    if (!isGhostMode) {
      // Passthrough identity functions
      return {
        redactWorkspaceName: (v) => v,
        redactProjectName: (v) => v,
        redactEventId: (v) => v,
        redactRequestId: (v) => v,
        redactEndpointId: (v) => v,
        redactId: (v) => v,
        redactUrl: (v) => v,
        redactWebhookIngestUrl: (v) => v,
        redactEmail: (v) => v,
        redactUserName: (v) => v,
        redactSecret: (v) => v,
        redactCurlSnippet: (v) => v,
        redactDestinationUrl: (v) => v,
        redactPayload: (v) => v,
        redactHeaders: (v) => v,
      };
    }

    // Active redaction
    return {
      redactWorkspaceName: redactors.redactWorkspaceName,
      redactProjectName: redactors.redactProjectName,
      redactEventId: redactors.redactEventId,
      redactRequestId: redactors.redactRequestId,
      redactEndpointId: redactors.redactEndpointId,
      redactId: redactors.redactId,
      redactUrl: redactors.redactUrl,
      redactWebhookIngestUrl: redactors.redactWebhookIngestUrl,
      redactEmail: redactors.redactEmail,
      redactUserName: redactors.redactUserName,
      redactSecret: redactors.redactSecret,
      redactCurlSnippet: redactors.redactCurlSnippet,
      redactDestinationUrl: redactors.redactDestinationUrl,
      redactPayload: redactors.redactPayload,
      redactHeaders: redactors.redactHeaders,
    };
  }, [isGhostMode]);

  const value = useMemo(
    () => ({
      isGhostMode,
      toggleGhostMode,
      setGhostMode,
      ...helpers,
    }),
    [isGhostMode, toggleGhostMode, setGhostMode, helpers]
  );

  return (
    <GhostModeContext.Provider value={value}>
      {children}
    </GhostModeContext.Provider>
  );
}

/**
 * Hook to access Ghost Mode state and redaction helpers.
 *
 * Usage:
 *   const { isGhostMode, toggleGhostMode, redactEventId, ... } = useGhostMode();
 *   <span>{redactEventId(event.eventId)}</span>
 */
export function useGhostMode() {
  const context = useContext(GhostModeContext);
  if (!context) {
    throw new Error('useGhostMode must be used within a GhostModeProvider');
  }
  return context;
}
