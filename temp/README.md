# Lab 7: Testing — Writing Tests for a JavaScript Application

In this lab you will practice **writing tests** across three testing layers: unit tests, integration tests, and end-to-end (E2E) tests. You will work with a Node.js/Express JWT authentication app that is **already fully implemented**. Your job is to **write tests** that verify the application behaves correctly according to its specifications.

---

## Background: Testing Layers

| Layer | Tool | What It Tests | Speed |
|-------|------|---------------|-------|
| **Unit** | Jest | Individual functions in isolation | Fast (ms) |
| **Integration** | Jest + Supertest | API routes and middleware together | Medium (ms-s) |
| **End-to-End** | Playwright | Full UI in a real browser | Slower (s) |

---

## Setup

### Option 1: GitHub Codespaces (recommended)

Click **Code → Codespaces → New** to launch a Codespace. Once the environment is ready, open a terminal and install dependencies:

```bash
npm install
```

> Playwright browsers are installed automatically when the Codespace is created. If E2E tests fail with a browser-not-found error, run:
> ```bash
> npx playwright install --with-deps chromium
> ```
> The `--with-deps` flag is required in Codespaces to install system libraries (libgbm, libasound, etc.) that Chromium needs in a Linux container.

### Option 2: Local

```bash
npm install
npx playwright install chromium
```

---

## Getting Oriented

Before starting the homework, explore the existing app and tests to understand what you're working with.

### Start the server

```bash
node server.js
```

Visit [http://localhost:3000](http://localhost:3000) and try the full flow: register a user, log in, click "Get Secret Message", then log out. Stop the server with `Ctrl+C`.

### Run the existing tests

```bash
npm run test:all
```

You should see all **31 tests pass** (14 unit + 12 integration + 5 E2E). This includes the provided example tests in the homework files.

### Study the existing test files

Before writing your own tests, **read these files carefully** — they are your examples:

- `tests/unit/utils.test.js` — shows how to write Jest unit tests
- `tests/integration/api.test.js` — shows how to write Supertest integration tests
- `tests/e2e/auth.spec.js` — shows how to write Playwright E2E tests

### Understand the project structure

```
├── server.js                   # Express app with JWT auth
├── utils.js                    # Pure utility functions
├── public/index.html           # React frontend
├── package.json
├── playwright.config.js
└── tests/
    ├── unit/
    │   ├── utils.test.js       # Existing unit tests (read as examples)
    │   └── homework.test.js    # ★ YOUR unit tests go here
    ├── integration/
    │   ├── api.test.js         # Existing integration tests (read as examples)
    │   └── homework.test.js    # ★ YOUR integration tests go here
    └── e2e/
        ├── auth.spec.js        # Existing E2E tests (read as examples)
        └── homework.spec.js    # ★ YOUR E2E tests go here
```

### Test commands

```bash
npm test                    # Unit + integration tests (Jest)
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # E2E tests (Playwright)
npm run test:all            # Everything
```

---

## Part 1: Unit Tests — Test Two Utility Functions (34 pts)

**Goal:** Write unit tests for two utility functions in `utils.js`. The functions are already implemented — you just need to write tests that verify they work correctly.

### The functions you are testing (in `utils.js`):

#### `sanitizeUsername(username)`

Cleans a raw username string:
- Trim leading/trailing whitespace
- Convert to lowercase
- Remove any characters that are NOT letters, numbers, or underscores
- Return `null` if the input is `null`, `undefined`, or not a string
- Return `null` if the result is an empty string after sanitization

#### `calculatePasswordStrength(password)`

Evaluates a password and returns an object `{ score, label }`:
- **Scoring** (each criterion is worth 1 point, maximum score is 4):
  - Length >= 8 characters
  - Mixed case (contains BOTH uppercase AND lowercase letters)
  - Contains at least one digit
  - Contains at least one special character (e.g., `!@#$%^&*`)
- **Labels** based on score:
  - 0 or 1 → `"weak"`
  - 2 → `"fair"`
  - 3 → `"strong"`
  - 4 → `"very strong"`
- Return `{ score: 0, label: 'weak' }` for `null`, `undefined`, non-string, or empty input

### Steps

1. **Study** the existing tests in `tests/unit/utils.test.js` for patterns
2. **Read** the function implementations in `utils.js` and the specifications above
3. **Write tests** in `tests/unit/homework.test.js` — add at least 5 tests per function (10+ total) covering normal cases, edge cases, and invalid inputs. One example test is provided per function.
4. **Run** `npm run test:unit` — all your tests should pass

### Deliverable

- At least 12 passing tests in `homework.test.js` (2 provided + 10 you write)

---

## Part 2: Integration Tests — Test Two API Endpoints (33 pts)

**Goal:** Write integration tests for two API endpoints in `server.js`. The endpoints are already implemented — you just need to write tests that verify they work correctly.

### The endpoints you are testing (in `server.js`):

#### `GET /api/profile`

Returns the logged-in user's profile:
- Requires a valid JWT (uses the `authenticateToken` middleware)
- Returns `200` with `{ username: <from JWT>, message: 'Profile data' }`
- Returns `401` without a token
- Returns `403` with an invalid token

#### `POST /api/change-password`

Allows a logged-in user to change their password:
- Requires a valid JWT
- Accepts JSON body: `{ currentPassword, newPassword }`
- Verifies the current password against the stored hash
- Validates new password is at least 6 characters
- Hashes and stores the new password
- Returns `200` with `{ message: 'Password changed successfully' }`
- Error cases: `401` (no token or wrong password), `400` (missing fields or new password too short)

### Steps

1. **Study** the existing tests in `tests/integration/api.test.js` for patterns
2. **Write tests** in `tests/integration/homework.test.js` — add at least 2 tests for `/api/profile` and 4 tests for `/api/change-password`. One example test is provided per endpoint.
3. **Run** `npm run test:integration` — all your tests should pass

**Hints:**
- Look at how `tests/integration/api.test.js` tests the `GET /api/secret` endpoint — it shows how to send authenticated requests with `.set('Authorization', ...)` and how to test 401/403 responses
- Test both success and error cases (missing token, invalid token, wrong password, missing fields, etc.)

### Deliverable

- At least 8 passing tests in `homework.test.js` (2 provided + 6 you write)

---

## Part 3: E2E Tests — Test the Application in a Browser (33 pts)

**Goal:** Write Playwright E2E tests that verify the application works from a user's perspective. All features are already implemented — you just need to write tests.

### Part A — Test Existing Behavior (at least 3 tests)

Explore the app in a browser, then write at least 3 Playwright tests in the `Part A` describe block of `tests/e2e/homework.spec.js`. Your tests should verify meaningful behavior that already works in the app.

Study `tests/e2e/auth.spec.js` for Playwright patterns (locators, assertions, form interaction).

### Part B — Test the Password Strength Indicator (at least 2 tests)

The registration form includes a **password strength indicator**. When a user types in the registration password field:
- A `<div class="password-strength">` appears below the input
- It displays `"Strength: weak"`, `"Strength: fair"`, `"Strength: strong"`, or `"Strength: very strong"`
- It has a `data-score` attribute (`"0"` through `"4"`) matching the numeric score
- Scoring: +1 for length >= 8, +1 for mixed case, +1 for digit, +1 for special character

Write at least 2 tests in the `Part B` describe block that verify this feature works correctly.

### Steps

1. **Explore** the app in a browser (`node server.js`, visit localhost:3000)
2. **Write** at least 3 Part A tests and at least 2 Part B tests in `tests/e2e/homework.spec.js`
3. **Run** `npm run test:e2e` — all tests should pass

### Deliverable

- At least 3 passing Part A tests + at least 2 passing Part B tests

---

## Submission Checklist

Run the full test suite one final time:

```bash
npm run test:all
```

**Expected results:**

| Component | Tests |
|-----------|-------|
| Unit — your tests | 12+ passing |
| Integration — your tests | 8+ passing |
| E2E — your tests | 5+ passing |
| Existing + example tests | 31 passing (unchanged) |

### Files you should have modified:

- `tests/unit/homework.test.js` — wrote unit tests
- `tests/integration/homework.test.js` — wrote integration tests
- `tests/e2e/homework.spec.js` — wrote E2E tests

### Commit and push your work:

```bash
git add -A
git commit -m "Lab 7: Testing homework complete"
git push
```

---

## Grading

| Part | Points | Criteria |
|------|--------|----------|
| Part 1: Unit tests | 34 | 12+ tests in homework.test.js pass |
| Part 2: Integration tests | 33 | 8+ tests in homework.test.js pass |
| Part 3: E2E — Part A (existing behavior) | 17 | 3+ Part A tests pass |
| Part 3: E2E — Part B (password strength) | 16 | 2+ Part B tests pass |
| **Total** | **100** | |
