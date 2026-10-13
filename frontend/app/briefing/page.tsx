import { Suspense } from "react";
import { BriefingView } from "@/components/briefing-view";

export default function Page() {
  return (
    <Suspense>
      <BriefingView />
    </Suspense>
  );
}
