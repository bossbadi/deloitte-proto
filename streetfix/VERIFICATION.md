# Verification results

Verified 7 October 2026 on Windows, Node.js 24.13.1, Microsoft Edge through Playwright. Preview: http://127.0.0.1:5173. No site was published.

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Pass |
| Production build (`node scripts/run-framework.mjs build`) | Pass |
| Focused model/persistence and Gemini suite | 37 tests passed (including subtests) |
| Browser acceptance suite | 13 tests passed |
| Gemini browser checks | 3 targeted tests passed: consent/success, missing-key/provider-failure fallback, loading locks |
| Live Gemini browser draft | Pass with a bundled sample photo and a user-confirmed Free Tier key; editable fields populated |
| Browser page errors during screenshot inspection | None |
| Desktop viewport | 1440 × 1000, visually inspected |
| Mobile viewport | 390 × 844, visually inspected; no horizontal overflow |
| Real map tiles | OpenStreetMap tiles loaded; separate blocked-tile fallback test passed |

## Verified interactions

- A real uploaded JPEG becomes a normalized image preview, is submitted at explicitly confirmed coordinates, and appears in the map/list with Awaiting review. The report's actual photo and coordinates survive reload.
- Map marker and issue-card selection open the correct common detail sheet. Selected markers are highlighted and centered.
- Maya's support toggles 63 → 64 → 63, and another stable identity can independently support the same report. Counts and selected support state agree between views and persist after reload. Counts are derived from unique relationships.
- Category/status filtering, sort order, staff queues, and clear-filter empty states work. Urgent and Needs review remain oldest first even after a resident chooses Most supported.
- Staff confirmation, priority/reason, team assignment, sequential Reported → Planned → In progress → Fixed stages, and public notes appear on the resident's same report.
- A new completion photo, original upload, support relationships, and full repair history persist on a fixed report across reload. The seeded fixed report includes all stages and a clearly labeled illustrative completion fixture.
- Duplicates retain their history and original supporters, link to the canonical report, and do not inflate its support count. New supports on duplicates are blocked; existing supporters can withdraw support.
- Unsupported SVG, corrupt image bytes, and oversized files produce understandable errors. Upload replacement/removal works. Invalid coordinates fail; editing coordinates requires a newly placed and confirmed pin.
- Sample mode labels curated known-image examples. For arbitrary uploads it explicitly says Photo not analyzed and uses resident text/manual fields. Fully manual submission works.
- Live mode requires deliberate consent. Absent credentials and a simulated provider error preserve editable manual reporting. AI loading locks mode/navigation to avoid applying an old draft to a replaced photo.
- Blocked map tile requests show a labeled coordinate schematic with usable markers and manual pin entry. It contains no invented streets over real geographic tiles.
- Unavailable IndexedDB produces a session-only warning while reporting/support remain usable. Model tests use fake IndexedDB; browser tests exercise real IndexedDB. Reset removes new reports, normalized photo data, supports, and updates together; the stored snapshot is read back to confirm no uploaded data remains.
- The mobile path includes map/list switching, a usable detail sheet, upload/location/submit, staff assignment/status/note, and the same resident-visible update.

## Limits

The Gemini migration also passed targeted ESLint checks, TypeScript, and a fresh production build. Server tests use mocked Gemini responses, including image request encoding, model overrides, blocked/incomplete output, schema failures, quota errors, overload, timeouts, and network interruptions. The repeatable browser suite simulates provider responses; a separate live browser check verified that a Google-generated draft populates editable report fields.

A configured Gemini key was checked against the live models endpoint, which returned HTTP 200. An earlier live draft request returned HTTP 402 with Google's depleted-prepayment-credits error. After the user confirmed a Free Tier project key, the previous default, `gemini-3.8-flash`, returned HTTP 503 for high demand. The new default, `gemini-3.1-flash-lite`, returned HTTP 200 and valid drafts twice for the bundled pothole photo (approximately 3.7 and 1.5 seconds). A real browser request using the bundled sample photo also returned HTTP 200 and populated editable fields (approximately 16 seconds). The app distinguishes billing, overload, timeouts, incomplete output, and invalid fields without exposing provider response bodies. API output is validated on the server and client. These fixture checks do not establish accuracy across arbitrary photos or guarantee response times.

Browser verification used desktop Edge with a mobile viewport, not a physical phone or a Safari/Firefox compatibility matrix. Device geolocation is implemented with denial/unavailable fallback but was not exercised against a real device GPS. Storage-quota exhaustion was not separately injected; unavailable storage and durable normal/reset paths were tested. No supported WebMCP runtime was available for executing its optional tools; unsupported-browser feature detection was exercised.

The build may emit a Vinext static route-classification diagnostic for `/`; it still produces the client and Worker output. The app uses no route classification for authorization. Browser state is local to one origin/profile and is not synchronized across devices or active tabs.

Screenshot artifacts are in `outputs/streetfix-desktop.png`, `outputs/streetfix-staff.png`, `outputs/streetfix-detail.png`, and `outputs/streetfix-mobile.png`. The `outputs` folder is ignored and contains no credentials or live user data; screenshots use seed fixtures. `scripts/capture-preview.mjs` can refresh them while the local preview is running.
