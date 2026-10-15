import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { FullPageSpinner } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "가입하기" };

export default function SignupPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
