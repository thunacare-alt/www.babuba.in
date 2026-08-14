# Babuba SaaS — chaya.in

The Babuba SaaS landing + onboarding site. Serves the chat-based agent builder wizard.

**Architecture:**
- `index.html` / `style.css` / `app.js` — landing page + onboarding wizard
- `/app/saas-api/server.js` — API server (serves the site + payment + provisioning)
- `/app/saas-api/provision.js` — provisions agent in super-admin dashboard + tenant gateway

**Flow:** visitor → wizard (purpose, channels, guardrails, RBAC, compliance) → plan → payment (Razorpay, test-mode fallback) → webhook → agent auto-created in super-admin dashboard + isolated tenant gateway (Agent = Tenant = Client).

**Run:** `node /app/saas-api/server.js` (port 80). Config: `/app/saas-api/config.json`.
