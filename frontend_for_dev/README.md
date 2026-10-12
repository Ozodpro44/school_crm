# Developer Portal

Internal developer and platform administration portal for Wonderkids CRM — manages subscriptions, plans, branches, platform settings, and logs across the school-CRM microservices.

## Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Local development

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` and proxies `/api` requests to `http://localhost:8080` (the local `api_gateway`) — see `vite.config.ts`.

## Deployment

Deployed on Railway as the `school_crm_dev_frontend` service; see `.env.example` for required environment variables.
