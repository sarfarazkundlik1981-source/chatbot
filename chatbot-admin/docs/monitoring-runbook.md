# Monitoring Runbook

## Scope

Track both platform health and application usage.

## Infrastructure Metrics

- CPU usage
- RAM usage
- disk usage
- API container restarts
- dashboard container restarts
- PostgreSQL container restarts

Suggested alert levels:

- CPU sustained above 80% for 10 minutes
- RAM sustained above 85% for 10 minutes
- disk above 80%
- any repeated container restart loop

## Application Metrics

- request volume
- p95 response time
- 4xx rate
- 5xx rate
- OpenRouter failure rate
- plugin verification failure rate
- scheduler failure count
- lead submission success rate
- unanswered question volume
- token usage and estimated cost by day

Suggested dashboards:

- API traffic and latency
- plugin verification / heartbeat health
- AI request success vs failure
- scheduler job success/failure
- cost and token usage
- lead conversion funnel

## Log Review

Review regularly:

- `OPENROUTER_REQUEST_FAILED`
- `PLUGIN_VERIFY_FAILED`
- `INVALID_REFRESH_TOKEN`
- `LICENSE_INACTIVE`
- `UNSUPPORTED_ENVIRONMENT`
- `scheduled_job.failed`

## Health Page Expectations

- `database` should be `healthy`
- `openrouter` should be `healthy` or at worst temporary `warning`
- `scheduled_jobs` should not show recurring failures
- plugin compatibility summary should not accumulate `update_required` sites without action
