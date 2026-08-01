# Restart-required settings feedback checklist

SUMMARY: Always treat restart-required settings as persistent server state, show a dismissible non-blocking notice after save and on reload, and clear it only when the server reports no pending restart.
READ WHEN: before any WebUI setting can be saved now but only applied after a service restart

---

The settings response is the source of truth for whether desired configuration differs from active runtime configuration. A restart notice should:

- appear after a restart-bound field actually changes and the successful response reports `restartRequired: true`;
- reappear when the settings page loads while the server still reports a pending restart;
- not re-open merely because an immediately effective field was saved while another restart remains pending;
- disappear when a later response reports `restartRequired: false`, such as when the user restores the active value;
- remain visible until explicitly dismissed instead of timing out, because restart status is durable operational information;
- preserve inline save feedback so dismissing the notice does not erase the result of the save action.

Use a polite `role="status"`, concise “restart to apply” copy, a named close button with at least a 44px target, safe-area-aware top/right spacing, and a mobile width that cannot overflow the viewport.
