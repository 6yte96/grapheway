/**
 * The single source of truth for this site's agent presence.
 * Used by the live server AND the CLI (`grapheway generate --config ...`).
 */
import type { GraphewayConfig } from "grapheway";

export const graphewayConfig: GraphewayConfig = {
  name: "Acme Gadgets",
  url: "http://localhost:4321",
  tagline: "API-powered gadgets for everyone",
  summary:
    "Acme Gadgets sells small, API-powered devices: the Weather Beacon, the Coffee Bot and the Light Portal. Every product ships with an open HTTP API, a TypeScript SDK and full documentation. Support: hello@acme.example.",
  contact: { name: "Acme Support", email: "hello@acme.example", protocol: "email" },
  capabilities: ["search", "mcp", "llms.txt", "checkout-demo"],

  sections: [
    {
      title: "Getting Started",
      description: "Everything you need for your first Acme gadget.",
      items: [
        { title: "Welcome to Acme", url: "/docs/welcome", notes: "Product line overview and what you can build" },
        { title: "Install the SDK", url: "/docs/install", notes: "npm i acme, auth and first call" },
        { title: "Quickstart", url: "/docs/quickstart", notes: "Your first API call in under 5 minutes" },
      ],
    },
    {
      title: "Products",
      description: "The current Acme gadget lineup.",
      items: [
        { title: "Weather Beacon", url: "/products/weather-beacon", notes: "Pulls live weather, exposes it over HTTP" },
        { title: "Coffee Bot", url: "/products/coffee-bot", notes: "Brews coffee on schedule, JSON status endpoint" },
        { title: "Light Portal", url: "/products/light-portal", notes: "RGB light panels with a simple API" },
      ],
    },
    {
      title: "Support",
      optional: true,
      items: [
        { title: "Pricing", url: "/pricing", notes: "Plans and per-device pricing" },
        { title: "Contact", url: "/contact", notes: "Reach a human" },
      ],
    },
  ],

  links: [
    { title: "GitHub", url: "https://github.com/acme-gadgets", description: "Open source SDKs" },
    { title: "Status", url: "https://status.acme.example", description: "Live API status" },
  ],

  actions: [
    {
      name: "check_device_status",
      description: "Checks the current online/offline status of a device by serial number.",
      inputSchema: {
        type: "object",
        properties: { serial: { type: "string", description: "Device serial, e.g. WB-0001" } },
        required: ["serial"],
      },
    },
  ],
};
