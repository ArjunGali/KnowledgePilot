/**
 * hooks/useSettings.js
 * --------------------
 * Session-scoped user settings for the demo:
 *   - showPlanner : show the collapsible planner details block
 *   - showTiming  : show execution timing on answers
 *   - memory      : send conversation history to the backend
 *   - demoMode    : play the animated agent-step timeline
 *
 * Persisted to sessionStorage so a page reload keeps them, but a browser
 * restart resets them (matches the "session only" requirement).
 */

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "kp_settings";

const DEFAULTS = {
  showPlanner: true,
  showTiming: true,
  memory: true,
  demoMode: false,
};

function loadSettings() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);

  // Persist on every change (cheap — the object is tiny).
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage disabled — settings simply won't persist */
    }
  }, [settings]);

  /** Flip a boolean setting by key. */
  const toggle = useCallback((key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return { settings, toggle };
}
