# Opendex Kiosko AWS infrastructure

This directory contains the production AWS controls managed as CloudFormation.
Deploy the stacks in the documented order so dependencies remain explicit and
changes are reviewable.

## Stacks

1. `private-assets.yaml`
   - Private tenant receipts and evidence.
   - S3 public access blocked, versioning and access logging enabled.
2. `security-baseline.yaml`
   - Monthly cost budget and alerts.
   - Multi-region CloudTrail for management events only.
   - Two essential CloudWatch alarms and account-level Access Analyzer.
   - SES bounce, complaint, rejection and delivery-delay notifications.
3. `threat-detection.yaml`
   - GuardDuty with S3 protection and unused paid protection plans disabled.
   - Security Hub with only AWS Foundational Security Best Practices.
   - AWS Config with daily recording.
   - Macie inventory with automated sensitive-data discovery disabled after deployment.
4. `vercel-oidc.yaml`
   - Production-only Vercel OIDC trust.
   - Temporary, least-privilege access to tenant assets, Cognito and SES.

## Cost controls

- The monthly budget defaults to USD 10 with actual alerts at 50%, 80% and
  100%, plus a forecast alert at 100%.
- CloudTrail records management events only. S3 object data events and Insights
  are intentionally excluded.
- AWS Config records daily instead of continuously.
- GuardDuty EKS, EBS malware, RDS, Lambda and runtime protection plans are
  intentionally disabled because this application does not run those workloads.
- Inspector and AWS WAF are intentionally excluded. The runtime is hosted by
  Vercel and the public edge controls belong there.
- S3 uses AES256 service-side encryption. Customer-managed KMS keys are not
  created because each key introduces a fixed monthly charge.
- Macie automated sensitive-data discovery must remain disabled. Only bucket
  inventory is kept enabled.

At the current inventory of four buckets, Macie bucket inventory is estimated
at USD 0.40 per month after its trial at the currently published USD 0.10 per
bucket rate. This excludes sensitive-data scanning, which remains disabled.

GuardDuty, Security Hub and Macie begin with a 30-day trial for eligible new
accounts or features. Review their usage before `2026-08-17` and disable any
service whose ongoing value does not justify its Cost Explorer forecast.

## Deployment order

Use the `opendex-admin` SSO profile, never the application IAM user or root.

```bash
AWS_PROFILE=opendex-admin aws cloudformation deploy \
  --region us-east-1 \
  --stack-name opendex-security-baseline \
  --template-file infra/aws/security-baseline.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides NotificationEmail=YOUR_OPERATIONAL_EMAIL

AWS_PROFILE=opendex-admin aws cloudformation deploy \
  --region us-east-1 \
  --stack-name opendex-threat-detection \
  --template-file infra/aws/threat-detection.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides AuditBucketName=BASELINE_OUTPUT_BUCKET SecurityTopicArn=BASELINE_OUTPUT_TOPIC

AWS_PROFILE=opendex-admin aws cloudformation deploy \
  --region us-east-1 \
  --stack-name opendex-vercel-oidc \
  --template-file infra/aws/vercel-oidc.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides PrivateAssetsBucketName=PRIVATE_ASSETS_OUTPUT_BUCKET
```

Confirm the SNS email subscription after the first stack is deployed. AWS
Budgets email subscribers do not require SNS confirmation.

The `OpendexAdministratorAccess` permission set uses a four-hour session. Human
administration must use Identity Center instead of the root user or application
access keys.

## Vercel runtime

Set these non-secret values only in the production environment:

```env
AWS_ROLE_ARN=VERCEL_ROLE_ARN_OUTPUT
AWS_OIDC_AUDIENCE=https://vercel.com/opendex-corporation
AWS_S3_PRIVATE_BUCKET=PRIVATE_ASSETS_OUTPUT_BUCKET
AWS_S3_PRIVATE_REGION=us-east-1
SES_CONFIGURATION_SET=my-first-configuration-set
```

Keep the legacy application access key active until a production deployment
successfully exercises S3, Cognito and SES through OIDC. After that verification,
remove the static AWS variables from Vercel, deactivate the key, observe the
application, and delete it in a separate controlled step.

## SES production access

The SES identity, DKIM, custom MAIL FROM, account suppression and critical event
destination are configured. The earlier production-access request is denied,
and SES returns `ConflictException` when the API attempts to reopen it. Do not
buy Premium Support for this workflow. Reply to the existing SES sending-limit
case in AWS Support Center with the following operational summary:

> Opendex Kiosko is a multi-tenant SaaS point-of-sale platform for independent
> retailers. Amazon SES is used exclusively for transactional and security
> messages: Cognito sign-up verification, password reset codes, tenant-user
> invitations, account security notices, and receipts or operational messages
> initiated by authenticated merchants. We do not send marketing campaigns and
> we do not use purchased, rented, scraped, or third-party mailing lists.
> Recipients either enter and verify their own address during registration or
> are invited by an authorized owner of a tenant. Initial volume is low and
> event-driven, and sending grows only with active verified tenants. The sending
> identity ows.opendex.dev is verified with DKIM and a custom MAIL FROM domain.
> Account-level suppression for BOUNCE and COMPLAINT is enabled. The SES
> configuration set routes BOUNCE, COMPLAINT, REJECT, RENDERING_FAILURE, and
> DELIVERY_DELAY events to a monitored security notification topic. Failed or
> suppressed recipients are not repeatedly retried, and complaint addresses are
> not contacted again. Mandatory authentication emails are sent only in direct
> response to a user action; no bulk or promotional email is planned.

## Rollback

Deleting the security stacks does not delete retained S3 audit data or the
CloudWatch log group. Remove those retained resources only after their retention
requirements have been reviewed. Do not remove the legacy application access
key until the OIDC cutover has passed production verification.
