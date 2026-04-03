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

## Part 2: Manual Deploy to AWS (~25 min)

**Goal:** Deploy the app to AWS by hand — create the infrastructure, build and push the Docker image, and verify the app runs in the cloud. You'll automate this in Part 3.

> **Why manual first?** Deploying manually before automating teaches you what the pipeline actually does. If the automated pipeline fails later, you'll know which step broke because you've done each one yourself.

### Background: AWS Container Services

AWS offers several ways to run containers:

| Service | What it manages | Best for |
|---------|----------------|----------|
| **ECS Fargate** | You define tasks; AWS manages servers | Production containers without managing EC2 |
| **ECS on EC2** | You manage the EC2 instances | Full control over compute |
| **Elastic Beanstalk** | Everything (EC2, ALB, ASG) | Quick deploys from source code |
| **EKS (Kubernetes)** | Kubernetes control plane | Teams already using Kubernetes |

We use **ECS Fargate** — you define what container to run (image, CPU, memory, env vars) and AWS handles the underlying compute.

### Step 1 — Log into the AWS Console

1. Log into the [AWS Management Console](https://console.aws.amazon.com/)
2. Pick a region (e.g. **us-east-1** or **us-east-2**) and **use the same region for everything** in this exercise
3. Note your **AWS Account ID** (top right corner → click your username)

### Step 2 — Create an ECR Repository

Amazon Elastic Container Registry (ECR) is a private Docker registry — like Docker Hub, but in your AWS account.

1. In the AWS Console, search for **ECR** and open it
2. Click **Create repository**
3. Settings:
   - **Visibility:** Private
   - **Repository name:** `todo-app`
4. Click **Create repository**
5. Note the **URI** — it looks like: `123456789012.dkr.ecr.us-east-2.amazonaws.com/todo-app`

### Step 3 — Build and push your Docker image

Make sure the **AWS CLI** is installed and configured:

```bash
aws configure
```

Enter your access key, secret key, region, and `json` for output format.

Now build and push (replace the account ID and region with your own):

```bash
# Log Docker into ECR
aws ecr get-login-password --region YOUR_REGION \
  | docker login --username AWS --password-stdin \
    YOUR_ACCOUNT_ID.dkr.ecr.YOUR_REGION.amazonaws.com

# Build for linux/amd64 (ECS Fargate runs x86_64, even if your laptop is ARM/Apple Silicon)
docker buildx build --platform linux/amd64 \
  -t YOUR_ACCOUNT_ID.dkr.ecr.YOUR_REGION.amazonaws.com/todo-app:latest \
  --push ./react-nextjs-mongo
```

> **Important:** The `--platform linux/amd64` flag is required if you're on an Apple Silicon Mac (M1/M2/M3). Without it, you'll get a "image manifest does not contain descriptor matching platform" error when ECS tries to run your container.

Verify the image appears in the AWS Console under **ECR** → **Repositories** → **todo-app** → **Images**.

### Step 4 — Create the ECS infrastructure

You can create the ECS cluster, task definition, and service through the AWS Console:

#### 4a. Create an ECS Cluster

1. In the AWS Console, search for **ECS** and open it
2. Click **Create cluster**
3. **Cluster name:** `todo-app`
4. **Infrastructure:** select **AWS Fargate** (serverless)
5. Click **Create**

#### 4b. Create a Task Definition

1. Go to **Task definitions** → **Create new task definition**
2. **Task definition family:** `todo-app`
3. **Launch type:** Fargate
4. **CPU:** 0.25 vCPU, **Memory:** 0.5 GB
5. **Container definitions** → click **Add container**:
   - **Name:** `todo-app`
   - **Image URI:** `YOUR_ACCOUNT_ID.dkr.ecr.YOUR_REGION.amazonaws.com/todo-app:latest`
   - **Port mappings:** Container port `3003`, Protocol `TCP`
   - **Environment variables:**
     - `MONGODB_URI` = your Atlas connection string
     - `NODE_ENV` = `production`
6. Click **Create**

#### 4c. Create a Service

1. Go to **Clusters** → **todo-app** → **Services** tab → **Create**
2. **Launch type:** Fargate
3. **Task definition:** select `todo-app` (latest revision)
4. **Service name:** `todo-app`
5. **Desired tasks:** 1
6. **Networking:**
   - Select your default VPC
   - Select at least 2 subnets in different AZs
   - **Security group:** Create a new one allowing inbound TCP port `3003` from anywhere (0.0.0.0/0)
   - **Public IP:** Turn ON (Auto-assign public IP)
7. Click **Create**

### Step 5 — Verify the app is running

1. Go to **Clusters** → **todo-app** → **Services** → **todo-app** → **Tasks** tab
2. Click on the running task
3. Find the **Public IP** in the task details
4. Open `http://PUBLIC_IP:3003` in your browser

You should see the todo app! Try registering a user, logging in, and creating a project.

> **Checkpoint:** If the app works at this URL, your container, database connection, and ECS setup are all correct. Everything from here is automation.

> **Troubleshooting:** If the task keeps stopping, click on the task → **Logs** tab to see the container output. Common issues: bad `MONGODB_URI`, wrong port, or the image wasn't built for `linux/amd64`.

### Step 6 — Create an IAM User for GitHub Actions

Now that the manual deploy works, create a dedicated IAM user for the CI/CD pipeline:

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

### Step 7 — Configure deployment settings

The pipeline uses two places for configuration:

**`config/deploy.yml`** — non-secret values you can see and debug. Edit this file to match your AWS setup:

```yaml
aws_region: us-east-2
aws_account_id: "199865934287"
ecr_repository: todo-app
ecs_cluster: todo-app        # must match the cluster name from Step 4a
ecs_service: todo-app        # must match the service name from Step 4c
```

> **Tip:** If you're not sure of the exact names, run:
> ```bash
> aws ecs list-clusters --region us-east-2
> aws ecs list-services --cluster todo-app --region us-east-2
> ```

**GitHub Secrets** — only for actual credentials (things that would be dangerous if leaked):

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each:

| Secret Name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | Access key from Step 6 |
| `AWS_SECRET_ACCESS_KEY` | Secret access key from Step 6 |
| `MONGODB_URI` | Your Atlas connection string |

That's it — just 3 secrets. Everything else is in `config/deploy.yml` where you can see it, commit it, and debug it.

> **Security note:** The AWS credentials are long-lived IAM keys. Treat them like passwords — never commit them to code, share them in chat, or reuse them across projects. In a production environment, you'd replace these with **OIDC federation** so GitHub Actions assumes an IAM Role directly with no stored credentials at all.

---

## Part 3: Automate with GitHub Actions (~15 min)

**Goal:** Now that you've deployed manually and know every step works, automate it. Push to `main` → tests run → image built → pushed to ECR → ECS redeploys.

This is the equivalent of a full **CodePipeline** with Source → Build → Deploy stages, but defined as a GitHub Actions workflow.

### Step 1 — Review the deploy workflow

The deploy workflow is already provided at `.github/workflows/deploy.yml`. Open it and read through the comments — every step is annotated. Notice how each step maps to something you just did manually:

| What you did manually | What the workflow automates |
|---|---|
| `docker buildx build --platform linux/amd64` | `docker build` step (GitHub Actions runners are already x86_64) |
| `aws ecr get-login-password \| docker login` | `aws-actions/amazon-ecr-login` action |
| `docker push` to ECR | `docker push` with SHA + latest tags |
| (Went to ECS console to check) | `aws ecs update-service --force-new-deployment` |

> **Key difference:** On GitHub Actions runners (ubuntu-latest), you don't need `--platform linux/amd64` because the runner is already x86_64. The platform flag is only needed when building on ARM Macs.

### Understanding the workflow — mapping to AWS services

| Pipeline Stage | GitHub Actions Step | AWS-Native Equivalent |
|---------------|--------------------|-----------------------|
| **Source** | `on: push` trigger | CodeConnections (GitHub webhook) |
| **Test** | `test` job (lint + unit tests) | CodeBuild `pre_build` phase |
| **Build** | `docker build` + `docker push` | CodeBuild `build` phase → artifact to S3/ECR |
| **Deploy** | `ecs update-service --force-new-deployment` | CodeDeploy targeting ECS |
| **Orchestration** | `needs: test` (job dependency) | CodePipeline stage ordering |

> **Key insight:** The `needs: test` dependency creates the same gating behavior as CodePipeline: **failed stages block downstream stages**. A failing lint check stops the entire deploy, just as a failed CodeBuild phase halts the CodePipeline. Open `aws-native/pipeline.yml` to see a full CodePipeline CloudFormation template that does the same thing — every stage is annotated with its `deploy.yml` equivalent.

### Step 2 — Trigger the first automated deploy

Push a change to trigger the workflow:

```bash
git add -A
git commit -m "Trigger first automated deploy"
git push
```

### Step 3 — Watch the deployment

1. Go to **Actions** tab — you should see both CI and Deploy workflows running
2. Wait for the deploy job to complete (2-3 minutes for the Docker build)
3. The workflow pushes a new image to ECR, then triggers an ECS rolling deployment
4. Go to the **AWS Console** → **ECS** → **Clusters** → **todo-app** → **Services** to watch the deployment

### Test it:

- [ ] The deploy workflow completed with green checkmarks
- [ ] ECS shows a new deployment in progress or completed
- [ ] The app still works at your public IP / load balancer URL

---

## Part 4: See CI/CD in Action (~10 min)

**Goal:** Make a code change and watch it go from push to production automatically — no manual Docker build, no ECR push, no ECS console.

### Step 1 — Make a visible change

Edit `react-nextjs-mongo/src/app/page.js` and change the welcome message:

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
2. The test job runs first (lint + unit tests)
3. The deploy job builds a new Docker image and pushes it to ECR
4. ECS performs a rolling deployment — new task starts, health checks pass, old task stops

### Step 4 — Verify the deployment

1. Wait 2-3 minutes after the workflow completes
2. Refresh your app URL
3. You should see your updated welcome message

> **Compare to Part 2:** In Part 2, deploying a change required: edit code → `docker buildx build` → `docker push` → go to ECS console. Now it's just: edit code → `git push`. The pipeline does the rest. That's the value of CI/CD.

### Test it:

- [ ] Your code change is visible at the app URL
- [ ] The entire process (push → live) took under 5 minutes
- [ ] You didn't touch the AWS Console

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

## Part 7: Custom Domain Name (Optional)

**Goal:** Point a custom domain (e.g. `todo.yourdomain.com`) at your deployed app instead of using the raw AWS load balancer URL.

Your app is currently accessible via the ALB DNS name — something like:
```
ecs-express-gateway-alb-xxxxxxxx-123456789.us-east-2.elb.amazonaws.com
```

That works, but it's not memorable. Here's how to point a real domain at it.

### Option A: Using Route 53 (AWS DNS)

If your domain is managed in Route 53:

1. Open **Route 53** in the AWS Console → **Hosted zones** → select your domain
2. Click **Create record**
3. Settings:
   - **Record name:** `todo` (this creates `todo.yourdomain.com`)
   - **Record type:** `A`
   - **Alias:** toggle ON
   - **Route traffic to:** "Alias to Application and Classic Load Balancer"
   - **Region:** `us-east-2`
   - **Load balancer:** select your ALB (starts with `ecs-express-gateway-alb-`)
4. Click **Create records**

> **Why Alias instead of CNAME?** Route 53 Alias records are free, work at the zone apex (`yourdomain.com`, not just subdomains), and resolve directly to the ALB's IP addresses. CNAME records add an extra DNS lookup and can't be used at the apex.

### Option B: Using any DNS provider (Cloudflare, Namecheap, GoDaddy, etc.)

If your domain is managed outside AWS:

1. Log into your DNS provider's dashboard
2. Create a **CNAME record**:
   - **Name / Host:** `todo` (for `todo.yourdomain.com`)
   - **Value / Target:** your ALB DNS name (e.g. `ecs-express-gateway-alb-xxxxxxxx-123456789.us-east-2.elb.amazonaws.com`)
   - **TTL:** 300 (5 minutes)
3. Wait for DNS propagation (usually 1-5 minutes, sometimes up to an hour)

### Adding HTTPS with a free SSL certificate

The ALB currently serves HTTP only (port 80). To add HTTPS:

1. **Request a certificate** in **AWS Certificate Manager (ACM)**:
   - Open ACM in the AWS Console (**make sure you're in the same region as your ALB**)
   - Click **Request a certificate** → **Public certificate**
   - **Domain name:** `todo.yourdomain.com`
   - **Validation method:** DNS validation
   - ACM gives you a CNAME record to add to your DNS — add it and wait for validation

2. **Add an HTTPS listener to the ALB:**
   - Open **EC2** → **Load Balancers** → select your ALB
   - **Listeners** tab → **Add listener**
   - **Protocol:** HTTPS, **Port:** 443
   - **Default action:** Forward to your existing target group
   - **Certificate:** select the ACM certificate you just created

3. **Redirect HTTP to HTTPS** (optional but recommended):
   - Edit the existing HTTP:80 listener
   - Change the default action to **Redirect** → HTTPS, port 443

Your app is now accessible at `https://todo.yourdomain.com` with a free, auto-renewing SSL certificate.

> **In production:** HTTPS is not optional. Browsers increasingly block or warn about HTTP-only sites, and any site handling passwords (like your login page) must use HTTPS to prevent credential interception.

---

## Part 8: Stretch Goals (Optional)

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

## Troubleshooting

### Manual deploy (Part 2)

- **ECR push 403 Forbidden:** Your Docker login expired. Re-run `aws ecr get-login-password ... | docker login ...` before pushing.
- **ECS "image manifest does not contain descriptor matching platform linux/amd64":** You built on an ARM Mac without `--platform linux/amd64`. Rebuild with: `docker buildx build --platform linux/amd64 -t YOUR_ECR_URI --push ./react-nextjs-mongo`
- **ECS task keeps stopping:** Go to ECS → Clusters → todo-app → Tasks → click the stopped task → **Logs** tab. Common causes: bad `MONGODB_URI`, wrong port, or missing `NODE_ENV=production`.
- **MongoDB connection errors:** Verify your Atlas Network Access allows `0.0.0.0/0` and the connection string has the correct password and database name.
- **Can't reach the app via public IP:** Check the security group on your ECS service allows inbound TCP on port `3003` from `0.0.0.0/0`.

### GitHub Actions (Part 3)

- **AWS credentials not working:** Verify the IAM user `github-actions-deployer` has `AmazonEC2ContainerRegistryPowerUser` and `AmazonECS_FullAccess` policies. Double-check the access key in your GitHub Secrets.
- **ECR push denied:** Verify `AWS_ACCOUNT_ID` is correct (12 digits, no dashes) and `AWS_REGION` matches where your ECR repo was created.
- **ECS ClusterNotFoundException:** The `ECS_CLUSTER` secret doesn't match an actual cluster. Run `aws ecs list-clusters --region YOUR_REGION` to check.
- **Workflow doesn't trigger:** Make sure the workflow file is in `.github/workflows/` (not `github/` — note the leading dot) and pushed to `main`.
- **Docker build fails in Actions:** GitHub Actions runners are x86_64 so no `--platform` flag is needed. Check that the Dockerfile path (`./react-nextjs-mongo`) is correct.

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
