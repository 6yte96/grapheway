/** Content for the example site: rendered HTML pages + markdown mirrors. */

export const pages: Record<string, string> = {
  "/": `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Acme Gadgets — API-powered devices</title>
</head>
<body>
  <header>
    <h1>Acme Gadgets</h1>
    <p>API-powered gadgets for everyone.</p>
  </header>
  <nav>
    <a href="/docs/welcome">Docs</a> ·
    <a href="/products/weather-beacon">Products</a> ·
    <a href="/pricing">Pricing</a>
  </nav>
  <main>
    <section>
      <h2>Why Acme</h2>
      <p>Every device we sell exposes an open HTTP API. Build a weather dashboard,
      automate your coffee, or paint your wall — all from one TypeScript SDK.</p>
      <ul>
        <li><a href="/products/weather-beacon">Weather Beacon</a></li>
        <li><a href="/products/coffee-bot">Coffee Bot</a></li>
        <li><a href="/products/light-portal">Light Portal</a></li>
      </ul>
    </section>
    <section>
      <h2>Get started</h2>
      <p>Install the SDK, grab a device, and make your first API call in minutes.
      See the <a href="/docs/install">installation guide</a>.</p>
    </section>
  </main>
  <footer>
    <p>Questions? <a href="/contact">Contact support</a>.</p>
  </footer>
</body>
</html>`,

  "/docs/welcome": `<!doctype html><html><head><title>Welcome — Acme Docs</title></head><body>
<h1>Welcome to Acme</h1><p>Acme Gadgets makes small devices that expose their
state over HTTP. This documentation walks you through everything.</p>
<h2>What you can build</h2><ul><li>Weather dashboards</li><li>Brew automation</li>
<li>Ambient lighting scenes</li></ul></body></html>`,

  "/docs/install": `<!doctype html><html><head><title>Install the SDK — Acme Docs</title></head><body>
<h1>Install the SDK</h1><h2>npm</h2><p>Run <code>npm i acme-gadgets</code>.</p>
<h2>Authenticate</h2><p>Create an API key at acme.example/keys and pass it to the client.</p>
<h2>First call</h2><p>Fetch your device: <code>client.device("WB-0001").status()</code>.</p></body></html>`,

  "/docs/quickstart": `<!doctype html><html><head><title>Quickstart — Acme Docs</title></head><body>
<h1>Quickstart</h1><p>In under five minutes: install the SDK, create a key, read your device's
status, and toggle a light.</p></body></html>`,

  "/products/weather-beacon": `<!doctype html><html><head><title>Weather Beacon — Acme</title></head><body>
<h1>Weather Beacon</h1><p>Pulls live weather for your location and exposes it over HTTP.
API: <code>GET /v1/devices/WB-0001</code>. Ships with a mount and solar option.</p></body></html>`,

  "/products/coffee-bot": `<!doctype html><html><head><title>Coffee Bot — Acme</title></head><body>
<h1>Coffee Bot</h1><p>Brews coffee on a schedule and reports status as JSON.
API: <code>GET /v1/devices/CB-0001</code>.</p></body></html>`,

  "/products/light-portal": `<!doctype html><html><head><title>Light Portal — Acme</title></head><body>
<h1>Light Portal</h1><p>RGB light panels with a simple API to set colors and scenes.
API: <code>POST /v1/devices/LP-0001/color</code>.</p></body></html>`,

  "/pricing": `<!doctype html><html><head><title>Pricing — Acme</title></head><body>
<h1>Pricing</h1><p>Starter: $0/month for one device. Maker: $9/month for five devices.
Lab: $49/month for unlimited devices plus team access.</p></body></html>`,

  "/contact": `<!doctype html><html><head><title>Contact — Acme</title></head><body>
<h1>Contact</h1><p>Email hello@acme.example. We reply within one business day.</p></body></html>`,
};

/** Markdown mirrors for llms-full.txt and the get_page action. */
export const markdownDocs: Record<string, string> = {
  "/docs/welcome":
    "Acme Gadgets makes small devices that expose their state over HTTP.\n\n## What you can build\n- Weather dashboards\n- Brew automation\n- Ambient lighting scenes",
  "/docs/install":
    "## Install\nRun `npm i acme-gadgets`.\n\n## Authenticate\nCreate an API key at acme.example/keys.\n\n## First call\n`client.device(\"WB-0001\").status()`",
  "/docs/quickstart":
    "In under five minutes: install the SDK, create a key, read your device's status, and toggle a light.",
  "/products/weather-beacon":
    "Pulls live weather for your location and exposes it over HTTP.\nAPI: `GET /v1/devices/WB-0001`.",
  "/products/coffee-bot": "Brews coffee on a schedule and reports status as JSON.\nAPI: `GET /v1/devices/CB-0001`.",
  "/products/light-portal": "RGB light panels with a simple API to set colors and scenes.\nAPI: `POST /v1/devices/LP-0001/color`.",
  "/pricing": "Starter: $0/month for one device. Maker: $9/month for five devices. Lab: $49/month for unlimited devices.",
  "/contact": "Email hello@acme.example. We reply within one business day.",
};
