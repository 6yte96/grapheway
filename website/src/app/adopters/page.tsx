import { LiveIndex } from "@/components/LiveIndex";
import { PROJECT_CONFIG } from "@/config";

export const metadata = {
  title: `Agent-Ready Index · ${PROJECT_CONFIG.brand.name}`,
  description:
    "Public sites that publish a machine-readable agent surface: knowledge graphs, llms.txt, agent cards and MCP endpoints.",
};

export default function AdoptersPage() {
  return (
    <section className="projects-section" style={{ paddingTop: "2rem" }}>
      <LiveIndex full />
    </section>
  );
}
