# WordPress Chatbot Connector

Current capabilities:

- stores `backend_url`, `client_id`, and `client_secret`
- supports `floating`, `embed`, `button`, and `popup` display modes
- supports `[wcp_chatbot]` and `[wcp_chatbot_trigger]` shortcodes
- registers an Elementor widget for embed and button-trigger use cases
- sends plugin verification and heartbeat metadata including WordPress, PHP, and Elementor versions
- caches widget config locally in the browser
- resumes sessions with the backend
- supports optional WordPress-side lead email notifications through `wp_mail()`
- renders backend-driven callback request, appointment request, service-area check, and instant quote tools when enabled
- enforces WordPress-side display rules:
  - desktop only
  - mobile only
  - hide for logged-in users
  - hide on checkout
  - include/exclude path matching

Operational notes:

- `wp_mail()` notifications are optional and use the site's existing WordPress mail setup
- backend AI, licensing, and conversation logic remain centralized in the platform
- the plugin stays intentionally thin and does not make direct OpenRouter calls
- feature availability is driven by backend public widget config and respects capability, entitlement, and feature-flag checks
