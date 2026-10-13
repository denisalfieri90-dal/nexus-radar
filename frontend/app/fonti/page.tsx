import { Suspense } from "react";
import { SourcesView } from "@/components/sources-view";

export default function Page() {
  return (
    <Suspense>
      <SourcesView />
    </Suspense>
  );
}
