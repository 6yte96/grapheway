import { AgentSetup } from "@/components/AgentSetup";
import { PROJECT_CONFIG } from "@/config";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: `Agent setup · ${PROJECT_CONFIG.brand.name}`,
  description:
    "Copy a prompt into Claude, Cursor, Codex or any coding agent to set up grapheway on your website, verify the agent surface and run the audit.",
  path: "/setup/",
  imageAlt: "Grapheway agent setup prompt",
});

export default function SetupPage() {
  return (
    <section className="projects-section" style={{ paddingTop: "2rem" }}>
      <h1 className="sr-only">Agent setup</h1>
      <AgentSetup full />
    </section>
  );
}
