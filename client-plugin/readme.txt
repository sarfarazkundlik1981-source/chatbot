=== WordPress Chatbot Connector ===
Contributors: platform-team
Tags: chatbot, ai, elementor, lead-generation, support
Requires at least: 6.5
Tested up to: 6.6
Requires PHP: 8.1
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Thin connector plugin for the centralized WordPress AI chatbot platform.

== Description ==

The WordPress Chatbot Connector links a WordPress or Elementor site to the centralized chatbot SaaS backend.

Features:

* floating, embed, button, and popup display modes
* shortcode support through `[wcp_chatbot]` and `[wcp_chatbot_trigger]`
* Elementor widget registration for embed and button-trigger flows
* server-side plugin verification with browser-safe bootstrap tokens
* heartbeat, config caching, and conversation resume
* backend-driven callback, appointment, service-area, and quote tools
* optional server-side WordPress lead notifications through `wp_mail()`

This plugin stays intentionally thin:

* no OpenRouter calls
* no direct database access
* no prompt building
* no business logic duplication in PHP

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/wordpress-chatbot-plugin/`.
2. Activate the plugin through the WordPress plugins screen.
3. Open `Settings > Chatbot Connector`.
4. Enter your backend URL, client ID, and client secret.
5. Choose the display mode and optional visibility rules.

== Frequently Asked Questions ==

= Does the plugin work without Elementor? =

Yes. Elementor support is optional. The plugin also supports floating, popup, embed, and shortcode-driven rendering.

= Does the plugin send email itself? =

Only optional server-side lead notification emails through `wp_mail()`. AI, licensing, and chat logic stay on the centralized backend.

= Does the plugin store conversations locally? =

No. It stores only lightweight browser cache values and connector settings. Conversation history remains centralized in the backend.

== Changelog ==

= 0.1.0 =

* Initial standalone connector extraction from the platform workspace.
