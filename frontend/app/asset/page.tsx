import { Suspense } from "react";
import { AssetView } from "@/components/asset-view";

export default function Page() {
  return (
    <Suspense>
      <AssetView />
    </Suspense>
  );
}
