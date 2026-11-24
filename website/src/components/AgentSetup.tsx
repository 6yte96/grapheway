"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { PROJECT_CONFIG } from "@/config";

export function AgentSetup({ full = false }: { full?: boolean }) {
  const { agentSetup } = PROJECT_CONFIG;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(agentSetup.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable in insecure contexts; the prompt is still
      // selectable on screen.
    }
  };

  const handlePromptKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void handleCopy();
    }
  };

  return (
    <section id="agent-setup" className="projects-section" style={{ paddingTop: "1rem" }}>
      <div className="section-header">
        <div className="section-header-left">
          <h2 className="section-title">{agentSetup.title}</h2>
          <p className="section-description">{agentSetup.subtitle}</p>
        </div>
        <span className="index-live-pill">
          <span className="index-live-dot" aria-hidden="true" />
          FOR AGENTS
        </span>
      </div>

      <div className="agent-setup-grid">
        <div className="agent-prompt-card">
          <div className="agent-prompt-head">
            <span>AGENT PROMPT</span>
            <span className="agent-prompt-hint">click text to copy</span>
            <button
              type="button"
              onClick={handleCopy}
              className={`copy-btn ${copied ? "copied" : ""}`}
              title="Copy the agent prompt"
            >
              <i className={`fas ${copied ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
              <span>{copied ? "Copied" : "Copy prompt"}</span>
            </button>
          </div>
          <pre
            className="agent-prompt-body"
            onClick={handleCopy}
            onKeyDown={handlePromptKey}
            role="button"
            tabIndex={0}
            title="Click to copy the prompt"
            aria-label="Copy the agent setup prompt"
          >
            {agentSetup.prompt}
          </pre>
          <p className="agent-prompt-note">
            <i className="fas fa-shield-halved" aria-hidden="true" />
            {agentSetup.note}
          </p>
        </div>

        <aside className="agent-setup-side">
          {full ? (
            <>
              <h3>What the agent does</h3>
              <ol className="agent-step-list">
                {agentSetup.fullSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          ) : null}

          <h3>{agentSetup.fallbackTitle}</h3>
          <ul className="agent-fallback-list">
            {agentSetup.fallbacks.map((fallback) => (
              <li key={fallback}>{fallback}</li>
            ))}
          </ul>

          <div className="agent-setup-actions">
            {full ? (
              <Link href="/docs" className="support-btn primary">
                <i className="fas fa-book" aria-hidden="true" />
                <span>Read the docs</span>
              </Link>
            ) : (
              <Link href={agentSetup.ctaHref} className="support-btn primary">
                <i className="fas fa-arrow-right" aria-hidden="true" />
                <span>{agentSetup.cta}</span>
              </Link>
            )}
            {full ? (
              <Link href="/" className="support-btn">
                <i className="fas fa-arrow-left" aria-hidden="true" />
                <span>Back to home</span>
              </Link>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
