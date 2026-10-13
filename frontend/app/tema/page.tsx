import { Suspense } from "react";
import { ThemeDetailView } from "@/components/themes-view";

export default function Page() {
  return (
    <Suspense>
      <ThemeDetailView />
    </Suspense>
  );
}
