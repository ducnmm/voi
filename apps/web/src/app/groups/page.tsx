import { RequireAuth } from "@/components/require-auth";
import { Dashboard } from "@/components/dashboard";
export default function GroupsPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
