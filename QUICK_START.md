# GymTech - Quick Start Guide

## Current Status (2026-09-14)

**Development Phase:** ~70% Complete - Near MVP  
**Modified Files:** 11 files with pending changes  
**Critical Path:** 13 working days to production

---

## Immediate Next Steps

### Step 1: Review Modified Files (Today)
We have 11 files with uncommitted changes that need review:

```bash
# View all changes
git diff

# Or review by file
git diff apps/api/src/middleware/auth.ts
git diff apps/api/src/routes/auth.routes.ts
git diff apps/web/src/pages/LoginPage.tsx
# ... etc
```

**Key Changes:**
- ✅ Fixed TypeScript import error in NewMemberPage.tsx
- ⚠️ Auth middleware now requires platform admins to specify `?gymId=`
- ⚠️ Set-Cookie header formatting fixed
- ⚠️ User repository search logic simplified (may need restoration)
- ⚠️ Member repository search refactored (incomplete)

### Step 2: Test Critical Flows (Today)
Before committing, manually test:

1. **Authentication Flow**
   ```bash
   # Start dev environment
   pnpm dev
   
   # Test in browser:
   # - Login as gym staff
   # - Login as platform admin
   # - Token refresh
   # - Logout
   # - CSRF protection
   ```

2. **Member Management**
   - Create new member
   - Search members
   - Filter by status
   - Edit member

3. **Staff Management**
   - View staff list
   - Create staff user
   - Edit roles

### Step 3: Commit Strategy
```bash
# Option A: Commit all changes together
git add .
git commit -m "fix(auth/members/staff): improve platform admin auth, fix Set-Cookie, refactor search

- Require explicit gymId for platform admin access
- Fix Set-Cookie header formatting (join with comma)
- Simplify auth service token refresh
- Refactor member repository search logic
- Update staff page UI layout
- Fix TypeScript import paths

Co-Authored-By: Claude Code <noreply@anthropic.com>"

# Option B: Commit by feature (recommended)
git add apps/api/src/middleware/auth.ts apps/api/src/routes/auth.routes.ts apps/api/src/services/auth.service.ts
git commit -m "fix(auth): require explicit gymId for platform admins and fix Set-Cookie formatting

Co-Authored-By: Claude Code <noreply@anthropic.com>"

git add apps/web/src/pages/LoginPage.tsx
git commit -m "fix(login): remove auto-redirect from useEffect, clean up imports

Co-Authored-By: Claude Code <noreply@anthropic.com>"

git add apps/web/src/pages/NewMemberPage.tsx
git commit -m "fix(members): correct PhotoCaptureUpload import path

Co-Authored-By: Claude Code <noreply@anthropic.com>"

# ... etc
```

---

## Development Workflow

### Daily Development
```bash
# 1. Start dev environment (runs both API and web)
pnpm dev

# 2. API only
pnpm dev:api

# 3. Web only
pnpm dev:web

# 4. Type checking
pnpm typecheck

# 5. Run tests
pnpm test
pnpm test:e2e
```

### Database Management
```bash
# Run migrations locally
pnpm db:migrate:local

# Seed test data
pnpm db:seed:local

# Pull schema from D1 to verify
pnpm db:schema:pull:local

# Staging/production migrations
pnpm db:migrate:staging
pnpm db:migrate:production
```

---

## Critical Issues to Fix (This Week)

### Priority 1: Complete Core Business Logic
1. **Membership Renewal** - Backend validation and receipt generation
2. **Payment Receipts** - PDF/printable receipt generation
3. **Attendance Check-in** - QR scanner component
4. **Staff CRUD** - Complete create/edit functionality

### Priority 2: Fix Repository Search
The `user.repository.ts` and `member.repository.ts` search logic was simplified but may need restoration:

**Before committing these files, verify:**
- [ ] Member search by name/phone/email works
- [ ] Member filter by status works
- [ ] User search in admin panel works
- [ ] Pagination works correctly

### Priority 3: Form Validation
Add comprehensive validation to:
- [ ] Member creation form
- [ ] Membership assignment form
- [ ] Payment recording form
- [ ] Staff creation form
- [ ] Plan creation form

---

## Testing Checklist

### Manual Testing (Before Each Commit)
- [ ] Login flow works (staff + platform admin)
- [ ] CSRF protection active (check network tab)
- [ ] Token refresh works (wait for expiry or force)
- [ ] Member CRUD operations work
- [ ] Search and filter work
- [ ] Dashboard loads without errors
- [ ] No console errors in browser

### Automated Testing (Before Production)
```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

---

## Implementation Plan

See `IMPLEMENTATION_PLAN.md` for the complete 13-day roadmap to production.

**Key Milestones:**
- **Week 1 (Days 1-5):** Fix critical issues, complete core features
- **Week 2 (Days 6-10):** Polish UI/UX, testing, bug fixes
- **Week 3 (Days 11-13):** Security review, production deployment

---

## Production Deployment

### Prerequisites
- [ ] All modified files reviewed and committed
- [ ] All tests passing
- [ ] Manual testing complete
- [ ] Database migrations verified
- [ ] Environment variables configured

### Deployment Commands
```bash
# Build the project
pnpm build

# Deploy to staging (for testing)
pnpm deploy:staging

# Deploy to production (after staging verification)
pnpm deploy:production

# Test production build locally
pnpm preview
```

---

## Known Issues & TODOs

1. **Platform Admin Authorization** (Line 130 in `auth.ts`)
   - TODO: Add `authorized_gyms` column to `platform_admins` table
   - Current: All platform admins can access all gyms
   - Not blocking for MVP if single platform admin

2. **Notification Service** (Line 34 in `notifications.ts`)
   - TODO: Integrate Twilio/MessageBird/Gupshup for actual sending
   - Current: WhatsApp URL generation only

3. **Member Repository Search** (Current changes)
   - TODO: Verify search functionality after refactor
   - Test with various search terms and filters

4. **Set-Cookie Header Format**
   - FIXED: Now using `.join(', ')` instead of array
   - Verify in production that cookies are set correctly

---

## Getting Help

### Common Issues

**Issue: TypeScript errors**
```bash
# Check errors
pnpm typecheck

# Common fix: rebuild shared package
cd packages/shared && pnpm build
cd ../..
pnpm typecheck
```

**Issue: Database out of sync**
```bash
# Pull latest schema
pnpm db:schema:pull:local

# Re-run migrations
pnpm db:migrate:local
```

**Issue: Port already in use**
```bash
# Kill processes on port 5173 (web) or 8787 (api)
npx kill-port 5173
npx kill-port 8787
```

---

## Project Structure

```
gymtechapp/
├── apps/
│   ├── api/          # Cloudflare Workers API
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/    # Business logic
│   │   │   ├── repositories/# Database access
│   │   │   ├── middleware/  # Auth, CSRF, etc.
│   │   │   └── db/          # Schema & client
│   │   └── migrations/      # SQL migrations
│   └── web/          # React frontend
│       └── src/
│           ├── pages/       # Route components
│           ├── components/  # Reusable components
│           └── lib/         # Utilities & API client
├── packages/
│   └── shared/       # Shared types & schemas
└── docs/
    ├── IMPLEMENTATION_PLAN.md  # Complete roadmap
    └── QUICK_START.md          # This file
```

---

## Next Actions (In Order)

1. ✅ **Review this guide**
2. ⏳ **Test modified files** - Run `pnpm dev` and manually test auth flow
3. ⏳ **Fix any issues** found during testing
4. ⏳ **Commit changes** using the commit strategy above
5. ⏳ **Move to next phase** of implementation plan

---

**Last Updated:** 2026-09-14  
**Current Sprint:** Phase 1 - Critical Issues & Missing Core Features  
**Target Production Date:** 2026-10-04 (3 weeks from now)
