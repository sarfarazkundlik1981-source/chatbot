# WordPress Chatbot Connector

This folder is prepared as the standalone WordPress plugin project for the centralized chatbot SaaS.

## Layout

- `wordpress-chatbot.php`: main plugin bootstrap
- `public/widget.js`: browser widget runtime
- `readme.txt`: WordPress-style distribution metadata
- `package.json`: local packaging helper for ZIP creation
- `admin/`, `assets/`, `includes/`, `languages/`: reserved plugin repo structure for future expansion

## Current capabilities

- stores `backend_url`, `client_id`, and `client_secret` in WordPress server-side settings
- supports `floating`, `embed`, `button`, and `popup` display modes
- supports `[wcp_chatbot]` and `[wcp_chatbot_trigger]` shortcodes
- registers an Elementor widget for embed and button-trigger use cases
- performs plugin verification server-side in PHP and passes only short-lived bootstrap data to the browser
- sends heartbeat metadata including WordPress, PHP, and Elementor versions
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

## Operational notes

- `wp_mail()` notifications are optional, run server-side, and use the site's existing WordPress mail setup
- backend AI, licensing, and conversation logic remain centralized in the platform
- the plugin stays intentionally thin and does not make direct OpenRouter calls
- feature availability is driven by backend public widget config and respects capability, entitlement, and feature-flag checks
- the browser never receives the long-lived connector secret

## Release usage

This plugin should be versioned and released independently from the platform backend.

- plugin repository: `wordpress-chatbot-plugin`
- platform repository: `chatbot-platform`

The plugin should only communicate with the platform through the public HTTPS API.
