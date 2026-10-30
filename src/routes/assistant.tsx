// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/fdr/ui";
import { AssistantPanel } from "@/components/fdr/Assistant";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "Ask Your Records — ZenithFDR" },
      { name: "description", content: "Ask rule-based questions about the fixed deposit records and see how each answer was computed." },
      { property: "og:title", content: "Ask Your Records — ZenithFDR" },
      { property: "og:description", content: "Ask rule-based questions about the fixed deposit records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  return (
    <>
      <PageHeader title="Ask Your Records" subtitle="Natural-language style answers computed by fixed rules over the demo dataset." />
      <Panel className="mx-auto max-w-3xl" bodyClass="p-4">
        <div className="h-[560px]">
          <AssistantPanel />
        </div>
      </Panel>
    </>
  );
}
