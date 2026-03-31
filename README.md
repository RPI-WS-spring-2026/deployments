# In-Class Exercise: CI/CD Deployment — From Push to Production

In the previous labs you built authentication (Lab 6) and testing (Lab 7). Now you'll close the loop by setting up a **CI/CD pipeline** that automatically tests, builds, and deploys the todo app to AWS every time you push code.

**Time:** ~1.5 hours
**Prerequisites:** Completed Lab 6 (authentication working), Docker Desktop installed, AWS account access
**Stack:** Next.js 14 + MongoDB Atlas + GitHub Actions + Amazon ECR + Amazon ECS Fargate

---

## What You'll Learn

- The **deployment problem** and why CI/CD exists
- The difference between **Continuous Integration**, **Continuous Delivery**, and **Continuous Deployment**
- How to create a **GitHub Actions** CI workflow that runs tests on every push
- How the **testing pyramid** from Lab 7 maps to CI/CD pipeline stages
- How to build and push **Docker images** to Amazon Elastic Container Registry (ECR)
- How to deploy a containerized app to **Amazon ECS Fargate** (serverless containers)
- AWS deployment strategies: **all-at-once**, **rolling**, and **blue/green**
- How **Infrastructure as Code** works using AWS CloudFormation
- How **GitHub Actions compares to AWS CodePipeline** and the AWS DevOps toolchain

---

## Background: The Deployment Problem

In Lab 6 you built an authenticated app. In Lab 7 you wrote tests to verify it works. But how does tested code become a running application that users can access?

### Manual Deployment Risks

| Problem | What goes wrong |
|---------|----------------|
| Human error | Forgot a step, ran the wrong command, deployed to the wrong server |
| "Works on my machine" | Dev and prod environments diverge over time |
| Long release cycles | Fear of shipping leads to infrequent, risky "big bang" releases |
| No rollback plan | Something breaks in production and you can't quickly revert |
| Testing skipped under pressure | Deadlines lead to "just ship it" without running tests |

**CI/CD solves all of these** by automating the pipeline from code commit to running application: tests run on every commit, builds are reproducible, deploys are one-click or fully automatic, and rollback is always possible.

---

## Background: Understanding CI / CD

```
    Code   ──▶   Build   ──▶   Test   ──▶   Deploy
    ├─────── Continuous Integration ──────┤
    ├──────── Continuous Delivery ────────────┤ (manual gate before deploy)
    ├──────── Continuous Deployment ───────────┤ (no gate — fully automatic)
```

| Level | What it means | Gate to production? |
|-------|--------------|---------------------|
| **Continuous Integration** | Merge code often. Automatically build and run tests on every commit. Goal: catch integration bugs early. | N/A — not about deployment |
| **Continuous Delivery** | Code is always in a deployable state. Deployment to production requires a **manual approval step**. | Yes — human clicks "deploy" |
| **Continuous Deployment** | Every change that passes tests is deployed automatically to production. No human gate. | No — fully automatic |

In this lab you'll build **Continuous Deployment**: push to `main` → tests run → if tests pass → automatically deployed to AWS.

---

## Background: From Testing Pyramid to Pipeline Stages

In Lab 7 you learned the testing pyramid. Here's how it maps to the CI/CD pipeline you'll build:

```
  Testing Pyramid                    CI/CD Pipeline Stages
  ───────────────                    ─────────────────────
  ┌──────────────┐
  │   E2E Tests  │  Few, slow       git push ──▶ Triggers the pipeline
  ├──────────────┤                   Run Linter ──▶ Fast, fail first
  │ Integration  │  Some, moderate   Build Docker Image ──▶ Produce artifact
  ├──────────────┤                   Push to ECR ──▶ Store artifact
  │  Unit Tests  │  Many, fast       Deploy to ECS ──▶ Ship to production
  └──────────────┘
```

The tests you wrote in Lab 7 (unit, integration) become **gates** in the pipeline. A failing test **blocks** the deployment — that's the whole point. Untested code never reaches production.

---

## Background: Environments

Professional teams deploy through a series of environments:

| Environment | Purpose | Who uses it | Breaking OK? |
|-------------|---------|-------------|--------------|
| **Development** | Local machines or shared dev server | Developers | Yes |
| **Staging** | Mirrors production exactly — real infrastructure, safe data | QA, integration tests | Carefully |
| **Production** | Live users, real data, zero tolerance for downtime | Everyone | Never |

**Infrastructure as Code** ensures each environment is identical — eliminating "works on my machine."

In this lab, your local `docker compose` setup is **development** and ECS Fargate is **production**. Both use the same MongoDB Atlas database (in a real project you'd have separate databases per environment). The stretch goals add a staging environment.

---

## Architecture Overview

```
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌─────────────┐
│  GitHub  │────▶│GitHub Actions│────▶│Amazon ECR│────▶│ Amazon ECS  │
│   Push   │     │  (CI/CD)     │     │ (Images) │     │ (Fargate)   │
└─────────┘     └──────────────┘     └──────────┘     └──────┬──────┘
                  │ 1. Lint                                   │
                  │ 2. Build Docker              ┌────────────▼──┐
                  │ 3. Push to ECR               │ Load Balancer │
                  │ 4. Trigger deploy            │  (ALB)        │
                                                 └────────────┬──┘
                                                              │
                                                    ┌─────────▼───┐
                                                    │MongoDB Atlas│
                                                    │ (Database)  │
                                                    └─────────────┘
```

### How this maps to the AWS DevOps Toolchain

In the lecture you learned about AWS-native CI/CD services. Here's how our GitHub Actions pipeline maps to the AWS equivalents:

| Our pipeline (GitHub Actions) | AWS-native equivalent | Role |
|------------------------------|----------------------|------|
| GitHub repository | CodeCommit / CodeConnections | Source code |
| GitHub Actions workflow | **CodePipeline** | Orchestration |
| `npm run lint` / `npm test` steps | **CodeBuild** (with `buildspec.yml`) | Build & test |
| `docker push` to ECR | CodeBuild artifact → S3 | Store build output |
| ECS `update-service --force-new-deployment` | **CodeDeploy** | Deploy to compute |
| CloudFormation template | **CloudFormation** | Infrastructure as Code |

> **Why GitHub Actions instead of CodePipeline?** You already use GitHub daily. GitHub Actions is the industry standard for GitHub-hosted projects, has a lower learning curve, and 2,000 free minutes/month. Understanding both prepares you for industry — see the comparison table in Part 5.

---

## Getting Started

### 1. Accept the assignment and clone

1. Accept the GitHub Classroom assignment using the link provided by your instructor
2. Clone **your** assignment repository:

```bash
git clone https://github.com/RPI-WS-spring-2026/deployment-exercise-yourusername.git
cd deployment-exercise-yourusername
```

### 2. Set Up MongoDB Atlas (~10 min)

Unlike previous labs where MongoDB ran in a local Docker container, this lab uses **MongoDB Atlas** — a free cloud-hosted database. This is the same database for both local development and production deployment, which means your local app behaves identically to the deployed version. No more "works on my machine" database issues.

> **Why cloud-hosted for local dev too?** When your local dev and production environments use the same database service (even if different instances), you eliminate an entire class of bugs where queries work on local MongoDB but fail on Atlas due to version differences, connection string formats, or driver behavior. This is the "environments must match" principle from the lecture.

#### Step 1 — Create a MongoDB Atlas account

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and sign up (free)
2. Create a new **Shared Cluster** (the free M0 tier)
3. Choose **AWS** as the cloud provider and pick **us-east-1** as the region

#### Step 2 — Configure access

1. Go to **Database Access** → **Add New Database User**
   - Username: `todoapp`
   - Password: generate a secure password and **save it**
   - Role: "Read and Write to Any Database"

2. Go to **Network Access** → **Add IP Address**
   - Click **Allow Access from Anywhere** (0.0.0.0/0)
   - This is required for both your local machine and AWS ECS to connect

#### Step 3 — Get your connection string

1. Go to **Database** → **Connect** → **Connect your application**
2. Copy the connection string. It looks like:
   ```
   mongodb+srv://todoapp:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
3. Replace `<password>` with your actual password
4. Add a database name before the `?`:
   ```
   mongodb+srv://todoapp:yourpassword@cluster0.xxxxx.mongodb.net/todoapp?retryWrites=true&w=majority
   ```

> **Important:** Never commit connection strings or passwords to your repository. In a production AWS setup, you'd use **AWS Secrets Manager** or **Parameter Store** — CodeBuild can inject them as environment variables during the build phase.

#### Step 4 — Create your `.env` file

The repository includes a `.env.example` template. Copy it and fill in your Atlas connection string:

```bash
cp .env.example .env
```

Edit `.env` and replace the placeholder with your actual connection string:

```
MONGODB_URI=mongodb+srv://todoapp:yourpassword@cluster0.xxxxx.mongodb.net/todoapp?retryWrites=true&w=majority
```

The `.env` file is listed in `.gitignore` so it will **never be committed** to your repository. Docker Compose reads it automatically via the `env_file` directive.

### 3. Verify the app runs locally

Make sure Docker Desktop is running, then:

```bash
docker compose up --build
```

This starts the Next.js todo app on [http://localhost:3003](http://localhost:3003), connected to your MongoDB Atlas cluster.

Open [http://localhost:3003](http://localhost:3003) and verify you can:
- Register a new user
- Login
- Create a project
- Add tasks to it

Press `Ctrl+C` to stop when done.

> **Note:** The app already has Lab 6 authentication completed. You're building on top of a working application.

> **Troubleshooting:** If you see a MongoDB connection error, double-check your `.env` file — make sure there are no extra spaces, the password is correct, and you included the database name (`/todoapp?`) in the URI.

---

## Part 1: Explore the Test Suite and CI Workflow (~20 min)

**Goal:** Understand the three layers of testing and how they map to the CI pipeline.

### Background: Testing Pyramid in CI/CD

The app includes tests at three layers, mirroring the **testing pyramid** from Lab 7:

| Layer | Tool | What it tests | Speed | Files |
|-------|------|---------------|-------|-------|
| **Unit** | Jest | Auth functions, validation logic — in isolation | Fast (ms) | `tests/unit/*.test.js` |
| **Integration** | Jest + fetch | API routes + auth + database together via HTTP | Medium (s) | `tests/integration/api.test.js` |
| **End-to-End** | Playwright | Full app in a real Chromium browser — register, login, create projects | Slow (s) | `tests/e2e/app.spec.js` |

The CI workflow runs these in order: **unit tests first** (fail fast), then **integration and E2E in parallel** (need a running app), then **Docker build** (only if all tests pass).

```
                        CI Pipeline
  ┌────────────────┐   ┌──────────────────┐   ┌─────────────┐
  │ lint + unit    │──▶│ integration      │──▶│ Docker      │
  │ (fastest)      │   │ + E2E (parallel) │   │ build       │
  └────────────────┘   └──────────────────┘   └─────────────┘
     Fail fast            Need running app       Only if all pass
```

### Step 1 — Run the tests locally

```bash
# Unit tests (no database needed — runs in milliseconds)
cd react-nextjs-mongo
npm install
npm run test:unit
```

You should see ~30 unit tests pass across `auth.test.js` and `validation.test.js`.

```bash
# Integration tests (requires running app + MongoDB)
# In another terminal, start the app:
cd ..
docker compose up --build

# Then run integration tests:
cd react-nextjs-mongo
npm run test:integration
```

You should see ~20 integration tests pass — registration, login, project CRUD, and user isolation.

```bash
# E2E tests (requires running app + Playwright browser)
npx playwright install chromium
npm run test:e2e
```

You should see ~10 E2E tests pass — homepage rendering, registration flow, login flow, project creation, and unauthenticated access handling.

### Step 2 — Read the test files

Open each test file and understand what's being tested:

**Unit tests** (`tests/unit/auth.test.js`):
- `signToken()` — returns valid JWT, correct payload, correct expiration
- `verifyAuth()` — accepts valid tokens, rejects expired/tampered/malformed tokens

**Unit tests** (`tests/unit/validation.test.js`):
- Project name validation — empty, whitespace, too long
- Task status validation — valid statuses, invalid statuses
- Auth input validation — missing fields

**Integration tests** (`tests/integration/api.test.js`):
- `POST /api/auth/register` — success (201), duplicate (409), missing fields (400)
- `POST /api/auth/login` — success with token, wrong password (401), missing user (401)
- `GET/POST /api/projects` — requires auth (401), CRUD operations, empty name (400)
- **Authorization isolation** — User B cannot see User A's projects

**E2E tests** (`tests/e2e/app.spec.js`):
- Homepage displays welcome message and login link
- Registration flow — success and duplicate username error
- Login flow — success redirects to projects, wrong password shows error
- Full flow — login → create project → see project in list
- Unauthenticated access handling

### Step 3 — Review the CI workflow

Open `.github/workflows/ci.yml` and read through it. Notice how:

1. **`lint-and-unit` job** runs first — lint + unit tests need no database, so they're the fastest gate
2. **`integration` job** starts Docker Compose (app + MongoDB) then runs API tests
3. **`e2e` job** starts Docker Compose then runs Playwright in a real browser
4. **`build` job** only runs if ALL test jobs pass — `needs: [lint-and-unit, integration, e2e]`

> **Compare to AWS CodeBuild:** In the AWS-native approach, you'd put these same commands in a `buildspec.yml` file with `install`, `pre_build`, and `build` phases. Open `aws-native/buildspec.yml` to see the side-by-side equivalent — each phase is annotated with the GitHub Actions step it replaces.

### Step 4 — Push and watch

```bash
git add -A
git commit -m "Review test suite and CI pipeline"
git push
```

Go to the **Actions** tab and watch the CI workflow:
- [ ] `lint-and-unit` job passes (lint + unit tests)
- [ ] `integration` job passes (API tests against running app)
- [ ] `e2e` job passes (Playwright browser tests)
- [ ] `build` job passes (Docker image builds)
- [ ] All 4 jobs show green checkmarks

> **Key concept:** This is **Continuous Integration** — every push is automatically validated at all three testing layers. A failing unit test blocks integration tests. A failing integration test blocks the Docker build. Broken code never gets built into an image. This is the same gating principle that CodePipeline uses: **failed stages block downstream stages**.

---

## Part 2: Set Up AWS Infrastructure (~15 min)

**Goal:** Create an ECR repository, push a seed image, and deploy ECS infrastructure using CloudFormation.

### Background: AWS Container Services

AWS offers several ways to run containers:

| Service | What it manages | Best for |
|---------|----------------|----------|
| **ECS Fargate** | You define tasks; AWS manages servers | Production containers without managing EC2 |
| **ECS on EC2** | You manage the EC2 instances | Full control over compute |
| **Elastic Beanstalk** | Everything (EC2, ALB, ASG) | Quick deploys from source code |
| **EKS (Kubernetes)** | Kubernetes control plane | Teams already using Kubernetes |

We use **ECS Fargate** — you define what container to run (image, CPU, memory, env vars) and AWS handles the underlying compute. Combined with a **CloudFormation template**, the entire infrastructure is created with a single command.

### Step 1 — Log into the AWS Console

1. Log into the [AWS Management Console](https://console.aws.amazon.com/)
2. Pick a region (e.g. **us-east-1** or **us-east-2**) and note it — you'll use the same region for all AWS resources and in your `AWS_REGION` GitHub Secret
3. Note your **AWS Account ID** (top right corner → click your username)

### Step 2 — Create an IAM User for GitHub Actions

GitHub Actions needs AWS credentials to push images to ECR and trigger deployments. You'll create a dedicated **IAM user** with only the permissions it needs — this follows the **principle of least privilege**.

1. In the AWS Console, search for **IAM** and open it
2. Go to **Users** → **Create user**
3. **User name:** `github-actions-deployer`
4. Click **Next**
5. **Set permissions:** Choose **Attach policies directly**
6. Search for and attach these managed policies:
   - `AmazonEC2ContainerRegistryPowerUser` — push/pull Docker images to ECR
   - `AmazonECS_FullAccess` — manage ECS services and trigger deployments
7. Click **Next** → **Create user**
8. Click into the newly created user → **Security credentials** tab
9. Under **Access keys**, click **Create access key**
10. Select **Third-party service** (since GitHub Actions is external)
11. Click **Create access key**
12. **Save both the Access Key ID and Secret Access Key** — the secret is only shown once!

> **Why a dedicated IAM user?** Never use your root account or personal credentials in CI/CD. A dedicated user with scoped permissions limits the blast radius if credentials are compromised. In a production environment you'd go further and use **OIDC federation** (no long-lived credentials at all) — see the Discussion Questions.

### Step 3 — Create an ECR Repository

Amazon Elastic Container Registry (ECR) is a private Docker registry — like Docker Hub, but in your AWS account. In the AWS-native pipeline, CodeBuild would push build **artifacts** to S3. Since we're deploying containers, ECR serves the same purpose: it stores the deployable artifact (the Docker image).

1. In the AWS Console, search for **ECR** and open it
2. Click **Create repository**
3. Settings:
   - **Visibility:** Private
   - **Repository name:** `todo-app`
4. Click **Create repository**
5. Note the **URI** — it looks like: `123456789012.dkr.ecr.us-east-2.amazonaws.com/todo-app`

### Step 4 — Push a seed image to ECR

The ECS infrastructure (next step) needs an image in ECR before it can start. You'll push your first image manually from your local machine. After this, the GitHub Actions workflow handles all future pushes automatically.

First, make sure the **AWS CLI** is installed and configured with your IAM user credentials:

```bash
aws configure
```

Enter:
- **Access Key ID:** from Step 2
- **Secret Access Key:** from Step 2
- **Default region:** your region (e.g. `us-east-2`)
- **Output format:** `json`

Now build and push the image (replace the account ID and region with your own):

```bash
# Log Docker into ECR
aws ecr get-login-password --region us-east-2 \
  | docker login --username AWS --password-stdin \
    199865934287.dkr.ecr.us-east-2.amazonaws.com

# Build the image
docker build -t todo-app ./react-nextjs-mongo

# Tag it for ECR
docker tag todo-app:latest \
  199865934287.dkr.ecr.us-east-2.amazonaws.com/todo-app:latest

# Push it
docker push 199865934287.dkr.ecr.us-east-2.amazonaws.com/todo-app:latest
```

> **Replace `199865934287` and `us-east-2`** with your own account ID and region. You can find the full URI on the ECR repository page in the console.

Verify the image appears in the AWS Console under **ECR** → **Repositories** → **todo-app** → **Images**.

### Step 5 — Deploy the ECS infrastructure with CloudFormation

Instead of clicking through the console to create a cluster, load balancer, security groups, and service, you'll deploy everything with a single CloudFormation command. This is **Infrastructure as Code** in action.

First, get your default VPC and subnet IDs:

```bash
# Get your default VPC ID
aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" --output text

# Get subnet IDs (you need at least 2 in different AZs)
aws ec2 describe-subnets --filters "Name=vpc-id,Values=YOUR_VPC_ID" \
  --query "Subnets[*].[SubnetId,AvailabilityZone]" --output table
```

Now deploy the stack (replace the placeholder values):

```bash
aws cloudformation deploy \
  --template-file cloudformation/infrastructure.yml \
  --stack-name todo-app \
  --parameter-overrides \
      ImageUri=199865934287.dkr.ecr.us-east-2.amazonaws.com/todo-app:latest \
      MongoDBUri="YOUR_ATLAS_CONNECTION_STRING" \
      VpcId=vpc-xxxxxxxx \
      SubnetIds=subnet-aaaaaaaa,subnet-bbbbbbbb \
  --capabilities CAPABILITY_IAM
```

> **What just happened?** CloudFormation read the template and created 9 resources: an ECS cluster, task definition, service, load balancer, target group, listener, two security groups, a log group, and an IAM role. All from a single command. Try creating that by clicking through the console!

Wait for the stack to complete (3-5 minutes), then get your app's URL:

```bash
aws cloudformation describe-stacks --stack-name todo-app \
  --query "Stacks[0].Outputs" --output table
```

Open the **ServiceUrl** in your browser — your app should be live!

> **Deployment strategy:** ECS performs a **rolling deployment** by default — it starts new tasks with the new image, waits for health checks to pass via the load balancer, then stops old tasks. This means zero downtime during deploys. Compare this to the **all-at-once**, **rolling**, and **blue/green** strategies from the lecture.

### Step 6 — Add GitHub Secrets

GitHub Secrets store sensitive values that your workflows can access without exposing them in code.

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each:

| Secret Name | Value | Example |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | Access key from the IAM user you created in Step 2 | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | Secret access key from Step 2 | |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID | `199865934287` |
| `AWS_REGION` | The AWS region where you created your ECR repo | `us-east-2` |
| `ECR_REPOSITORY` | Name of your ECR repository | `todo-app` |
| `ECS_CLUSTER` | ECS cluster name (from CloudFormation outputs) | `todo-app` |
| `ECS_SERVICE` | ECS service name (from CloudFormation outputs) | `todo-app` |
| `MONGODB_URI` | Your Atlas connection string | `mongodb+srv://...` |

> **Why secrets instead of hardcoded values?** Region, repo names, and account IDs vary per student and per environment. Storing them as secrets keeps the workflow portable — the same `deploy.yml` works for everyone without editing the file. In a team setting, you'd have separate secret sets for dev, staging, and production.

> **Security note:** The AWS credentials are long-lived IAM keys. Treat them like passwords — never commit them to code, share them in chat, or reuse them across projects. In a production environment, you'd replace these with **OIDC federation** so GitHub Actions assumes an IAM Role directly with no stored credentials at all.

---

## Part 3: Add the Deploy Workflow (~20 min)

**Goal:** Implement **Continuous Deployment** — push to `main` triggers test → build → push → deploy automatically.

This is the equivalent of a full **CodePipeline** with Source → Build → Deploy stages, but defined as a GitHub Actions workflow.

### Step 1 — Review the deploy workflow

The deploy workflow is already provided at `.github/workflows/deploy.yml`. Open it and read through the comments — every step is annotated.

Key things to notice:
- **No hardcoded values** — region, repo name, and service name all come from `secrets.*`
- The `test` job gates the `deploy` job via `needs: test`
- Images are tagged with both the commit SHA (for rollback) and `latest` (what the ECS task definition references)

> **If you want to customize it**, the workflow is fully yours to modify. But it should work as-is once your GitHub Secrets are configured correctly.

### Understanding the workflow — mapping to AWS services

| Pipeline Stage | GitHub Actions Step | AWS-Native Equivalent |
|---------------|--------------------|-----------------------|
| **Source** | `on: push` trigger | CodeConnections (GitHub webhook) |
| **Test** | `test` job (lint) | CodeBuild `pre_build` phase |
| **Build** | `docker build` + `docker push` | CodeBuild `build` phase → artifact to S3/ECR |
| **Deploy** | `ecs update-service --force-new-deployment` | CodeDeploy targeting ECS/Beanstalk |
| **Orchestration** | `needs: test` (job dependency) | CodePipeline stage ordering |

> **Key insight:** The `needs: test` dependency creates the same gating behavior as CodePipeline: **failed stages block downstream stages**. A failing lint check stops the entire deploy, just as a failed CodeBuild phase halts the CodePipeline. Open `aws-native/pipeline.yml` to see a full CodePipeline CloudFormation template that does the same thing — every stage is annotated with its `deploy.yml` equivalent.

### Step 2 — Trigger the first automated deploy

Make any small change (e.g. add a comment to `deploy.yml`) and push to trigger the workflow:

```bash
git add -A
git commit -m "Trigger first automated deploy"
git push
```

### Step 3 — Watch the deployment

1. Go to **Actions** tab — you should see both CI and Deploy workflows running
2. Wait for the deploy job to complete (2-3 minutes for the Docker build)
3. The workflow pushes a new image to ECR, then triggers an ECS rolling deployment
4. Go to the **AWS Console** → **ECS** → **Clusters** → **todo-app** → **Services** to watch the deployment status
5. Click the **Default domain** URL to verify — it should match the seed image you pushed manually, but now it was deployed through the pipeline

### Test it:

- [ ] Open your load balancer URL in a browser
- [ ] Register a new user
- [ ] Create a project and add tasks
- [ ] Data persists (it's stored in MongoDB Atlas)

---

## Part 4: See CI/CD in Action (~10 min)

**Goal:** Experience the full **Continuous Deployment** cycle: push code → tests run → app deploys.

### Step 1 — Make a visible change

Edit `react-nextjs-mongo/src/app/page.js` and change the welcome message or page title to something recognizable, like:

```js
// Change the heading text to include your name or a version
<h1>Todo App v2 - Deployed with CI/CD!</h1>
```

### Step 2 — Push the change

```bash
git add react-nextjs-mongo/src/app/page.js
git commit -m "Update welcome message to verify CI/CD pipeline"
git push
```

### Step 3 — Watch the pipeline

1. Go to **Actions** tab and watch the workflow
2. The test job runs first (should pass)
3. The deploy job builds a new Docker image and pushes it
4. ECS performs a rolling deployment — starts new tasks with the new image, health checks pass, old tasks stop (zero downtime)

### Step 4 — Verify the deployment

1. Wait 2-3 minutes after the workflow completes
2. Refresh your load balancer URL
3. You should see your updated welcome message

> **This is Continuous Deployment in action:** You pushed code, and it was automatically tested, built, containerized, and deployed to ECS — without touching the AWS Console. In an AWS-native setup, CodePipeline would show each stage transitioning from blue (in progress) to green (succeeded).

### Test it:

- [ ] Your code change is visible at the load balancer URL
- [ ] The entire process (push → live) took under 5 minutes
- [ ] Both workflow runs show in the Actions tab

---

## Part 5: Infrastructure as Code & AWS Comparison (~15 min)

**Goal:** Understand Infrastructure as Code and how GitHub Actions compares to AWS-native CI/CD.

### 6a. Infrastructure as Code with CloudFormation

In Part 2 you created AWS resources using CloudFormation — but you could also imagine clicking through the Console to create each resource manually. That approach works once but isn't reproducible, version-controlled, or reviewable.

**CloudFormation** solves this by letting you define your infrastructure in a template file:

- **Reproducible** — spin up identical dev, staging, and prod environments from the same template
- **Version controlled** — infrastructure changes go through code review like application code
- **Self-documenting** — the template IS the architecture diagram
- **Rollback support** — CloudFormation can revert a stack to its previous state
- **No snowflake servers** — destroy and recreate instead of patching in-place

### Step 1 — Read the CloudFormation template

Open `cloudformation/infrastructure.yml` in your repository. This template creates the same resources you built manually:

- An ECR repository
- IAM roles for ECS to pull images from ECR and write logs
- An ECS cluster, task definition, and service
- An Application Load Balancer with security groups

Notice how the template uses:
- **Parameters** — like function arguments (App name, port, MongoDB URI)
- **Resources** — the AWS resources to create (the only *required* section)
- **`!Sub`** — string substitution that inserts your account ID and region
- **`!Ref`** and **`!GetAtt`** — references between resources

> **Compare to AWS SAM:** For serverless apps (Lambda + API Gateway + DynamoDB), **AWS SAM** provides simplified syntax. One SAM resource definition can expand to 50+ lines of CloudFormation. SAM is to CloudFormation what React is to vanilla DOM manipulation. You can see a small example of a Lambda function in `aws-native/pipeline.yml` — the `DeployFunction` resource — and imagine how much simpler it would be with SAM's `AWS::Serverless::Function` type.

### Step 2 — Answer these questions

Add your answers as YAML comments at the bottom of `cloudformation/infrastructure.yml`:

1. What does the `Resources` section define?
2. What is the `!Sub` function doing in the `ImageIdentifier` property?
3. If you deleted this CloudFormation stack, what would happen to your ECS service, load balancer, and all the other resources?
4. What is one advantage of defining infrastructure in a template file vs. clicking through the Console?

### 6b. GitHub Actions vs AWS CodePipeline

You built your pipeline with GitHub Actions. The `aws-native/` directory contains the **AWS-native equivalent** — the same pipeline built with CodePipeline + CodeBuild. Read these files side by side:

| Your file (GitHub Actions) | AWS-native equivalent | What to compare |
|---|---|---|
| `.github/workflows/deploy.yml` | `aws-native/pipeline.yml` | Orchestration: jobs/stages, triggers, gating |
| Steps inside `ci.yml` + `deploy.yml` | `aws-native/buildspec.yml` | Build commands: install, lint, docker build, push |
| GitHub Secrets (manual setup) | IAM Roles in `pipeline.yml` | Credential management approach |

### Step 3 — Read the AWS-native files

Open `aws-native/buildspec.yml` and `aws-native/pipeline.yml`. Each section is annotated with comments showing the GitHub Actions equivalent. Also read `aws-native/README.md` for a full comparison.

Key differences to notice:
- **Credentials:** GitHub Actions needs secrets you manually copy. CodeBuild gets an IAM Role automatically — more secure, no rotation needed.
- **Separation of concerns:** GitHub Actions mixes orchestration and build commands in one file. AWS separates them: CodePipeline orchestrates, `buildspec.yml` defines build steps.
- **Manual approval:** CodePipeline has a built-in Manual Approval action (uncommented in `pipeline.yml`). This is how you switch between Continuous Deployment and Continuous Delivery.
- **Deployment strategies:** CodeDeploy provides built-in all-at-once, rolling, and blue/green with automatic rollback. With GitHub Actions you implement this yourself.

Here's the summary comparison:

| Feature | GitHub Actions | AWS CodePipeline |
|---------|---------------|-----------------|
| **Trigger** | `git push`, PR, schedule | Git push, webhook, manual |
| **Build runner** | GitHub-hosted or self-hosted | CodeBuild (managed containers) |
| **Config format** | YAML in `.github/workflows/` | `buildspec.yml` + Console/CloudFormation |
| **AWS credentials** | IAM user keys in GitHub Secrets (or OIDC) | Automatic IAM Roles (no stored credentials) |
| **Cost** | 2,000 min/mo free, then pay | $1/pipeline/mo + CodeBuild minutes |
| **Deployment strategies** | Custom (you implement) | Built-in all-at-once, rolling, blue/green |
| **Best for** | Open source, GitHub-centric teams | AWS-native production apps |
| **Learning curve** | Easier, more community tutorials | Steeper but more enterprise features |

### Step 4 — Answer this question

Add a file `COMPARISON.md` to the root of your repository answering:

**If you were deploying a production application for a company that uses AWS exclusively, would you choose GitHub Actions or AWS CodePipeline? Give at least two reasons. Reference specific differences you observed in the `aws-native/` files.**

---

## Part 6: Deployment Strategies (~5 min, reading + questions)

**Goal:** Understand how production deployments handle the transition from old code to new code.

When ECS deploys your new image, it doesn't just stop the old version and start the new one. There are several strategies:

### All-at-Once
Deploy to all instances simultaneously.
- **Pros:** Fast, simple
- **Cons:** Full downtime if deploy fails
- **Use when:** Development/testing environments

### Rolling
Deploy batch-by-batch, keeping some old instances running.
- **Pros:** No full downtime
- **Cons:** Two versions run simultaneously during deploy
- **Use when:** Moderate risk tolerance

### Blue/Green
Deploy to an entirely new set of instances, then switch traffic.
- **Pros:** Instant rollback (just switch back), zero downtime
- **Cons:** Double the infrastructure cost during deploy
- **Use when:** Production — this is the **recommended** approach

> **ECS uses rolling deployment** by default (configured in the CloudFormation template via `DeploymentConfiguration`). AWS CodeDeploy supports all three strategies for ECS, and also supports **traffic shifting** for Lambda (e.g., route 10% of traffic to the new version, then gradually increase).

### Answer this question

Add to your `COMPARISON.md`:

**Your todo app is now serving 10,000 users. You need to deploy a database schema change that is NOT backward-compatible. Which deployment strategy would you use and why?**

---

## Part 7: Stretch Goals (Optional)

### Stretch 1: Add a staging environment

Deploy a second CloudFormation stack called `todo-app-staging` with its own MongoDB Atlas database. Modify your deploy workflow to:
- Deploy to **staging** on every push to `main`
- Deploy to **production** only when a GitHub Release is published (use `on: release` trigger)

This mirrors the Dev → Staging → Production environment progression from the lecture.

### Stretch 2: Add a health check endpoint

1. Create `react-nextjs-mongo/src/app/api/health/route.js` that returns `{ status: "ok", timestamp: ... }`
2. Update the `HealthCheckPath` in the CloudFormation template to `/api/health`
3. Add a step in your deploy workflow that waits for the health check to pass after deploy

> This is how production systems verify a deploy succeeded — **CloudWatch** would monitor this endpoint and trigger alarms if it starts failing.

### Stretch 3: Deploy with CodePipeline

Try deploying the app using the AWS-native approach:

1. Create a CodeConnections connection to your GitHub repo
2. Create a CodeBuild project that uses `aws-native/buildspec.yml`
3. Create a CodePipeline with Source → Build stages
4. Push a change and watch both pipelines (GitHub Actions AND CodePipeline) run simultaneously

Compare the experience: which was easier to set up? Which gives you more visibility into what's happening?

### Discussion Questions

1. **What is the difference between Continuous Integration, Continuous Delivery, and Continuous Deployment?** Which one did you implement in this lab?

2. **How does the testing pyramid from Lab 7 connect to the CI/CD pipeline?** Why do we run the linter (fastest check) first?

3. **Why do we tag images with both the commit SHA and `latest`?** When would you use the SHA tag to rollback?

4. **What are the security implications of storing long-lived IAM credentials as GitHub Secrets?** How does OIDC federation eliminate this risk? What is the principle of least privilege and how did we apply it when creating the IAM user?

5. **Compare GitHub Actions to AWS CodePipeline + CodeBuild + CodeDeploy.** When would you choose each?

6. **Why is "works on my machine" a deployment problem, and how does Docker solve it?** How does Infrastructure as Code (CloudFormation) extend this idea to the infrastructure layer?

7. **Explain the blue/green deployment strategy.** Why is it recommended for production? What's the tradeoff?

---

## Submitting Your Work

Commit and push all your changes:

```bash
git add -A
git commit -m "CI/CD deployment pipeline complete"
git push
```

---

## Automated Grading

When you push your code, an automated grading workflow checks:

1. CI workflow file exists at `.github/workflows/ci.yml`
2. CI workflow includes a linting step
3. CI workflow includes a Docker build step
4. Deploy workflow file exists at `.github/workflows/deploy.yml`
5. Deploy workflow includes AWS credential configuration
6. Deploy workflow includes ECR login and push steps
7. Deploy workflow includes ECS deployment step
8. CloudFormation template exists with answers to questions
9. The `MONGODB_URI` environment variable is used in `db.js` (not hardcoded)
10. The Dockerfile builds successfully
11. `COMPARISON.md` exists with deployment strategy and tooling answers

**To check your results:** Go to the **Actions** tab. A green check means all grading checks passed.

---

## Troubleshooting

- **AWS credentials not working:** Verify the IAM user `github-actions-deployer` has the correct policies attached (`AmazonEC2ContainerRegistryPowerUser` and `AmazonECS_FullAccess`). Double-check the access key ID and secret in your GitHub Secrets.
- **CloudFormation stack fails:** Check the Events tab in the CloudFormation console for the specific error. Common issues: invalid VPC/subnet IDs, subnets not in different AZs, or missing `--capabilities CAPABILITY_IAM` flag.
- **ECS task keeps stopping:** Check the logs in CloudWatch under `/ecs/todo-app`. Common causes: bad `MONGODB_URI`, missing environment variables, or the container crashing on startup.
- **ECR push denied:** Verify your `AWS_ACCOUNT_ID` secret is correct (12 digits, no dashes).
- **ECS service stuck deploying:** Check the ECS console → Service → Deployments tab. If tasks keep failing health checks, check the CloudWatch logs and verify the load balancer security group allows port 80 inbound.
- **MongoDB connection errors in production:** Verify your Atlas Network Access allows `0.0.0.0/0` and the `MONGODB_URI` secret has the correct password and database name.
- **Workflow doesn't trigger:** Make sure the workflow file is in `.github/workflows/` (not `github/` — note the leading dot) and pushed to `main`.
- **Docker build fails in Actions:** The Dockerfile `WORKDIR` and `COPY` paths must match. Verify the `build` context path in the workflow matches where `Dockerfile` lives.

---

## Key Vocabulary

| Term | Definition |
|------|-----------|
| **CI (Continuous Integration)** | Merge often, automatically build and test on every commit |
| **CD (Continuous Delivery)** | Code always deployable; production deploy requires manual approval |
| **CD (Continuous Deployment)** | Every passing commit is automatically deployed to production |
| **GitHub Actions** | GitHub's built-in CI/CD platform |
| **AWS CodePipeline** | AWS-native CI/CD orchestrator (Source → Build → Test → Deploy) |
| **AWS CodeBuild** | AWS managed build service (configured via `buildspec.yml`) |
| **AWS CodeDeploy** | AWS deployment service supporting all-at-once, rolling, and blue/green |
| **ECR** | Amazon Elastic Container Registry — private Docker image storage |
| **ECS Fargate** | AWS serverless container service — define tasks, AWS manages servers |
| **ALB** | Application Load Balancer — distributes traffic, provides a stable URL |
| **Elastic Beanstalk** | AWS PaaS — deploy code without managing EC2 instances directly |
| **CloudFormation** | AWS Infrastructure as Code — define resources in JSON/YAML templates |
| **AWS SAM** | Simplified CloudFormation syntax for serverless applications |
| **Stack** | A CloudFormation unit of deployment — all resources created/deleted together |
| **Blue/Green Deploy** | Deploy to new fleet, switch traffic, instant rollback capability |
| **Rolling Deploy** | Deploy batch-by-batch, keeping capacity during the transition |
| **GitHub Secrets** | Encrypted environment variables accessible in workflows |
| **buildspec.yml** | CodeBuild configuration file defining install, test, and build phases |
