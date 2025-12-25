import { Suspense } from "react";
import NewFormClient from "./client";

export default function NewFormPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewFormClient />
    </Suspense>
  );
}
