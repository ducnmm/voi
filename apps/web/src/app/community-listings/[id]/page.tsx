"use client";
import { useParams } from "next/navigation";
import { CommunityListingView } from "@/components/community-listing-view";

export default function CommunityListingPage() {
  const { id } = useParams<{ id: string }>();
  return <CommunityListingView id={id} />;
}
