# Chatbot Admin

This folder is the deployable admin/platform workspace for the centralized multi-tenant AI chatbot platform for WordPress and Elementor sites.

## Deployable Workspace

- `apps/api`: Express + TypeScript backend with versioned REST APIs, Prisma/PostgreSQL models, audit logging, analytics, config versioning, rollback, health checks, scheduled jobs, plugin auth, and OpenRouter-based chat flows.
- `apps/dashboard`: Next.js dashboard shell with operational sections for settings, knowledge, feature controls, platform admin, plugin installations, unanswered questions, versions, health, and playground flows.
- `packages/contracts`: shared response-envelope and DTO-facing package.

This is the folder intended for deployment through Coolify.

## Implemented Platform Areas

- Multi-tenant client settings, branding, widget settings, AI settings, internal settings, feature flags, entitlements, and public widget config.
- Plugin verify, heartbeat, widget config, session create/resume, chat, streaming, lead submit, service-area check, and quote-calculation endpoints.
- Config version snapshots and rollback support across core settings and the newly added visitor feature modules.
- Feature modules for:
  - business hours
  - out-of-hours behavior
  - callback requests
  - appointment requests
  - service area rules
  - price list manager
  - instant quote calculator
  - lead qualification configuration
  - missed customer alerts
  - emergency detection
  - FAQ suggestion tracking and conversion
- Dashboard management for the feature bundle through the existing single-page admin shell.
- WordPress widget support for chat, runtime CTAs, callback requests, appointment requests, service-area checks, quote flows, shortcode/embed/button/popup modes, and Elementor integration.

## Validation

- `npm run build`
- `npm run test`
- `npm run test:e2e`
  - e2e remains environment-dependent and requires a running PostgreSQL-backed API target.

## Top-Level Structure

The scanner workspace is now split into two top-level folders:

- `chatbot-admin`
  - API
  - dashboard
  - Prisma schema and migrations
  - shared packages
  - deployment configuration
- `client-plugin/wordpress-chatbot-plugin`
  - WordPress bootstrap
  - widget runtime
  - plugin metadata
  - WordPress distribution files

The plugin should be versioned and released independently from the backend platform.

## Operational Notes

- Brand assets are URL-based; the platform does not host uploads.
- The plugin remains thin and does not call OpenRouter directly.
- `wp_mail()` remains optional and only supports WordPress-side notifications.
- The health test degrades gracefully when PostgreSQL is unavailable, which is expected for local no-database smoke runs.
