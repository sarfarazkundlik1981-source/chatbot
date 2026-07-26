# WordPress Chatbot Connector

This folder is prepared as the standalone WordPress plugin project for the centralized chatbot SaaS.

## Layout

- `wordpress-chatbot.php`: main plugin bootstrap
- `public/widget.js`: browser widget runtime
- `readme.txt`: WordPress-style distribution metadata
- `package.json`: local packaging helper for ZIP creation
- `admin/`, `assets/`, `includes/`, `languages/`: reserved plugin repo structure for future expansion

## Current capabilities

- asks the customer only for platform URL and activation code
- stores installation-specific connector credentials internally after successful activation
- supports `[wcp_chatbot]` and `[wcp_chatbot_trigger]` shortcodes
- registers an Elementor widget for embed, button-trigger, and popup-trigger use cases
- performs plugin verification server-side in PHP and passes only short-lived bootstrap data to the browser
- shows a read-only platform-controlled enabled-feature summary after connection
- scopes browser-side cached config and resume state per plugin installation and site hostname
- silently refreshes browser widget tokens through WordPress PHP when short-lived tokens expire
- sends heartbeat metadata including WordPress, PHP, and Elementor versions
- schedules a server-side heartbeat through WordPress cron so installation visibility does not depend only on visitor traffic
- caches widget config locally in the browser
- resumes sessions with the backend
- renders backend-driven callback request, appointment request, service-area check, and instant quote tools when enabled

## Operational notes

- client accounts, activation codes, branding, content, AI instructions, API keys, pricing, business hours, and feature setup are managed in the platform admin
- backend AI, licensing, lead handling, and conversation logic remain centralized in the platform
- the plugin stays intentionally thin and does not make direct OpenRouter calls
- feature availability is driven by backend public widget config and respects capability, entitlement, and feature-flag checks
- the browser never receives the installation secret or any client-level connector secret

## Release usage

This plugin should be versioned and released independently from the platform backend.

- plugin repository: `wordpress-chatbot-plugin`
- platform repository: `chatbot-platform`

The plugin should only communicate with the platform through the public HTTPS API.
