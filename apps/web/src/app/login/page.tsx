import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { FullPageSpinner } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  // ?next=, ?error= 를 읽으므로 Suspense 안에 둔다 (cacheComponents)
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
