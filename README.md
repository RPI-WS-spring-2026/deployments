# Lab 8: CI/CD Deployment — From Push to Production

In the previous labs you built authentication (Lab 6) and testing (Lab 7). Now you'll close the loop by setting up a **CI/CD pipeline** that automatically tests, builds, and deploys the todo app to AWS every time you push code.

**Time:** ~1.5 hours
**Prerequisites:** Completed Lab 6 (authentication working), Docker Desktop installed, AWS Academy Learner Lab access
**Stack:** Next.js 14 + MongoDB Atlas + GitHub Actions + Amazon ECR + AWS App Runner

---

## What You'll Learn

- The **deployment problem** and why CI/CD exists
- The difference between **Continuous Integration**, **Continuous Delivery**, and **Continuous Deployment**
- How to create a **GitHub Actions** CI workflow that runs tests on every push
- How the **testing pyramid** from Lab 7 maps to CI/CD pipeline stages
- How to build and push **Docker images** to Amazon Elastic Container Registry (ECR)
- How to deploy a containerized app to **AWS App Runner** (managed container hosting)
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
  │  Unit Tests  │  Many, fast       Deploy to App Runner ──▶ Ship to production
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

In this lab, your `docker compose` setup is **development** and App Runner is **production**. The stretch goals add a staging environment.

---

## Architecture Overview

```
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌─────────────┐
│  GitHub  │────▶│GitHub Actions│────▶│Amazon ECR│────▶│ AWS App     │
│   Push   │     │  (CI/CD)     │     │ (Images) │     │ Runner      │
└─────────┘     └──────────────┘     └──────────┘     └─────────────┘
                  │ 1. Lint                              │
                  │ 2. Build Docker                      │ Runs your
                  │ 3. Push to ECR                       │ container
                  │ 4. Trigger deploy                    │
                                                         │
                                                    ┌────▼────────┐
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
| App Runner `start-deployment` | **CodeDeploy** | Deploy to compute |
| CloudFormation template | **CloudFormation** | Infrastructure as Code |

> **Why GitHub Actions instead of CodePipeline?** You already use GitHub daily. GitHub Actions is the industry standard for GitHub-hosted projects, has a lower learning curve, and 2,000 free minutes/month. Understanding both prepares you for industry — see the comparison table in Part 6.

---

## Getting Started

### 1. Accept the assignment and clone

1. Accept the GitHub Classroom assignment using the link provided by your instructor
2. Clone **your** assignment repository:

```bash
git clone https://github.com/RPI-WS-spring-2026/deployment-lab8-yourusername.git
cd deployment-lab8-yourusername
```

### 2. Verify the app runs locally

Make sure Docker Desktop is running, then:

```bash
docker compose up --build
```

This starts:
- **app** — the Next.js todo app on [http://localhost:3003](http://localhost:3003)
- **mongo** — MongoDB on port 27017

Open [http://localhost:3003](http://localhost:3003) and verify you can register, login, create projects, and add tasks. Press `Ctrl+C` to stop when done.

> **Note:** The app in this repo already has Lab 6 authentication completed. You're building on top of a working application.

---

## Part 1: Create a GitHub Actions CI Workflow (~15 min)

**Goal:** Implement **Continuous Integration** — automatically lint and build on every push.

### Background: What is GitHub Actions?

GitHub Actions is a CI/CD platform built into GitHub. You define **workflows** in YAML files inside `.github/workflows/`. Each workflow consists of **jobs**, and each job consists of **steps**. Workflows are triggered by **events** like `push`, `pull_request`, or `schedule`.

This is analogous to AWS **CodePipeline** + **CodeBuild**: CodePipeline orchestrates the stages, CodeBuild runs the actual commands. In GitHub Actions, the workflow file does both.

### Step 1 — Create the workflow file

Create the file `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install
        working-directory: ./react-nextjs-mongo

      - name: Run linter
        run: npm run lint
        working-directory: ./react-nextjs-mongo

  build:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t todo-app ./react-nextjs-mongo
```

> **Compare to AWS CodeBuild:** In the AWS-native approach, you'd put the `npm install`, `npm run lint`, and `docker build` commands in a `buildspec.yml` file with `install`, `pre_build`, and `build` phases. GitHub Actions uses step-level YAML instead.

### Step 2 — Commit and push

```bash
git add .github/workflows/ci.yml
git commit -m "Add CI workflow with lint and Docker build"
git push
```

### Step 3 — Watch it run

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. You should see your "CI" workflow running
4. Click into it to watch the steps execute in real time

> **Key concept:** This is **Continuous Integration** — every push is automatically validated. The `needs: test` line means the `build` job only runs if `test` passes. If linting fails, the Docker image is never built. This is the same gating principle that CodePipeline uses: **failed stages block downstream stages**.

### Test it:

Verify in the Actions tab that:
- [ ] The workflow triggered on your push
- [ ] The `test` job ran the linter
- [ ] The `build` job built the Docker image
- [ ] Both jobs show green checkmarks

---

## Part 2: Set Up MongoDB Atlas (~10 min)

**Goal:** Create a cloud database for your deployed app.

Your local app uses a MongoDB container (the **development** environment). Your deployed app needs a database accessible from AWS (the **production** environment). MongoDB Atlas provides a free cloud-hosted MongoDB instance.

### Step 1 — Create a MongoDB Atlas account

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and sign up (free)
2. Create a new **Shared Cluster** (the free M0 tier)
3. Choose **AWS** as the cloud provider and pick **us-east-1** as the region

### Step 2 — Configure access

1. Go to **Database Access** → **Add New Database User**
   - Username: `todoapp`
   - Password: generate a secure password and **save it**
   - Role: "Read and Write to Any Database"

2. Go to **Network Access** → **Add IP Address**
   - Click **Allow Access from Anywhere** (0.0.0.0/0)
   - This is required for AWS App Runner to connect

### Step 3 — Get your connection string

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

> **Important:** Never commit this connection string to your repository. You'll store it as a GitHub Secret and an AWS environment variable. In a production AWS setup, you'd use **AWS Secrets Manager** or **Parameter Store** to manage secrets — CodeBuild can inject them as environment variables during the build phase.

### Step 4 — Update the app to use an environment variable

Open `react-nextjs-mongo/src/lib/db.js` and check that it reads from an environment variable. If it has a hardcoded `mongodb://mongo:27017/...` URI, update it:

```js
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/todoapp';
```

This way the app uses the local MongoDB in **development** and the Atlas URI in **production** — same code, different configuration per environment.

### Test it:

Run the app locally and verify it still works with Docker Compose (it should fall back to the local `mongo` container).

---

## Part 3: Set Up AWS Infrastructure (~15 min)

**Goal:** Create an ECR repository and an App Runner service.

### Background: AWS App Runner vs Elastic Beanstalk

In the lecture you learned about **Elastic Beanstalk** — a Platform-as-a-Service that auto-provisions EC2 instances, load balancers, and auto-scaling. **App Runner** is similar but even simpler: it's purpose-built for containers and requires zero infrastructure configuration.

| Feature | Elastic Beanstalk | App Runner |
|---------|-------------------|------------|
| Input | Source code or Docker image | Docker image (or source code) |
| Manages | EC2, ALB, ASG, security groups | Fully abstracted (no EC2 at all) |
| Scaling | Configurable auto-scaling rules | Automatic, no configuration |
| Cost | EC2 instance pricing (pay for uptime) | Pay per request/vCPU-second |
| Best for | Full control over infrastructure | Simplicity, container-first apps |

We use App Runner for this lab because it gets you to a deployed app in minutes — like Elastic Beanstalk but with less configuration overhead.

### Step 1 — Start your AWS Academy Learner Lab

1. Log into your AWS Academy course
2. Start the **Learner Lab**
3. Click **AWS Console** to open the management console
4. Note your **AWS Account ID** (top right corner → click your username)

### Step 2 — Create an ECR Repository

Amazon Elastic Container Registry (ECR) is a private Docker registry — like Docker Hub, but in your AWS account. In the AWS-native pipeline, CodeBuild would push build **artifacts** to S3. Since we're deploying containers, ECR serves the same purpose: it stores the deployable artifact (the Docker image).

1. In the AWS Console, search for **ECR** and open it
2. Click **Create repository**
3. Settings:
   - **Visibility:** Private
   - **Repository name:** `todo-app`
4. Click **Create repository**
5. Note the **URI** — it looks like: `123456789012.dkr.ecr.us-east-1.amazonaws.com/todo-app`

### Step 3 — Create an App Runner Service

1. In the AWS Console, search for **App Runner** and open it
2. Click **Create service**
3. **Source:**
   - Source type: **Container registry**
   - Provider: **Amazon ECR**
   - Container image URI: use the ECR URI from Step 2, with tag `:latest`
     - Example: `123456789012.dkr.ecr.us-east-1.amazonaws.com/todo-app:latest`
   - ECR access role: **Create new service role** (let AWS create it)
4. **Deployment settings:**
   - Deployment trigger: **Automatic**
   - ECR type: **Private**
5. Click **Next**
6. **Service settings:**
   - Service name: `todo-app`
   - Port: `3003`
   - Add environment variable:
     - Key: `MONGODB_URI`
     - Value: your MongoDB Atlas connection string from Part 2
   - Add environment variable:
     - Key: `NODE_ENV`
     - Value: `production`
7. Click **Next** → **Create & deploy**

> **Note:** The first deployment will fail because there's no image in ECR yet — that's expected! The service will automatically deploy once we push an image in Part 4.

> **Deployment strategy:** App Runner uses a **rolling deployment** by default — it starts new instances with the new image, waits for health checks to pass, then stops old instances. This means zero downtime during deploys. Compare this to the **all-at-once**, **rolling**, and **blue/green** strategies from the lecture.

### Step 4 — Get AWS credentials for GitHub Actions

You need AWS credentials so GitHub Actions can push images to ECR.

1. In your AWS Academy Learner Lab, click **AWS Details**
2. Click **Show** next to AWS CLI credentials
3. Copy the `aws_access_key_id`, `aws_secret_access_key`, and `aws_session_token`

> **Important:** Learner Lab credentials rotate every few hours. For a production setup you'd use IAM roles with OIDC — but for this lab, session credentials work fine.

### Step 5 — Add GitHub Secrets

GitHub Secrets store sensitive values that your workflows can access without exposing them in code.

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each:

| Secret Name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | Your access key |
| `AWS_SECRET_ACCESS_KEY` | Your secret key |
| `AWS_SESSION_TOKEN` | Your session token |
| `AWS_ACCOUNT_ID` | Your 12-digit account ID |
| `MONGODB_URI` | Your Atlas connection string |

---

## Part 4: Add the Deploy Workflow (~20 min)

**Goal:** Implement **Continuous Deployment** — push to `main` triggers test → build → push → deploy automatically.

This is the equivalent of a full **CodePipeline** with Source → Build → Deploy stages, but defined as a GitHub Actions workflow.

### Step 1 — Create the deploy workflow

Create the file `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: todo-app
  APP_RUNNER_SERVICE: todo-app

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install
        working-directory: ./react-nextjs-mongo

      - name: Run linter
        run: npm run lint
        working-directory: ./react-nextjs-mongo

  deploy:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-session-token: ${{ secrets.AWS_SESSION_TOKEN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push Docker image to ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG ./react-nextjs-mongo
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Deploy to App Runner
        run: |
          aws apprunner start-deployment \
            --service-arn $(aws apprunner list-services \
              --query "ServiceSummaryList[?ServiceName=='${{ env.APP_RUNNER_SERVICE }}'].ServiceArn" \
              --output text)
```

### Understanding the workflow — mapping to AWS services

| Pipeline Stage | GitHub Actions Step | AWS-Native Equivalent |
|---------------|--------------------|-----------------------|
| **Source** | `on: push` trigger | CodeConnections (GitHub webhook) |
| **Test** | `test` job (lint) | CodeBuild `pre_build` phase |
| **Build** | `docker build` + `docker push` | CodeBuild `build` phase → artifact to S3/ECR |
| **Deploy** | `apprunner start-deployment` | CodeDeploy targeting ECS/Beanstalk |
| **Orchestration** | `needs: test` (job dependency) | CodePipeline stage ordering |

> **Key insight:** The `needs: test` dependency creates the same gating behavior as CodePipeline: **failed stages block downstream stages**. A failing lint check stops the entire deploy, just as a failed CodeBuild phase halts the CodePipeline.

### Step 2 — Commit and push

```bash
git add .github/workflows/deploy.yml
git commit -m "Add deploy workflow: ECR push + App Runner deploy"
git push
```

### Step 3 — Watch the deployment

1. Go to **Actions** tab — you should see both CI and Deploy workflows running
2. Wait for the deploy job to complete (2-3 minutes for the Docker build)
3. Go to the **AWS Console** → **App Runner** → your service
4. Wait for the status to change to **Running** (first deploy takes 3-5 minutes)
5. Click the **Default domain** URL — your app should be live!

### Test it:

- [ ] Open your App Runner URL in a browser
- [ ] Register a new user
- [ ] Create a project and add tasks
- [ ] Data persists (it's stored in MongoDB Atlas)

---

## Part 5: See CI/CD in Action (~10 min)

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
4. App Runner automatically pulls the new image and redeploys (rolling deployment — zero downtime)

### Step 4 — Verify the deployment

1. Wait 2-3 minutes after the workflow completes
2. Refresh your App Runner URL
3. You should see your updated welcome message

> **This is Continuous Deployment in action:** You pushed code, and it was automatically tested, built, containerized, and deployed — without touching the AWS Console. In an AWS-native setup, CodePipeline would show each stage transitioning from blue (in progress) to green (succeeded).

### Test it:

- [ ] Your code change is visible at the App Runner URL
- [ ] The entire process (push → live) took under 5 minutes
- [ ] Both workflow runs show in the Actions tab

---

## Part 6: Infrastructure as Code & AWS Comparison (~15 min)

**Goal:** Understand Infrastructure as Code and how GitHub Actions compares to AWS-native CI/CD.

### 6a. Infrastructure as Code with CloudFormation

In Parts 3-4 you created AWS resources (ECR, App Runner) by clicking through the Console. This is like manually configuring a server — it works once but isn't reproducible, version-controlled, or reviewable.

**CloudFormation** solves this by letting you define your infrastructure in a template file:

- **Reproducible** — spin up identical dev, staging, and prod environments from the same template
- **Version controlled** — infrastructure changes go through code review like application code
- **Self-documenting** — the template IS the architecture diagram
- **Rollback support** — CloudFormation can revert a stack to its previous state
- **No snowflake servers** — destroy and recreate instead of patching in-place

### Step 1 — Read the CloudFormation template

Open `cloudformation/infrastructure.yml` in your repository. This template creates the same resources you built manually:

- An ECR repository
- An IAM role for App Runner to access ECR
- An App Runner service configured to pull from that ECR repository

Notice how the template uses:
- **Parameters** — like function arguments (App name, port, MongoDB URI)
- **Resources** — the AWS resources to create (the only *required* section)
- **`!Sub`** — string substitution that inserts your account ID and region
- **`!Ref`** and **`!GetAtt`** — references between resources

> **Compare to AWS SAM:** For serverless apps (Lambda + API Gateway + DynamoDB), **AWS SAM** provides simplified syntax. One SAM resource definition can expand to 50+ lines of CloudFormation. SAM is to CloudFormation what React is to vanilla DOM manipulation.

### Step 2 — Answer these questions

Add your answers as YAML comments at the bottom of `cloudformation/infrastructure.yml`:

1. What does the `Resources` section define?
2. What is the `!Sub` function doing in the `ImageIdentifier` property?
3. If you deleted this CloudFormation stack, what would happen to your App Runner service and ECR repository?
4. What is one advantage of defining infrastructure in a template file vs. clicking through the Console?

### 6b. GitHub Actions vs AWS CodePipeline

You built your pipeline with GitHub Actions. Here's how it compares to the AWS-native approach from the lecture:

| Feature | GitHub Actions | AWS CodePipeline |
|---------|---------------|-----------------|
| **Trigger** | `git push`, PR, schedule | Git push, webhook, manual |
| **Build runner** | GitHub-hosted or self-hosted | CodeBuild (managed containers) |
| **Config format** | YAML in `.github/workflows/` | Console, YAML, or CDK |
| **Config file for builds** | Steps in workflow YAML | `buildspec.yml` (separate file) |
| **AWS integration** | Requires IAM credentials/OIDC setup | Native — no extra config |
| **Cost** | 2,000 min/mo free, then pay | Pay per pipeline execution |
| **Deployment strategies** | Custom (you implement) | Built-in all-at-once, rolling, blue/green |
| **Best for** | Open source, GitHub-centric teams | AWS-native production apps |
| **Learning curve** | Easier, more community tutorials | Steeper but more enterprise features |

### Step 3 — Answer this question

Add a file `COMPARISON.md` to the root of your repository answering:

**If you were deploying a production application for a company that uses AWS exclusively, would you choose GitHub Actions or AWS CodePipeline? Give at least two reasons.**

---

## Part 7: Deployment Strategies (~5 min, reading + questions)

**Goal:** Understand how production deployments handle the transition from old code to new code.

When App Runner deploys your new image, it doesn't just stop the old version and start the new one. There are several strategies:

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

> **App Runner uses rolling deployment** by default. AWS CodeDeploy supports all three strategies, and also supports **traffic shifting** for Lambda (e.g., route 10% of traffic to the new version, then gradually increase).

### Answer this question

Add to your `COMPARISON.md`:

**Your todo app is now serving 10,000 users. You need to deploy a database schema change that is NOT backward-compatible. Which deployment strategy would you use and why?**

---

## Part 8: Stretch Goals (Optional)

### Stretch 1: Add a staging environment

Create a second App Runner service called `todo-app-staging` with its own MongoDB Atlas database. Modify your deploy workflow to:
- Deploy to **staging** on every push to `main`
- Deploy to **production** only when a GitHub Release is published (use `on: release` trigger)

This mirrors the Dev → Staging → Production environment progression from the lecture.

### Stretch 2: Add a health check endpoint

1. Create `react-nextjs-mongo/src/app/api/health/route.js` that returns `{ status: "ok", timestamp: ... }`
2. Configure App Runner to use `/api/health` as its health check path
3. Add a step in your deploy workflow that waits for the health check to pass after deploy

> This is how production systems verify a deploy succeeded — **CloudWatch** would monitor this endpoint and trigger alarms if it starts failing.

### Stretch 3: Create a buildspec.yml

As an exercise, create a `buildspec.yml` file that would do the same thing as your GitHub Actions workflow but for AWS CodeBuild:

```yaml
version: 0.2
phases:
  install:
    commands:
      - # What goes here?
  pre_build:
    commands:
      - # What goes here?
  build:
    commands:
      - # What goes here?
```

### Discussion Questions

1. **What is the difference between Continuous Integration, Continuous Delivery, and Continuous Deployment?** Which one did you implement in this lab?

2. **How does the testing pyramid from Lab 7 connect to the CI/CD pipeline?** Why do we run the linter (fastest check) first?

3. **Why do we tag images with both the commit SHA and `latest`?** When would you use the SHA tag to rollback?

4. **What are the security implications of storing AWS credentials as GitHub Secrets?** How does OIDC improve on this? How does AWS Secrets Manager/Parameter Store compare?

5. **Compare GitHub Actions to AWS CodePipeline + CodeBuild + CodeDeploy.** When would you choose each?

6. **Why is "works on my machine" a deployment problem, and how does Docker solve it?** How does Infrastructure as Code (CloudFormation) extend this idea to the infrastructure layer?

7. **Explain the blue/green deployment strategy.** Why is it recommended for production? What's the tradeoff?

---

## Submitting Your Work

Commit and push all your changes:

```bash
git add -A
git commit -m "Lab 8: CI/CD deployment pipeline complete"
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
7. Deploy workflow includes App Runner deployment step
8. CloudFormation template exists with answers to questions
9. The `MONGODB_URI` environment variable is used in `db.js` (not hardcoded)
10. The Dockerfile builds successfully
11. `COMPARISON.md` exists with deployment strategy and tooling answers

**To check your results:** Go to the **Actions** tab. A green check means all grading checks passed.

---

## Troubleshooting

- **AWS credentials expired:** Learner Lab credentials rotate. Get fresh ones from AWS Details and update your GitHub Secrets.
- **ECR push denied:** Verify your `AWS_ACCOUNT_ID` secret is correct (12 digits, no dashes).
- **App Runner stays "Operation in progress":** First deploys take 3-5 minutes. Check the App Runner logs in the AWS Console for errors.
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
| **App Runner** | AWS managed container service with auto-scaling + HTTPS |
| **Elastic Beanstalk** | AWS PaaS — deploy code without managing EC2 instances directly |
| **CloudFormation** | AWS Infrastructure as Code — define resources in JSON/YAML templates |
| **AWS SAM** | Simplified CloudFormation syntax for serverless applications |
| **Stack** | A CloudFormation unit of deployment — all resources created/deleted together |
| **Blue/Green Deploy** | Deploy to new fleet, switch traffic, instant rollback capability |
| **Rolling Deploy** | Deploy batch-by-batch, keeping capacity during the transition |
| **GitHub Secrets** | Encrypted environment variables accessible in workflows |
| **buildspec.yml** | CodeBuild configuration file defining install, test, and build phases |
