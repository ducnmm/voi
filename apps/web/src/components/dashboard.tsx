"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SkillLevel } from "@voi/shared";
import { useAuth } from "@/lib/auth";
import { ApiError, api } from "@/lib/api-client";
import type { GroupSummary } from "@/lib/api-types";
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Spinner
} from "./ui";

const SKILL_LEVELS: SkillLevel[] = ["OPEN", "BEGINNER", "INTERMEDIATE", "ADVANCED"];

export function Dashboard() {
  const { token, user } = useAuth();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const result = await api.listGroups(token);
      setGroups(result.groups);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load groups.");
      setGroups([]);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hi, ${user?.displayName ?? "there"} 👋`}
        subtitle="Your badminton groups and upcoming sessions."
        action={
          <Button variant="secondary" onClick={() => setCreating((v) => !v)}>
            {creating ? "Close" : "New group"}
          </Button>
        }
      />

      {creating ? (
        <CreateGroupForm
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      ) : null}

      {error ? <ErrorNote message={error} /> : null}

      {groups === null ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">
            No groups yet. Create your first group to start scheduling sessions.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{group.name}</h2>
                    {group.description ? (
                      <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                        {group.description}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone="blue">{group.defaultSkillLevel}</Badge>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-[var(--color-muted)]">
                  <span>{group.memberCount} members</span>
                  {group.upcomingSessionCount !== undefined ? (
                    <span>{group.upcomingSessionCount} upcoming</span>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateGroupForm({ onCreated }: { onCreated: () => void }) {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("OPEN");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.createGroup(token, {
        name: name.trim(),
        description: description.trim() || undefined,
        defaultSkillLevel: skillLevel
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create group.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Field label="Group name">
          <Input
            required
            value={name}
            placeholder="Thursday Smashers"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Description" hint="Optional">
          <Input
            value={description}
            placeholder="Weekly doubles at District 7"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Default skill level">
          <select
            className="rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
          >
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </Field>
        {error ? <ErrorNote message={error} /> : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create group"}
        </Button>
      </form>
    </Card>
  );
}
