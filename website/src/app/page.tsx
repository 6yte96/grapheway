import { Hero } from "@/components/Hero";
import { Playground } from "@/components/Playground";
import { FeatureBento } from "@/components/FeatureBento";
import { Benchmarks } from "@/components/Benchmarks";
import { Architecture } from "@/components/Architecture";
import { Support } from "@/components/Support";

/**
 * Section order follows the reader's question order, not the org chart:
 *   Hero       What is it, how do I run it
 *   Playground What happens when I run it (real output)
 *   Features   What it does
 *   Benchmarks Why pick this one (only if you have real numbers)
 *   Source     How it works inside, how to contribute
 *   Support    The ask: star, share, sponsor
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <Playground />
      <FeatureBento />
      <Benchmarks />
      <Architecture />
      <Support />
    </>
  );
}
