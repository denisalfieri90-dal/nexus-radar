import { Suspense } from "react";
import { DecoderView } from "@/components/decoder-view";

export default function Page() {
  return (
    <Suspense>
      <DecoderView />
    </Suspense>
  );
}
