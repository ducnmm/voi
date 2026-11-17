"use client";
import { useAuth } from "@/lib/auth";
import { CommunityFeed } from "@/components/community-feed";
import { SessionsFeed } from "@/components/sessions-feed";
export default function HomePage() {
  const { user } = useAuth();
  return user ? <SessionsFeed /> : <CommunityFeed />;
}
