# Disaster Recovery Runbook

This runbook covers Shotlink's MongoDB Atlas data, non-authoritative Redis cache, and Render backend deployment. It must be reviewed after any storage, hosting, authentication, or billing architecture change.

## Ownership and objectives

- Incident commander: primary production operator
- Database recovery operator: MongoDB Atlas project owner or Backup Recovery Operator
- Deployment recovery operator: Render workspace owner
- Communications owner: customer-support operator
- Target RPO: 15 minutes for accounts, workspaces, billing state, and links
- Target RTO: 2 hours for the API and redirect service
- Analytics recovery target: the same database recovery point, with delayed analytics accepted before delaying redirect recovery

The targets are not achieved merely by documenting them. Record the real snapshot interval and the latest successful restore-drill duration after every drill. If the current Atlas tier cannot provide continuous backup, the actual RPO is the snapshot interval and must be communicated as such.

## Required production configuration

1. Enable MongoDB Atlas Cloud Backup for the production cluster.
2. Enable Continuous Cloud Backup with a point-in-time restore window that supports the RPO.
3. Retain daily snapshots for at least 7 days, weekly snapshots for 4 weeks, and monthly snapshots for 12 months.
4. Store a snapshot copy in a second region when the selected Atlas tier supports it.
5. Restrict backup-policy changes and restore permissions to dedicated operators using least privilege.
6. Enable Atlas alerts for backup failure, restore failure, cluster unavailability, storage growth, and replication lag.

Redis contains no canonical customer data: every cached route, domain,
entitlement, and usage snapshot is rebuilt from MongoDB. Back up MongoDB and the
durable redirect outbox and URL-health job queue; do not treat a Redis snapshot
as a recovery source. If
Redis is lost, provision a replacement, update `REDIS_URL`, redeploy, and allow
the cache to warm from MongoDB while monitoring database load and redirect
latency.
7. Keep `maxShutdownDelaySeconds` in `render.yaml` aligned with the application's bounded graceful shutdown.
8. Keep a secure, access-controlled inventory of production variable names and recovery contacts. Never store secret values in this repository or in incident tickets.
9. The Free pre-user profile intentionally omits continuous URL-health work.
   Before onboarding customers who depend on automatic fallback routing, deploy
   the URL-health Render worker separately with no public domain and verify it
   uses the same `MONGO_URI` and `REDIS_URL` as the API service.

Atlas backup guidance: <https://www.mongodb.com/docs/atlas/architecture/current/backups/>

## Incident classification

- Application regression: data is intact; rollback the Render deployment.
- Credential compromise: rotate affected credentials, revoke sessions where applicable, then redeploy.
- Accidental write or logical corruption: stop further writes and perform a point-in-time restore.
- Cluster loss or regional outage: restore into a new Atlas cluster/region and cut over `MONGO_URI`.
- Provider outage without data loss: preserve evidence, monitor provider status, and avoid destructive recovery actions.

## Application rollback

1. Declare the incident and record the first known bad deployment and UTC timestamp.
2. In Render, open the API service's deployment history.
3. Roll back to the most recent verified deployment within the plan's retention window.
4. Confirm `/health` returns HTTP 200.
5. Verify sign-in, a read-only billing summary, link listing, and one controlled redirect.
6. Watch correlated `request_error` and `http_request` logs for at least 15 minutes.
7. If the rollback does not recover service, proceed to database diagnosis without repeatedly changing production.

Render rollback guidance: <https://render.com/docs/rollbacks>

## Database recovery

1. Record the incident start, suspected corruption time, current deployment, and last verified healthy time in UTC.
2. Stop or block application writes. Do not allow clients to write to the restore target during restoration.
3. Preserve the affected cluster and logs for investigation; do not overwrite or delete it.
4. Select the latest safe point before the incident and restore into a new Atlas cluster.
5. Use a least-privilege application database user on the restored cluster.
6. Validate collection counts and indexes for users, workspaces, URLs, sessions,
   usage counters, click events, redirect outbox jobs, URL-health jobs, and billing records.
7. Update Render's `MONGO_URI` secret to the restored cluster and redeploy the last verified application revision.
8. Confirm `/health` is HTTP 200 before restoring public traffic.
9. Run the verification checklist below. If it fails, switch `MONGO_URI` back to the preserved source when safe or restore from an earlier point.
10. Keep the old cluster read-only until the incident review and reconciliation are complete.

Atlas restore guidance: <https://www.mongodb.com/docs/atlas/backup/cloud-backup/restore-overview/>

## Recovery verification

- `/health` reports MongoDB and Redis as connected (a `degraded` Redis state is
  safe for correctness but not an acceptable completed recovery state).
- A designated test account can sign in and sign out.
- Workspace membership and authorization roles match the pre-incident record.
- Link counts, destinations, custom domains, expiry state, and redirect behavior are plausible.
- Billing plans and usage counters match provider records; do not trigger a live payment during verification.
- Recent sessions can be revoked if credential integrity is uncertain.
- Error rate and latency return to the normal baseline.
- In the paid profile, the URL-health worker is running, pending queue depth is
  draining, and no new dead letters appear. In the Free validation profile,
  health jobs may remain pending until the worker is added.
- No secret, token, raw password, or payment data appears in logs or incident notes.

## Backup and restore drills

The repository provides two guarded operator scripts:

```powershell
$env:MONGO_URI = "mongodb+srv://..."
.\ops\backup\backup.ps1 -OutputDirectory .\private-backups

$env:SHOTLINK_RESTORE_CONFIRM = "ISOLATED_NON_PRODUCTION"
.\ops\backup\restore-drill.ps1 -BackupArchive .\private-backups\shotlink-....archive.gz -TargetMongoUri "mongodb+srv://isolated-drill-host/..."
```

The backup script creates a compressed archive plus a SHA-256 manifest. The
restore script verifies that checksum, rejects a target equal to the source, and
requires the explicit isolated-environment confirmation before using `--drop`.
Keep archives, manifests, URIs, and drill evidence out of Git.

- Daily: confirm Atlas reports a recent successful backup.
- Monthly: review retention, access roles, alerts, and the secure variable inventory.
- Quarterly: restore the latest production backup into an isolated non-production cluster.
- During each quarterly drill, time the restore, run the verification checklist against sanitized access, and delete the temporary cluster after evidence is recorded.
- After every drill, record achieved RPO, achieved RTO, gaps, owner, and due date outside this public repository.

Evidence for each drill must include the UTC start/end, source snapshot ID,
isolated target identifier, checksum result, collection/index validation,
application smoke results, achieved RPO/RTO, operator, reviewer, and cleanup
confirmation. A script parse or successful backup alone does not prove restore
readiness.

## Post-incident requirements

1. Preserve the timeline, correlated request IDs, deployment IDs, backup IDs, and operator actions.
2. Reconcile billing and usage data before normal billing automation resumes.
3. Notify affected customers according to contractual and legal obligations.
4. Complete a blameless review with root cause, detection gap, corrective actions, owners, and deadlines.
5. Update this runbook and add an automated regression test when the incident exposed a code defect.
