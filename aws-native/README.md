# AWS-Native CI/CD — Reference Examples

This directory contains the **AWS-native equivalent** of the GitHub Actions CI/CD pipeline you built in the lab. These files are for **reading and comparison only** — you do not need to deploy them.

## How GitHub Actions maps to AWS services

```
GitHub Actions (what you built)          AWS-Native (what's in this directory)
────────────────────────────────          ────────────────────────────────────
.github/workflows/deploy.yml       →    pipeline.yml (CloudFormation for CodePipeline)
  on: push: branches: [main]       →      Source stage (CodeConnections webhook)
  test job (npm run lint)           →      buildspec.yml pre_build phase
  deploy job (docker build/push)    →      buildspec.yml build + post_build phases
  App Runner start-deployment       →      Deploy stage (Lambda trigger)

GitHub Secrets                      →    AWS Parameter Store / Secrets Manager
actions/checkout@v4                 →    CodePipeline Source stage (automatic)
actions/setup-node@v4               →    buildspec.yml install phase (runtime-versions)
aws-actions/configure-aws-credentials →  CodeBuild IAM Role (no credentials needed)
aws-actions/amazon-ecr-login        →    buildspec.yml pre_build (aws ecr get-login-password)
```

## Files

| File | AWS Service | GitHub Actions Equivalent |
|------|-------------|--------------------------|
| `buildspec.yml` | **CodeBuild** — defines install, lint, build, push phases | Steps inside `ci.yml` and `deploy.yml` |
| `pipeline.yml` | **CodePipeline** — CloudFormation template that wires Source → Build → Deploy | The `deploy.yml` workflow file itself |

## Key differences

### Credentials
- **GitHub Actions:** You manually stored AWS credentials as GitHub Secrets. Credentials rotate and must be updated.
- **AWS-Native:** CodeBuild gets an **IAM Role** automatically. No credentials to manage or rotate. This is more secure.

### Build configuration
- **GitHub Actions:** Build steps are defined inline in the workflow YAML (mixed with orchestration).
- **AWS-Native:** Build steps live in a separate `buildspec.yml` file. CodePipeline handles orchestration separately.

### Manual approval gate
- **GitHub Actions:** You'd need to add a `workflow_dispatch` or `environment` protection rule for manual approval.
- **AWS-Native:** CodePipeline has a built-in **Manual Approval** action. Uncomment the Approval stage in `pipeline.yml` to switch from Continuous Deployment to Continuous Delivery.

### Deployment strategies
- **GitHub Actions:** You implement deployment logic yourself (the `aws apprunner start-deployment` command).
- **AWS-Native:** CodeDeploy provides built-in **all-at-once**, **rolling**, and **blue/green** strategies with automatic rollback. You just pick one in the configuration.

### Cost
- **GitHub Actions:** 2,000 free minutes/month, then $0.008/min.
- **AWS CodePipeline:** $1/pipeline/month. CodeBuild: $0.005/build-minute (first 100 min free).

## When to use which?

| Scenario | Recommendation |
|----------|---------------|
| Open source project on GitHub | GitHub Actions |
| Small team, GitHub-centric workflow | GitHub Actions |
| Enterprise with AWS-only policy | CodePipeline |
| Need blue/green deployments with auto-rollback | CodePipeline + CodeDeploy |
| Multi-account AWS deployment (dev/staging/prod) | CodePipeline (cross-account roles) |
| Serverless app (Lambda + API Gateway) | CodePipeline + SAM |
