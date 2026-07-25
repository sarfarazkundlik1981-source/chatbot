# Production Checklist

## Deployment

- Apply Prisma migrations before promoting a new backend release.
- Confirm the database supports the `app_uuid_v7()` migration function and `pgcrypto`.
- Set `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, `DASHBOARD_URL`, and `OPENROUTER_BASE_URL` in production.
- Configure `RESEND_API_KEY` if platform emails are enabled.
- Build and deploy API, dashboard, and PostgreSQL as separate services through Coolify.

## Monitoring

- Watch API logs for:
  - `PLUGIN_VERIFY_FAILED`
  - `INVALID_REFRESH_TOKEN`
  - `OPENROUTER_REQUEST_FAILED`
  - scheduler failure events
- Review health page status for:
  - database
  - OpenRouter
  - Resend
  - scheduled jobs
- Track plugin compatibility summary regularly to identify outdated client installations.

## Beta Validation

- Validate one full client onboarding flow:
  - platform owner creates client
  - plugin secret is configured
  - WordPress site verifies successfully
  - widget config loads
  - chat session resumes
  - lead email notification works if enabled
- Validate one dashboard configuration cycle:
  - edit knowledge
  - trigger unanswered question
  - convert unanswered question into FAQ
  - confirm future replies use the new knowledge entry
- Validate one rollback cycle:
  - change branding or widget settings
  - create a config snapshot
  - rollback to a previous version
  - confirm plugin config version changes

## Release Hygiene

- Keep plugin release ZIP metadata in the platform admin area current.
- Review compatibility rules before raising minimum plugin, PHP, or WordPress versions.
- Run `npm run build` and `npm run test` before release.
- If PHP is available in CI or deployment, lint `plu/wordpress-chatbot-plugin/wordpress-chatbot-plugin.php`.
