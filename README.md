# Meta Pixel + CAPI Demo

A hands-on tool for testing Meta Pixel and Conversions API (CAPI) together — fire browser and server events, verify deduplication, and see results in Events Manager.

> **Just want to test quickly?** Use the [Test Lab](https://abhinav14kr.github.io/meta-pixel-capi-demo/test-lab.html) — enter your Pixel ID and CAPI backend URL, fire events, and verify in your Events Manager. No setup or forking required.
>
> **Want your own setup?** [Fork this repo](#fork--run-your-own) and deploy your own demo page with your Pixel and backend.

---

## Test Lab — Try It Without Forking

**[Open the Test Lab](https://abhinav14kr.github.io/meta-pixel-capi-demo/test-lab.html)**

The Test Lab is a standalone page where you plug in your own Pixel ID and CAPI backend URL to test Pixel + CAPI behavior. Nothing is hardcoded — you bring your own credentials, and events go to your own Events Manager.

Use it to:
- Verify your CAPI backend is sending events correctly
- Toggle Pixel, CAPI, and simulated ad blocker on/off
- Test deduplication with shared Event IDs

| Scenario | What happens |
|---|---|
| Both Working | Pixel + CAPI fire together, deduplicated |
| Pixel Only | No server backup — vulnerable to ad blockers |
| CAPI Only | Server-side only — works regardless of browser |
| Ad Blocked | Pixel blocked, CAPI still delivers |

---

## Demo Page — Fork Your Own Setup

The demo page (`index.html`) is a personal page with your Pixel and CAPI backend hardcoded. PageView tracks automatically on load, and button clicks fire AddToCart / AddToWishlist through both channels.

**This is what you get when you [fork the repo](#fork--run-your-own)** — your own branded instance with no configuration fields exposed. Ideal for demos, onboarding walkthroughs, or sharing with clients.

---

## How It Works

When a user triggers an event (e.g. "Add to Cart"):

1. **Browser Pixel** fires the event via `fbq('track', ...)`
2. **Your backend** sends the same event to Meta's Graph API via CAPI

Both share the same **Event ID**, so Meta deduplicates them. If the Pixel is blocked (ad blocker), CAPI still delivers. Your access token never touches the frontend.

```
User clicks "Add to Cart"
        |
        +---> Browser Pixel ---> Meta (via fbevents.js)
        |         event_id: "ABC123"
        |
        +---> Your Backend ---> Meta Graph API
                  event_id: "ABC123"

Meta matches on event_id, counts as one event.
```

---

## Fork & Run Your Own

Want your own instance with your Pixel hardcoded? Here's how:

### 1. Fork & clone

Fork this repo on GitHub, then clone it locally.

### 2. Deploy your backend

1. Go to [render.com](https://render.com) and create a **New > Web Service** from your fork
2. Set **Root Directory** to `backend`, **Build Command** to `npm install`, **Start Command** to `npm start`
3. Add env vars: `PIXEL_ID` (required), `FB_ACCESS_TOKEN` (required), `TEST_EVENT_CODE` (optional)
4. Deploy — your backend URL will be `https://your-service-name.onrender.com`

Works the same on Railway, Heroku, or any Node.js host.

### 3. Update your frontend

In `docs/index.html`, update these two values:

- **Pixel ID** — replace `'733939589457690'` with your Pixel ID (appears twice: in `fbq('init', ...)` and in the `<noscript>` img tag)
- **CAPI URL** — replace the `CAPI_URL` variable with your Render backend URL (e.g. `'https://your-service-name.onrender.com/api/event'`)

### 4. Update CORS

In `backend/server.js`, add your GitHub Pages domain to `ALLOWED_ORIGINS`:

```js
const ALLOWED_ORIGINS = [
    'https://yourusername.github.io',  // your GitHub Pages domain
    'http://localhost:3000',
    ...
];
```

### 5. Enable GitHub Pages

Go to your repo's **Settings > Pages**, set branch to `main` and folder to `/docs`. Your demo will be live at `https://yourusername.github.io/meta-pixel-capi-demo/`.

---

## Getting Your Credentials

All three come from [Events Manager](https://business.facebook.com/events_manager2) — select your Pixel, then:

1. **Pixel ID** — shown in the header (a number like `123456789012345`)
2. **Access Token** — go to **Settings > Generate Access Token**. Copy it immediately, it won't be shown again.
3. **Test Event Code** (optional) — go to **Test Events** tab, code is at the top (e.g. `TEST12345`). Routes events to the test view instead of production.

---

## Running Locally

```bash
git clone https://github.com/your-username/meta-pixel-capi-demo.git
cd meta-pixel-capi-demo/backend
npm install

export PIXEL_ID="your_pixel_id"
export FB_ACCESS_TOKEN="your_access_token"
export TEST_EVENT_CODE="TEST12345"   # optional

npm start
```

Verify at `http://localhost:3000` — you should see a JSON health check. Then serve the frontend: `cd docs && npx serve .`

---

## API Reference

**POST /api/event**

```json
{
  "eventName": "AddToCart",
  "eventId": "AddToCart_1710000000_abc123",
  "eventData": {
    "content_name": "Test Product",
    "value": 49.99,
    "currency": "USD"
  },
  "userData": {
    "email": "test@example.com",
    "firstName": "John"
  },
  "eventSourceUrl": "https://yoursite.com/products",
  "testEventCode": "TEST12345"
}
```

The backend hashes PII (email, phone, name) with SHA-256 before sending to Meta.

---

## Production Notes

This is a test tool. For production: obtain user consent before firing Pixel (GDPR/CCPA), add `data_processing_options` for US users (LDU), support `opt_out` in user_data, and keep `API_VERSION` in `server.js` up to date.

---

## Resources

- [Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Meta Pixel](https://developers.facebook.com/docs/meta-pixel)
- [Deduplication Guide](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events)
- [Test Events](https://developers.facebook.com/docs/marketing-api/conversions-api/using-the-api#test-events)
