import { Suspense } from "react";
import { ThemesList } from "@/components/themes-view";

export default function Page() {
  return (
    <Suspense>
      <ThemesList />
    </Suspense>
  );
}
