/**
 * Adapters that wrap the framework-agnostic `handler` for popular
 * Node runtimes. Add your own in ~10 lines if you use something else:
 * the handler just needs `{ method, url, headers, body }` in and
 * `{ status, headers, body, contentType }` out.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AgentRequest, AgentResponse } from "./types.ts";

/** node:http.createServer(handler). */
export function toNodeHandler(agentHandler: (req: AgentRequest) => Promise<AgentResponse>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const rawBody = Buffer.concat(chunks).toString("utf-8");

    const isJson = (req.headers["content-type"] ?? "").includes("application/json");
    const request: AgentRequest = {
      method: req.method ?? "GET",
      url: req.url ?? "/",
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: isJson && rawBody ? safeParse(rawBody) : rawBody,
    };

    const result = await agentHandler(request);
    writeResponse(res, result);
  };
}

/** Express / Connect style: `app.use(graphewayExpress(handler))`. */
export function toExpressHandler(agentHandler: (req: AgentRequest) => Promise<AgentResponse>) {
  return (req: unknown, res: unknown, _next?: unknown) => {
    const expressReq = req as {
      method: string;
      originalUrl?: string;
      url: string;
      headers: Record<string, string | string[] | undefined>;
      body?: unknown;
    };
    const expressRes = res as {
      status: (c: number) => { json: (b: unknown) => void; send: (b: string) => void };
      set: (k: string, v: string) => void;
    };
    const request: AgentRequest = {
      method: expressReq.method,
      url: expressReq.originalUrl ?? expressReq.url,
      headers: expressReq.headers,
      body: expressReq.body,
    };
    agentHandler(request).then((result) => {
      for (const [k, v] of Object.entries(result.headers)) expressRes.set(k, v);
      const s = expressRes.status(result.status);
      if (result.contentType.includes("json")) s.json(JSON.parse(result.body || "null"));
      else s.send(result.body);
    });
  };
}

/**
 * Hono: `app.all("/agent*", toHonoHandler(handler))` or mount at root.
 * Note: await the body — `c.req.raw.body` is a ReadableStream, not parsed JSON.
 */
export function toHonoHandler(agentHandler: (req: AgentRequest) => Promise<AgentResponse>) {
  return async (c: unknown) => {
    const honoC = c as {
      req: {
        method: string;
        url: string;
        header: (k: string) => string | undefined;
        json: () => Promise<unknown>;
        text: () => Promise<string>;
      };
      newResponse: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => unknown;
    };
    const contentType = honoC.req.header("content-type") ?? "";
    let body: unknown;
    if (honoC.req.method === "POST" || honoC.req.method === "PUT") {
      body = contentType.includes("application/json")
        ? await honoC.req.json()
        : await honoC.req.text();
    }
    const request: AgentRequest = {
      method: honoC.req.method,
      url: honoC.req.url,
      headers: { "content-type": contentType },
      body,
    };
    const result = await agentHandler(request);
    return honoC.newResponse(result.body, {
      status: result.status,
      headers: { "content-type": result.contentType, ...result.headers },
    });
  };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function writeResponse(res: ServerResponse, result: AgentResponse) {
  res.statusCode = result.status;
  for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
  res.setHeader("content-type", result.contentType);
  res.end(result.body);
}
