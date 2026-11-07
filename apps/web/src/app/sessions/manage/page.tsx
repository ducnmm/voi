import { RequireAuth } from "@/components/require-auth";
import { SessionsFeed } from "@/components/sessions-feed";
export default function ManagePage() {
  return (
    <RequireAuth>
      <SessionsFeed manage />
    </RequireAuth>
  );
}
