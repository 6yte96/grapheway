"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PROJECT_CONFIG } from "@/config";
import { HeroGraph } from "./HeroGraph";

export function Hero() {
  const { hero, install, agentSetup } = PROJECT_CONFIG;
  const [selectedManager, setSelectedManager] = useState(
    install.defaultManager || "npm"
  );
  const [copied, setCopied] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const currentCommand =
    install.managers[selectedManager] || `npm install ${PROJECT_CONFIG.brand.name}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handlePromptCopy = async () => {
    try {
      await navigator.clipboard.writeText(agentSetup.prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {}
  };

  useEffect(() => {
    if (!promptOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPromptOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [promptOpen]);

  return (
    <section className="hero">
      <div className="hero-content">
        <div className="issue-line">
          <span className="issue-badge">{hero.issueBadge}</span>
          <span className="hero-beta-tag">
            <span className="beta-pulse" />
            Public Beta
          </span>
        </div>

        <h1 className="hero-title">
          <span>{hero.titleLines.before}</span>
          <br />
          <span className="gradient-text">{hero.titleLines.highlight}</span>
          <br />
          <span>{hero.titleLines.after}</span>
        </h1>

        <p className="hero-description">{hero.description}</p>

        {/* Installation Bar with Package Manager Tabs */}
        <div style={{ marginTop: "2rem" }}>
          <div className="install-tabs">
            {Object.keys(install.managers).map((manager) => (
              <button
                key={manager}
                type="button"
                onClick={() => setSelectedManager(manager)}
                className={`install-tab-btn ${
                  selectedManager === manager ? "active" : ""
                }`}
              >
                {manager}
              </button>
            ))}
          </div>

          <div className="install-box">
            <div className="install-box-code">
              <span className="prompt">$</span>
              <span>{currentCommand}</span>
            </div>
            <button
              onClick={handleCopy}
              className={`copy-btn ${copied ? "copied" : ""}`}
              title="Copy installation command"
            >
              <i
                className={`fas ${
                  copied ? "fa-check" : "fa-copy"
                }`}
              ></i>
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginTop: "1.75rem",
          }}
        >
          <a href={hero.primaryCta.href} className="btn-broadsheet-primary">
            <span>{hero.primaryCta.text}</span>
            <i
              className="fas fa-arrow-right"
              style={{ marginLeft: "0.5rem", fontSize: "10px" }}
            ></i>
          </a>
          <a
            href={hero.secondaryCta.href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-broadsheet-outline"
          >
            <i
              className="fab fa-github"
              style={{ marginRight: "0.45rem", fontSize: "12px" }}
            ></i>
            <span>{hero.secondaryCta.text}</span>
          </a>
          <button
            type="button"
            onClick={() => setPromptOpen((open) => !open)}
            className="btn-broadsheet-outline hero-agent-trigger"
            aria-expanded={promptOpen}
            aria-controls="hero-agent-prompt"
            title="Open the agent setup prompt"
          >
            <i
              className="fas fa-terminal"
              style={{ marginRight: "0.45rem", fontSize: "11px" }}
            ></i>
            <span>Prompt for Agent</span>
            <i
              className={`fas fa-chevron-${promptOpen ? "up" : "down"}`}
              style={{ marginLeft: "0.5rem", fontSize: "9px" }}
            ></i>
          </button>
        </div>

        {promptOpen ? (
          <div id="hero-agent-prompt" className="hero-agent-prompt-dropdown">
            <div className="hero-agent-prompt-head">
              <span>AGENT SETUP PROMPT</span>
              <button
                type="button"
                onClick={handlePromptCopy}
                className={`copy-btn ${promptCopied ? "copied" : ""}`}
              >
                <i
                  className={`fas ${promptCopied ? "fa-check" : "fa-copy"}`}
                  aria-hidden="true"
                />
                <span>{promptCopied ? "Copied" : "Copy prompt"}</span>
              </button>
            </div>
            <pre>{agentSetup.prompt}</pre>
            <div className="hero-agent-prompt-actions">
              <Link href={agentSetup.ctaHref} className="hero-agent-prompt-link">
                {agentSetup.cta}
                <i className="fas fa-arrow-right" aria-hidden="true" />
              </Link>
              <span>Copy, paste into your coding agent, then follow its output.</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="hero-visual">
        <HeroGraph />
      </div>
    </section>
  );
}
