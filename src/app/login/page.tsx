import type { Metadata } from "next";
import { LoginView } from "@/components/account/LoginView";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create an account so your SAT vocab progress follows you to any device.",
};

export default function LoginPage() {
  return <LoginView />;
}
