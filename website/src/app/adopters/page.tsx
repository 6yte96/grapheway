import { LiveIndex } from "@/components/LiveIndex";
import { PROJECT_CONFIG } from "@/config";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: `Agent-Ready Index · ${PROJECT_CONFIG.brand.name}`,
  description:
    "Public sites that publish a machine-readable agent surface: knowledge graphs, llms.txt, agent cards and MCP endpoints.",
  path: "/adopters/",
  imageAlt: "The Grapheway Agent-Ready Index",
});

export default function AdoptersPage() {
  return (
    <section className="projects-section" style={{ paddingTop: "2rem" }}>
      <h1 className="sr-only">Agent-Ready Index</h1>
      <LiveIndex full />
    </section>
  );
}
