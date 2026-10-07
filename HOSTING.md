# Hosting StreetFix on Cloudflare Workers

StreetFix already builds into a Cloudflare Worker with bundled website assets. These steps publish the interview prototype and configure its optional Gemini photo drafts.

## Before you start

- Install Node.js 22.13 or newer and npm.
- Create a [Cloudflare account](https://dash.cloudflare.com/sign-up) and use the **Workers Free** plan. Hosting is free within its [usage limits](https://developers.cloudflare.com/workers/platform/pricing/).
- For Live AI, create a Gemini API key for a project marked **Free Tier** in [Google AI Studio](https://aistudio.google.com/apikey). Keep billing disabled on that project if you want to avoid paid API usage. Free AI requests have quotas.

Sample AI drafts and manual reporting work without a Gemini key. The default live model is `gemini-3.1-flash-lite`; no model setting is required.

## Build and deploy

Open PowerShell in your checkout.

```powershell
npm ci
npm run build
npx wrangler login
npx wrangler deploy --config dist/server/wrangler.json
```

Skip `npm ci` if dependencies are already installed and the lockfile has not changed. `wrangler login` opens your browser to sign in to Cloudflare and authorize the CLI.

The build generates `dist/server/wrangler.json`, which identifies the `streetfix` Worker and its website assets. Deploy using that configuration rather than uploading only the static files: Live AI needs the server route.

Wrangler prints the deployed URL, typically in this form:

```text
https://streetfix.<your-subdomain>.workers.dev
```

Use the actual URL printed by Wrangler. See the [Wrangler deployment documentation](https://developers.cloudflare.com/workers/wrangler/commands/workers/) for command details.

## Configure the Gemini secret

From the same directory, run:

```powershell
npx wrangler secret put GEMINI_API_KEY --config dist/server/wrangler.json
```

Paste your Free Tier project's Gemini key when prompted. The command updates the deployed Worker with the secret. Do not put the key in the command itself, source files, or the Wrangler configuration.

Your local `.dev.vars` file is for local development; it is not automatically uploaded as a production secret. Cloudflare stores production secrets separately. See [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

You can also set the secret in the Cloudflare dashboard under **Workers & Pages → streetfix → Settings → Variables and Secrets**. Choose **Secret** as the type and `GEMINI_API_KEY` as the name.

## Check the hosted app

1. Open the URL printed by Wrangler and confirm the map and report cards load.
2. Select **Report an issue**, upload a photo or choose the labeled sample, and confirm a location.
3. On the review step, select **Live AI · Google Gemini**, give consent, and select **Help describe this issue**.
4. Confirm the draft fills the editable fields. Review them before submitting.
5. Submit a demo report and reload the same browser to check local persistence.

## Publish later changes

After editing the app, rebuild and redeploy:

```powershell
npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

The existing production secret is retained. To replace the Gemini key, run the `wrangler secret put GEMINI_API_KEY` command again with the same configuration.

## Troubleshooting

- **Live AI is not configured:** Set the production `GEMINI_API_KEY` secret; a key in local `.dev.vars` does not configure the hosted Worker.
- **Billing credits unavailable:** Check that the key belongs to a Free Tier project. A paid project's depleted credits are not fixed by changing models.
- **Quota reached:** Wait for the provider's quota to reset or use Sample AI/manual reporting. Review your limits in Google AI Studio.
- **Temporary overload or timeout:** Retry later. Manual reporting remains available.
- **Build or deploy fails:** Check the command output and use the Node.js version required above. For the Windows npm launcher workaround, see [README.md](README.md#launch).

## What hosting changes

Hosting gives visitors a URL, but reports, uploaded photos, supports, and staff updates still live in each visitor's browser through IndexedDB. Visitors do not share a database, and existing local reports do not transfer to the hosted origin.

The demo role selector is not authentication. A shared pilot would need a backend database and photo storage, real resident/staff permissions, and limits on AI requests. Before sharing Live AI broadly, protect the draft endpoint so visitors cannot exhaust your Gemini quota. See [README.md](README.md#data-map-and-demo-auth-limitations) for the prototype's full limitations.
