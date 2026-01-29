---
description: How to deploy the Me Portal to Vercel (Production)
---

# Deploying Me Portal

Since the project is configured with Vercel CLI, you can deploy updates manually from your terminal.

1.  **Open Terminal**: ensure you are in the project root (`me-portal`).
2.  **Run Deploy Command**:
    ```bash
    npx vercel --prod
    ```
    *   The `--prod` flag tells Vercel to update your live domain (`me-portal-xi.vercel.app`).
    *   Without `--prod`, it creates a "Preview Deployment" (a temporary test URL).

3.  **Confirm**: The CLI might ask `Inspect? [y/N]`. You can just hit Enter or wait.

## Environment Variables
If you add **new keys** to your `.env` file locally:
1.  You must also add them to the Vercel Dashboard for the live site.
2.  [Open Vercel Dashboard](https://vercel.com/dashboard) -> Select Project -> Settings -> Environment Variables.
3.  Add the new key/value.
4.  **Redeploy** using the command above for changes to take effect.
