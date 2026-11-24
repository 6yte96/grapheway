import { AgentSetup } from "@/components/AgentSetup";
import { PROJECT_CONFIG } from "@/config";

export const metadata = {
  title: `Agent setup · ${PROJECT_CONFIG.brand.name}`,
  description:
    "Copy a prompt into Claude, Cursor, Codex or any coding agent to set up grapheway on your website, verify the agent surface and run the audit.",
};

export default function SetupPage() {
  return (
    <section className="projects-section" style={{ paddingTop: "2rem" }}>
      <AgentSetup full />
    </section>
  );
}
