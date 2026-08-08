# Monitoring activation

1. Store the backend `METRICS_TOKEN` in the monitoring platform's secret store and mount it at `/run/secrets/shotlink_metrics_token`; never commit the value.
2. Replace the internal target in `prometheus.yml` with the private API hostname. Keep `/metrics` off the public internet.
3. Validate rules with `promtool check rules ops/monitoring/shotlink.rules.yml` and validate the Prometheus configuration with `promtool check config ops/monitoring/prometheus.yml`.
4. Import `grafana-dashboard.json`, configure an Alertmanager receiver, and replace the `.invalid` example URL using a secret-backed configuration.
5. Send a test alert, verify acknowledgement and escalation ownership, then record the result in the private operations log.

Response order: protect redirect correctness first, then investigate error rate and latency, then drain the `redirect_event` and `url_health` queues. Any redirect-event dead letter is critical because it can delay analytics and usage accounting. Correlate application logs with `X-Request-Id`. Cache failures are degraded but correctness-safe; MongoDB failures make readiness fail and require immediate escalation.
