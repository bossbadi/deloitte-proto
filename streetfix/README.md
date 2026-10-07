# StreetFix

> Photograph a street problem, get your neighbors behind it, and follow its repair on one shared map.

A runnable, local interview prototype for a Deloitte AI Innovation Analyst / Summer Scholar interview. No Deloitte or municipal endorsement is implied. The municipal public works department is the proposed buyer; residents and city staff use the same report and public repair history.

## Launch

Requires Node.js 22.13 or newer and npm. Tested with Node.js 24.13.1 on Windows.

```powershell
cd streetfix
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The server listens locally; this project has not been published. On Windows, if the npm launcher reports a missing npm-cli.js, use the installed CLI directly:

```powershell
node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' ci
node scripts/run-framework.mjs dev
```

```powershell
npm run typecheck
npm test
npm run build
npm start
```

The production preview uses the generated Cloudflare Worker through Wrangler. Its default address is http://127.0.0.1:8787. Stop the development preview first if switching to a different launch command. Port 5173 is the interview demo address when running `npm run dev`.

## What is included

- Large Leaflet map and synchronized photographic issue cards; category/status filters and newest, oldest, or support-count sorting.
- Desktop detail sheet and mobile map/list switching. Text statuses accompany colors.
- Real JPEG, PNG, and WebP uploads, preview/replace/remove controls, decode validation, a 5 MB input limit, and optional device location. Coordinates must be explicitly selected and confirmed; they never come from a photo.
- Editable documentation drafts, missing-information prompts, suggested department routing, and manual submission.
- Stable resident identities Maya and Leo, one reversible support relationship per identity/report, and counts derived from relationships.
- Shared local staff queue: Needs review, Urgent, Most supported, and In progress. Review/correction, duplicate handling, independent staff priority/reason, team/date, public notes, sequential repair stages, and optional completion photos.
- Eleven fictional reports, including a popular normal-priority pothole (63 supports), a low-support urgent access concern (4 supports), and a fixed sidewalk with full history and an illustrative completion photo.
- IndexedDB persistence and complete reset to seed data. Storage and map failures leave a usable session/manual workflow.

## Honest AI modes

**Sample AI draft is the default and needs no credentials.** Selecting the labeled sample photo enables a curated example for that known image. The interface identifies it as a sample, not a live model analysis. For arbitrary device uploads, the local helper uses only the resident's supplied text, chosen category, and title. It explicitly says **photo not analyzed**. Fields remain editable and no external request occurs. Residents can submit entirely manually without selecting the helper.

**Live AI is optional.** Copy `.dev.vars.example` to `.dev.vars`, enter an OpenAI API key, and restart the preview:

```powershell
Copy-Item .dev.vars.example .dev.vars
# Edit .dev.vars locally; never commit it.
npm run dev
```

The optional default model is `gpt-4.1-mini`; `OPENAI_MODEL` can specify another image-capable model supporting structured output that your account can access. In the form choose **Live AI · OpenAI**, select the consent checkbox, and deliberately select **Help describe this issue**. Only then is the photo and resident text sent to the server/provider. Device coordinates are not sent to the model. The server uses the [Responses image input](https://developers.openai.com/api/docs/guides/images-vision) and [structured output](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) APIs, with `store: false`, a restricted routing guide, a strict JSON schema, and Zod validation of returned data. The provider's data policies still apply; `store: false` is not a claim of zero retention.

The server never returns the key to the client and does not log requests, photos, keys, or provider error bodies. Missing credentials, refusal/incomplete output, invalid structured data, provider errors, and timeouts yield a clear retry/manual fallback. No external credentials were available for verification, so live provider output has **not** been tested. The absent-key and simulated failure paths were browser-tested. AI suggests documentation and routing; staff decide urgency and work assignment. No image generation is used.

## Data, map, and demo-auth limitations

This is **one browser's local prototype**, not a live citywide service. Reports, normalized uploaded photo data, timeline entries, and support relationships form one validated snapshot persisted transactionally in IndexedDB. Photos are re-encoded to JPEG, resized to at most 1600 pixels along the longest side, and stored durably rather than using temporary object URLs. Reset replaces the entire snapshot, removing uploaded photos, new records, staff changes, and local supports together.

Maya and Leo are stable demo identities, not verified unique residents. The local role selector is not authentication, staff authorization, or protection against vote manipulation. Seed support identities are invented fixtures. Different browsers/devices/origins do not share data. There is no live cross-tab synchronization; use one tab for the interview, as simultaneous independent tabs can overwrite their snapshots. Clearing browser site data removes records. If IndexedDB is blocked, corrupted, full, or unavailable, a banner explains that changes are session-only and offers Retry saving. Initial corrupt local data is not silently declared persisted.

The map uses OpenStreetMap tiles over real Portland geography. **Harborview is a fictional neighborhood label**, without an official boundary. All seed locations, issue details, dates, supporter counts, priorities, assignments, histories, and repair outcomes are fictional demonstration fixtures. Representative photos were taken elsewhere; they do not establish any seed location. When tiles fail, the interactive map shows an explicitly labeled coordinate grid with no invented street geometry. Markers and manual coordinate entry remain available.

Duplicate reports retain original photos, history, and supports and link to their canonical report. Their support records are not transferred or added to the canonical count. The staff urgency and support queues use straightforward filters and sorts, never weighted optimization. Target dates are staff planning estimates, not promises. Accessibility context is resident-reported unless a staff note states an inspection result.

A production/shared pilot would require a separate authenticated API, shared persistent database/object storage, staff permissions, audit/recovery policies, abuse controls, and a reviewed privacy/retention policy. None of that authorization is provided by this role toggle. The optional Live AI endpoint is for the local prototype; it would need real access controls and request limits before public hosting with a funded key. No shared-backend integration is configured.

## Photo provenance

All seven real seed photos are locally bundled Wikimedia Commons thumbnails with attribution and CC licenses. No generative imagery is included. See [public/IMAGE-PROVENANCE.md](public/IMAGE-PROVENANCE.md) and the machine-readable [public/image-provenance.json](public/image-provenance.json). The interface links the credits. Display crops are documented. ShareAlike image licenses remain with those images and adaptations.

The fixed sidewalk's completion photo is an **illustrative fixture of a separate scene**, explicitly labeled, not an actual before/after pair. A new completion upload is labeled as staff-uploaded and remains on that report.

## Implementation and verification

TypeScript, React 19, Vinext/Vite, the supplied accessible UI primitives, Leaflet, Zod, and browser IndexedDB. The only optional server capability is the AI draft route. No account/database service is required for the core demo. The supplied Sites starter and lockfile are retained; the project is local-only and unregistered for hosting.

- `lib/streetfix.ts`: validated model, seeds, support relationships, staff transitions, and transparent queue filtering/sorting.
- `lib/storage.ts`: transactional persistence and safe photo ingestion.
- `components/streetfix-app.tsx`: connected roles, reports, forms, detail sheet, and public updates.
- `components/street-map.tsx`: real map, marker synchronization, and coordinate fallback.
- `app/api/draft/route.ts`: optional server-only multimodal integration.
- `tests/model.test.ts`: focused transition/support/duplicate/draft/persistence tests.
- `tests/browser/streetfix.spec.ts`: real browser acceptance checks.

The browser suite targets the installed Microsoft Edge (`channel: 'msedge'`) and an already-running development preview:

```powershell
npm run dev
# In a second terminal:
npm run test:browser
```

On systems without Edge, change the Playwright channel to a locally installed browser or install Playwright Chromium and remove the channel setting. See [VERIFICATION.md](VERIFICATION.md) for actual results and limits, [DEMO.md](DEMO.md) for the three-minute script, and [INTERVIEW.md](INTERVIEW.md) for buyer/workflow/validation notes.

Two feature-detected, page-scoped WebMCP tools let compatible browsers read local reports or open the same visible detail sheet. They are optional; normal browsers use the UI. WebMCP is not authentication, and no supported WebMCP runtime was available to execute its registration tests.
