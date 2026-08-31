/**
 * Known AI crawler user agents, split by intent.
 *
 * This taxonomy mirrors the 2025–2026 reality of how crawlers behave:
 *
 *  - **Training crawlers** bulk-collect content to build foundation models.
 *    Most sites keep these blocked.
 *  - **Search/retrieval crawlers** index content so it can be *cited* in
 *    AI answers (Google AI Overviews, Perplexity, Copilot, ChatGPT search).
 *    Blocking these removes you from AI citations — usually unwanted.
 *  - **User-triggered fetchers** fetch a page because a human asked their
 *    agent about it. `robots.txt` is advisory for these, but being explicit
 *    never hurts.
 */

export interface AgentUa {
  /** The User-Agent token to match in robots.txt. */
  token: string;
  /** Who owns the crawler. */
  vendor: string;
  /** What it is used for. */
  purpose: string;
}

/** Crawlers that bulk-collect content for model training. */
export const TRAINING_CRAWLERS: AgentUa[] = [
  { token: "GPTBot", vendor: "OpenAI", purpose: "training" },
  { token: "ClaudeBot", vendor: "Anthropic", purpose: "training" },
  { token: "CCBot", vendor: "Common Crawl", purpose: "training corpus" },
  { token: "Amazonbot", vendor: "Amazon", purpose: "training" },
  { token: "Meta-ExternalAgent", vendor: "Meta", purpose: "training" },
  { token: "Applebot-Extended", vendor: "Apple", purpose: "training opt-out token" },
  { token: "Google-Extended", vendor: "Google", purpose: "training opt-out token" },
  { token: "Bytespider", vendor: "ByteDance", purpose: "training" },
  { token: "cohere-ai", vendor: "Cohere", purpose: "training" },
  { token: "anthropic-ai", vendor: "Anthropic", purpose: "training" },
  { token: "Diffbot", vendor: "Diffbot", purpose: "knowledge graph" },
];

/** Crawlers that index content for retrieval in AI answers. */
export const SEARCH_CRAWLERS: AgentUa[] = [
  { token: "GPTBot", vendor: "OpenAI", purpose: "search retrieval" },
  { token: "OAI-SearchBot", vendor: "OpenAI", purpose: "search retrieval" },
  { token: "ClaudeBot", vendor: "Anthropic", purpose: "search retrieval" },
  { token: "Claude-SearchBot", vendor: "Anthropic", purpose: "search retrieval" },
  { token: "PerplexityBot", vendor: "Perplexity", purpose: "search retrieval" },
  { token: "Bingbot", vendor: "Microsoft", purpose: "search + Copilot" },
  { token: "Googlebot", vendor: "Google", purpose: "search + AI Overviews" },
  { token: "Applebot", vendor: "Apple", purpose: "search + Siri" },
  { token: "YouBot", vendor: "You.com", purpose: "search retrieval" },
];

/** User-triggered fetchers (agent acts on behalf of a human). */
export const USER_TRIGGERED: AgentUa[] = [
  { token: "ChatGPT-User", vendor: "OpenAI", purpose: "live fetch on user request" },
  { token: "Claude-User", vendor: "Anthropic", purpose: "live fetch on user request" },
  { token: "Google-Agent", vendor: "Google", purpose: "live fetch on user request" },
  { token: "Perplexity-User", vendor: "Perplexity", purpose: "live fetch on user request" },
];

/** All known AI user agents combined. */
export const ALL_AI_AGENTS: AgentUa[] = [
  ...TRAINING_CRAWLERS,
  ...SEARCH_CRAWLERS,
  ...USER_TRIGGERED,
].filter(
  // dedupe by token
  (ua, i, arr) => arr.findIndex((u) => u.token === ua.token) === i,
);
