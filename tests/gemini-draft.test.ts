import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiDraftResponse } from '../lib/gemini-draft';

const config = { GEMINI_API_KEY: 'test-key-never-use-for-live-requests' };
const input = { image: 'data:image/jpeg;base64,ZmFrZQ==', context: 'Uneven road beside the bus stop.', category: 'Pothole', title: '', consent: true };
const draft = { title: 'Uneven road surface', category: 'Pothole', description: 'The road surface is uneven.', observations: 'A damaged patch is visible.', residentFacts: input.context, questions: ['When did you first notice it?'], suggestedTeam: 'Roads' };
const request = (body: unknown = input, headers: Record<string, string> = {}) => new Request('http://127.0.0.1:5173/api/draft', {
  method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'http://127.0.0.1:5173', ...headers }, body: JSON.stringify(body),
});
const completed = (text = JSON.stringify(draft)) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });

test('missing or blank Gemini key returns a manual fallback without sending a photo', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected external request'); });
  for (const settings of [{}, { GEMINI_API_KEY: '  ' }]) {
    const response = await createGeminiDraftResponse(request(), settings);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match((await response.json() as { error: string }).error, /GEMINI_API_KEY/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('Gemini receives inline images and resident text; only a validated draft returns to the client', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), config.GEMINI_API_KEY);
    assert.ok(init?.signal instanceof AbortSignal);
    const body = JSON.parse(String(init?.body));
    assert.match(body.systemInstruction.parts[0].text, /Never decide priority or assignment/);
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), { residentContext: input.context, manualCategory: input.category, manualTitle: input.title });
    assert.deepEqual(body.contents[0].parts[1], { inlineData: { mimeType: 'image/jpeg', data: 'ZmFrZQ==' } });
    assert.equal(body.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON');
    assert.equal(body.generationConfig.responseFormat.text.schema.additionalProperties, false);
    assert.ok(!JSON.stringify(body).includes('45.5169'));
    return Response.json(completed());
  });
  const response = await createGeminiDraftResponse(request({ ...input, lat: 45.5169, lng: -122.6510 }), config);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { draft });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(fetch.mock.callCount(), 1);
});

test('model override, PNG/WebP images and thought parts are handled', async t => {
  for (const mimeType of ['image/png', 'image/webp']) {
    await t.test(mimeType, async t => {
      t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
        assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/models/custom-image-model:generateContent');
        const body = JSON.parse(String(init?.body));
        assert.equal(body.contents[0].parts[1].inlineData.mimeType, mimeType);
        const text = JSON.stringify(draft);
        return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [
          { thought: true, text: 'Internal thought content should never be returned.' },
          { text: text.slice(0, 20) }, { text: text.slice(20) },
        ] } }] });
      });
      const response = await createGeminiDraftResponse(request({ ...input, image: `data:${mimeType};base64,ZmFrZQ==` }), { ...config, GEMINI_MODEL: ' custom-image-model ' });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { draft });
    });
  }
});

test('cross-origin, missing consent, invalid images and oversized payloads never reach Gemini', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected external request'); });
  const cases: [Request, number][] = [
    [request(input, { origin: 'https://another-site.example' }), 403],
    [request({ ...input, consent: false }), 400],
    [request({ ...input, consent: undefined }), 400],
    [request({ ...input, image: 'data:image/svg+xml;base64,ZmFrZQ==' }), 400],
    [request({ ...input, context: 'x'.repeat(2001) }), 400],
    [request(input, { 'content-length': '8000001' }), 413],
  ];
  for (const [req, status] of cases) {
    assert.equal((await createGeminiDraftResponse(req, config)).status, status);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('Gemini rate limits and provider failures do not expose keys or provider error details', async t => {
  for (const status of [402, 429, 403, 500, 503, 504]) {
    await t.test(String(status), async t => {
      t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: `Private provider details ${config.GEMINI_API_KEY}` } }, { status }));
      const response = await createGeminiDraftResponse(request(), config);
      assert.equal(response.status, 502);
      const body = await response.text();
      assert.match(body, status === 402 ? /billing.*credits.*Google AI Studio/ : status === 429 ? /quota/ : status === 503 || status === 504 ? /temporarily overloaded/ : /server configuration/);
      assert.ok(!body.includes(config.GEMINI_API_KEY));
      assert.ok(!body.includes('Private provider details'));
    });
  }
});

test('blocked, truncated, missing and invalid drafts yield an editable manual fallback', async t => {
  const cases: [unknown, RegExp][] = [
    [{ promptFeedback: { blockReason: 'SAFETY' }, ...completed() }, /could not analyze/],
    [{ candidates: [{ ...completed().candidates[0], finishReason: 'MAX_TOKENS' }] }, /stopped before completing/],
    [{ candidates: [{ finishReason: 'SAFETY' }] }, /could not analyze/],
    [{}, /did not return a complete draft/],
    [completed('not JSON'), /unreadable draft/],
    [completed(JSON.stringify({ ...draft, category: 'Invented category' })), /draft fields/],
    [completed(JSON.stringify({ ...draft, title: '' })), /draft fields/],
    [completed(JSON.stringify({ ...draft, suggestedTeam: 'Unknown department' })), /draft fields/],
  ];
  for (const [index, [body, expected]] of cases.entries()) {
    await t.test(String(index + 1), async t => {
      t.mock.method(globalThis, 'fetch', async () => Response.json(body));
      const response = await createGeminiDraftResponse(request(), config);
      assert.equal(response.status, 502);
      const error = (await response.json() as { error: string }).error;
      assert.match(error, expected);
      assert.match(error, /finish the report manually/);
    });
  }
});

test('timeouts produce a specific safe retry response', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException(`Private details ${config.GEMINI_API_KEY}`, 'TimeoutError'); });
  const response = await createGeminiDraftResponse(request(), config);
  assert.equal(response.status, 504);
  const body = await response.text();
  assert.match(body, /Retry or finish the report manually/);
  assert.match(body, /took too long/);
  assert.ok(!body.includes(config.GEMINI_API_KEY));
});

test('network interruptions and unreadable provider responses produce distinct safe errors', async t => {
  await t.test('network interruption', async t => {
    t.mock.method(globalThis, 'fetch', async () => { throw new TypeError(`Private details ${config.GEMINI_API_KEY}`); });
    const response = await createGeminiDraftResponse(request(), config);
    assert.equal(response.status, 502);
    const body = await response.text();
    assert.match(body, /could not be reached/);
    assert.ok(!body.includes(config.GEMINI_API_KEY));
  });
  await t.test('unreadable provider response', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('<html>Unexpected gateway response</html>'));
    const response = await createGeminiDraftResponse(request(), config);
    assert.equal(response.status, 502);
    assert.match((await response.json() as { error: string }).error, /unreadable response/);
  });
});
