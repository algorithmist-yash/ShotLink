# Security Policy

## Supported version

Security fixes are applied to the latest revision of the default branch. Older deployments should be upgraded before requesting a backport.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting from the repository Security tab when it is enabled. If private reporting is unavailable, email `support@shotlink.in` with the subject `Shotlink security report`.

Include:

- the affected URL, endpoint, component, or commit
- reproduction steps or a minimal proof of concept
- expected and observed impact
- any suggested mitigation

Do not include live credentials, raw passwords, session tokens, payment data, or unnecessary personal data. Use a test account and redact sensitive evidence.

## Response targets

- acknowledgement: within 3 business days
- initial severity assessment: within 7 business days
- critical remediation target: 7 days
- high remediation target: 30 days
- medium remediation target: 60 days
- low remediation target: 90 days

These are targets rather than disclosure guarantees. Complex fixes may require coordinated deployment and customer communication.

## Research guidelines

- Stop testing if you access data belonging to another person or workspace.
- Do not perform denial-of-service testing, automated traffic flooding, social engineering, or destructive actions.
- Do not modify billing records or complete real payments.
- Delete any inadvertently collected data after the report is acknowledged.
- Allow a reasonable remediation period before public disclosure.

Good-faith research following these guidelines will not be pursued as malicious activity by the project maintainers.
