import { Suspense } from "react";
import { SettingsView } from "@/components/settings-view";

export default function Page() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
