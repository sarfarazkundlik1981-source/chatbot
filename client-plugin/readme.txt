=== WordPress Chatbot Connector ===
Contributors: platform-team
Tags: chatbot, ai, elementor, lead-generation, support
Requires at least: 6.5
Tested up to: 6.6
Requires PHP: 8.1
Stable tag: 0.1.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Thin connector plugin for the centralized WordPress AI chatbot platform.

== Description ==

The WordPress Chatbot Connector links a WordPress or Elementor site to the centralized chatbot SaaS backend.

Features:

* activation-code-only WordPress setup
* shortcode support through `[wcp_chatbot]` and `[wcp_chatbot_trigger]`
* Elementor widget registration for embed and button-trigger flows
* installation-specific server-side plugin verification with browser-safe bootstrap tokens
* read-only platform-controlled enabled-feature summary after connection
* heartbeat, config caching, and conversation resume
* backend-driven callback, appointment, service-area, and quote tools

This plugin stays intentionally thin:

* no OpenRouter calls
* no direct database access
* no prompt building
* no business logic duplication in PHP
* no business setup in WordPress

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/wordpress-chatbot-plugin/`.
2. Activate the plugin through the WordPress plugins screen.
3. Open `Settings > Chatbot Connector`.
4. Enter your platform URL and activation code.
5. Click `Connect Account`.

== Frequently Asked Questions ==

= Does the plugin work without Elementor? =

Yes. Elementor support is optional. The plugin also supports floating, popup, embed, and shortcode-driven rendering.

= Does the plugin send email itself? =

No. Lead handling, notifications, AI, licensing, and chat logic stay on the centralized backend.

= Does the plugin store conversations locally? =

No. It stores only lightweight browser cache values and connector settings. Conversation history remains centralized in the backend.

== Changelog ==

= 0.1.4 =

* Simplified WordPress setup to platform URL and activation code only.
* Replaced customer-facing client ID and client secret entry with a single activation code.
* Store installation-specific credentials internally after activation instead of client-level connector credentials.
* Moved business setup, branding, content, instructions, pricing, and feature ownership fully to platform admin.
* Removed WordPress-side lead email notification setup.

= 0.1.0 =

* Initial standalone connector extraction from the platform workspace.
