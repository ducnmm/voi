"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginScreen } from "@/components/login-screen";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => { if (user) router.replace("/"); }, [user, router]);
  return user ? null : <LoginScreen />;
}
