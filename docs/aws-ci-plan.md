# AWS CI and Secrets Plan

Working notes for moving live Playwright suites to an AWS VM with AWS Secrets Manager, while keeping local runs on `.env`.

## Status
- Nothing in the repo has been changed for AWS yet. Changes wait until the AWS setup is reviewed.
- `.github/workflows/playwright.yml` is manual-only (`workflow_dispatch`). It no longer runs on PRs or pushes.
- `.github/workflows/quality.yml` still runs on every PR. It runs `npm run quality` (local checks only, no live app access).

## Decisions so far
- Live suites run on an AWS EC2 VM registered as a self-hosted GitHub Actions runner, triggered manually.
- Credentials and secrets come from AWS Secrets Manager on the VM. Local runs keep using `.env`.
- The VM has a static IP (Elastic IP or NAT) that the app whitelists. Login uses TOTP, since MFA can't be turned off.
- Nonproduction test account. Credentials are not expected to drift, but the password must be updated in both places when it changes.
- The SPA store (`playwright/.records/`) lives on the VM disk. Run live suites only from the VM, with a `concurrency` group so only one run goes at a time.
- Session timeouts don't affect current tests.

## Open decision: how config picks its secret source
- Preferred: an explicit flag, e.g. `SECRETS_SOURCE=dotenv|aws`. Local default is `dotenv`. The workflow sets `aws`.
- If `aws` is set and the secret can't be read, fail with a clear error. Don't fall back to `.env`.
- GitHub Actions sets `CI=true`, but a self-hosted runner doesn't unless the workflow sets it, so don't rely on `CI` alone.

## Items to confirm in AWS
- Secret name and structure (one secret per environment, or one per credential set).
- Whether the VM has an instance role, and its region.
- Whether the outbound IP is an Elastic IP or NAT gateway address, and that the app whitelist matches it.
- Whether the laptop IP is whitelisted. If not, live runs must come from the VM only.

## Planned code changes (after AWS review)
1. Config loader in `support/config`: honor `SECRETS_SOURCE`.
2. Small secret-fetch helper using the AWS SDK. Load it only when `aws` is set, so local runs don't need AWS packages.
3. Add the AWS SDK package to `package.json` (manifest change, then `npm install`).
4. `playwright.yml`: add a job for the self-hosted VM runner (labels such as `aws-live`), an AWS auth step (OIDC or instance role), and `SECRETS_SOURCE=aws`.
5. Update `README.md` and `docs/commands.md` with local and VM setup, the secret name, and the env var names.

## Security reminders
- Rotate the password that was pasted into the IDE (`.env`). Update Secrets Manager at the same time.
- Never paste TOTP seeds, passwords, or webhook URLs into chat or commit them.
- Restrict IAM read access on the secret to the VM role and the workflow.

## Other open items
- Post-intake split spec (`tests/smart/super/split-spa-pending-first-clock.spec.ts`): Notes and Review checks are written but have never run live. They need a fresh SPA and approval.
- Intake Needed split suite (`tests/suites/run-suite-split-intake-approval.mjs`): not run end to end.
- Slack webhook: create with a Slack app (Incoming Webhooks), store in Secrets Manager, not in the repo.
