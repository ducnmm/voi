import { RequireAuth } from "@/components/require-auth";
import { SessionForm } from "@/components/session-form";
export default function CreatePage() {
  return (
    <RequireAuth>
      <SessionForm />
    </RequireAuth>
  );
}
