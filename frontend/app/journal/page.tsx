import { Suspense } from "react";
import { JournalView } from "@/components/journal-view";

export default function Page() {
  return (
    <Suspense>
      <JournalView />
    </Suspense>
  );
}
