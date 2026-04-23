# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 2.1.x   | ✅ Yes             |
| 2.0.x   | ⚠️ Security fixes only |
| < 2.0   | ❌ No              |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Please report security vulnerabilities by emailing **security@stellar-did-platform.com**.  
Include the following in your report:

- Description of the vulnerability
- Affected contract(s) and function(s)
- Steps to reproduce
- Potential impact assessment
- (Optional) Suggested fix

We will acknowledge receipt within **48 hours** and aim to provide a full response within **7 business days**.

## Security Audit History

| Date         | Auditor              | Scope                                      | Status     |
|--------------|----------------------|--------------------------------------------|------------|
| Mar 25, 2026 | Internal Audit Team  | StellarDIDRegistry.sol (RBAC & pause)      | ✅ Fixed   |
| Apr 23, 2026 | Internal Audit Team  | All contracts (Issue #154 full audit)      | ✅ Fixed   |

Full audit reports are located in [`contracts/SECURITY_AUDIT_REPORT.md`](./contracts/SECURITY_AUDIT_REPORT.md).

## Bug Bounty

We run a responsible disclosure program. Valid critical/high severity findings may be eligible for a reward. Contact **security@stellar-did-platform.com** for details.

## Security Best Practices for Deployers

- Always deploy contracts through a multisig wallet
- Set up monitoring/alerting on `ContractPaused` events
- Rotate admin keys after initial deployment
- Never commit private keys or secrets to this repository
