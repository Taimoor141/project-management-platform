# ProjectFlow

ProjectFlow is a full-stack project management and collaboration platform inspired by Linear, Jira, and Asana. It is designed as a production-quality portfolio project emphasizing clean architecture, role-based access control, secure authentication, and maintainable engineering practices.

## Overview

- Multi-organization workspaces
- Project-based task management
- Role-based permissions for owners, admins, and members
- Activity and audit logging
- Notifications and assignment tracking
- Dashboard analytics and workflow insights
- PostgreSQL-first data model with Prisma
- Dockerized local development environment

## Features

- Authentication: admin-provisioned accounts, organization-code sign-in, sign out, session management
- Organization management: create orgs, invite members, change roles, remove members
- Project management: create, edit, archive, and delete projects with admin approval for member submissions
- Task workflow: create, edit, assign, filter, label, prioritize, and track task status with admin approval for member submissions
- Dashboard: recent activity, user workload, overdue items, project metrics
- Security: protected routes, server-side authorization, input validation with Zod
- Testing: Vitest and Playwright for important user flows

## Architecture

The application follows a modular monolith approach:

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui-inspired components
- Backend: Next.js route handlers and server-side services
- Database: PostgreSQL with Prisma ORM
- Authentication: Auth.js session-based auth with secure password hashing
- Cache/background jobs: Redis for rate limiting and async work
- CI: GitHub Actions with lint, test, build, and safety checks

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Redis
- Auth.js
- Vitest
- Playwright
- Docker
- GitHub Actions

## Project structure

```text
src/
  app/
  components/
  lib/
  server/
  styles/
prisma/
  schema.prisma
.github/
  workflows/
Dockerfile
docker-compose.yml
.env.example
README.md
```

## Local development setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
cp .env.example .env
```

Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in `.env` to configure the first workspace owner. Keep these values private. Admins create additional employee and admin accounts from the Team page; users sign in with their credentials and the six-digit organization code.

3. Start PostgreSQL and Redis with Docker Compose:

```bash
docker compose up -d db redis
```

4. Run Prisma generate and apply the current schema:

```bash
npm run db:generate
npm run db:push
```

5. Start the app:

```bash
npm run dev
```

The app will be available at http://localhost:3000.

## Environment variables

See [.env.example](.env.example) for the default local configuration.

## Docker

```bash
docker compose up --build
```

This project includes a local PostgreSQL container and a Redis service intended for development and validation.

## Testing

```bash
npm run test:run
```

The Vitest suite includes database-backed authorization and task workflow tests. Those files are intentionally serialized because they share the local PostgreSQL database during cleanup.

## Current workflow surface

- `/organizations`: list the signed-in user's organizations and create a workspace.
- `/projects`: list active projects across the signed-in user's organizations.
- `/projects/:projectId`: view active tasks and create a prioritized task.
- `/dashboard`: view live project/task metrics, recent activity, and notifications.
- Members can submit projects and tasks, which remain pending until an owner/admin approves or rejects them. Rejections are editable and resubmittable by default; admins can explicitly make a rejection permanent. Owners/admins see the approval queue on `/dashboard`.
- `/api/organizations`, `/api/organizations/:organizationId/projects`, `/api/projects/:projectId/tasks`, `/api/projects/:projectId`, `/api/projects/:projectId/approval`, `/api/tasks/:taskId`, `/api/tasks/:taskId/approval`, and `/api/notifications`: authenticated JSON endpoints for these workflows.

For Playwright:

```bash
npx playwright install --with-deps
npx playwright test
```

## Production build

```bash
npm run build
```

## Deployment notes

- Use managed PostgreSQL in production.
- Use managed Redis or a hosted Redis provider.
- Store secrets in environment variables or secret management services.
- Run Prisma migrations as part of the deployment pipeline.
- Enable HTTPS and secure cookies at the deployment layer.

## Roadmap

- Authentication and protected routing
- Organization and project management
- Tasks, comments, notifications, activity logs
- Dashboard analytics and filters
- Attachments and background jobs
- Security hardening and final QA

## Known limitations

- This is an early milestone foundation and does not yet include all end-user product flows.
- Local Docker and Postgres services are intended for development work.
- Production readiness tasks such as S3 storage, rate limiting, and audit review are planned for implementation milestones.

## Future improvements

- OAuth providers
- Real-time collaboration
- Advanced search and analytics
- Email notifications and background worker processing
- Attachment object storage
- Fine-grained role permissions and policy auditing
