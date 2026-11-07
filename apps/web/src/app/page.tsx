import { RequireAuth } from "@/components/require-auth";
import { SessionsFeed } from "@/components/sessions-feed";
export default function HomePage() {
  return (
    <RequireAuth>
      <SessionsFeed />
    </RequireAuth>
  );
}
