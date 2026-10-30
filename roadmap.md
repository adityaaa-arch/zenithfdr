# Roadmap

## Real accounts & persistent data (in progress)
- [x] Enable Lovable Cloud; email + Google + Lovable sign-in; public sign-up disabled (admin-created accounts)
- [ ] Database migration: app tables (fdrs, releases, renewals, audit, notices, settings, profiles, user_roles) + seed INSERTs of the demo dataset
- [ ] Auth surfaces: /auth sign-in page, /forgot-password, /reset-password, `_authenticated` gate layout
- [ ] Move all app routes under `_authenticated/`; wire onAuthStateChange + bearer middleware
- [ ] Store rewrite: hydrate from database, write-through persistence, real actor identity + role
- [ ] AppShell: remove demo role switcher / demo mode / reset; real profile menu + sign out
- [ ] User Management: real accounts (admin creates users via server function), role + active management
- [ ] Update AGENTS.md with architecture decisions; run tests; verify sign-in end-to-end in browser
