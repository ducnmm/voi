"use client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Avatar, skillLabels } from "@/components/primitives";
import { Icon } from "@/components/icon";
import { useResource } from "@/lib/use-resource";
import { useAuth } from "@/lib/auth";
import { request } from "@/lib/api-client";
import type { PublicUser, Review } from "@/lib/api-types";
import { ErrorNote, Spinner } from "@/components/ui";
type Profile = PublicUser & {
  hostedCount: number;
  joinedCount: number;
  averageRating: number | null;
  reviewCount: number;
  followerCount: number;
  followingCount: number;
};
export default function PersonPage() {
  return (
    <RequireAuth>
      <PersonDetail />
    </RequireAuth>
  );
}
function PersonDetail() {
  const { t } = useI18n();

  const { userId } = useParams<{ userId: string }>();
  const { token, user } = useAuth();
  const profile = useResource<{ profile: Profile }>(`/users/${userId}/profile`);
  const reviews = useResource<{ reviews: Review[] }>(
    `/users/${userId}/reviews`,
  );
  const follows = useResource<{ users: PublicUser[] }>("/me/following");
  const [busy, setBusy] = useState(false);
  if (!profile.data)
    return profile.error ? <ErrorNote message={profile.error} /> : <Spinner />;
  const person = profile.data.profile;
  const following = follows.data?.users.some((p) => p.id === userId);
  return (
    <div className="stack form-section">
      <Link href="/people" className="row muted" style={{ fontSize: "var(--type-footnote)" }}>
        <Icon name="arrow" size={16} />
        {t("Người chơi")}
      </Link>
      <section className="card stack" style={{ padding: 28 }}>
        <div className="row">
          <Avatar name={person.displayName} url={person.avatarUrl} size={72} />
          <div>
            <h1>{person.displayName}</h1>
            <p className="muted" style={{ fontSize: "var(--type-footnote)", marginTop: 8 }}>
              {t(skillLabels[person.defaultSkillLevel])}
            </p>
          </div>
        </div>
        <div
          className="row spread wrap"
          style={{
            padding: "20px 0",
            borderTop: "1px solid var(--color-line)",
            borderBottom: "1px solid var(--color-line)",
          }}
        >
          {[
            [person.joinedCount, t("Kèo đã tham gia")],
            [person.hostedCount, t("Kèo đã tổ chức")],
            [person.averageRating?.toFixed(1) ?? "—", t("Điểm đánh giá")],
            [person.followerCount, t("Người theo dõi")],
          ].map(([value, label]) => (
            <div key={label}>
              <strong style={{ fontSize: "var(--type-stat)" }}>{value}</strong>
              <p className="muted" style={{ fontSize: "var(--type-caption)", marginTop: 6 }}>
                {t(String(label))}
              </p>
            </div>
          ))}
        </div>
        {user?.id !== userId && (
          <button
            className={`btn ${following ? "btn-secondary" : "btn-primary"}`}
            disabled={busy || !follows.data}
            onClick={async () => {
              setBusy(true);
              profile.setError("");
              try {
                await request(`/users/${userId}/follow`, {
                  token,
                  method: following ? "DELETE" : "PUT",
                });
                await follows.reload();
                await profile.reload();
              } catch (err) {
                profile.setError(
                  err instanceof Error ? err.message : t("Không thể theo dõi."),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {following ? t("Đang theo dõi") : t("Theo dõi")}
          </button>
        )}
        {profile.error && <ErrorNote message={profile.error} />}
      </section>
      <section className="card">
        <h2>
          {t("Đánh giá · ")}
          {person.reviewCount}
        </h2>
        {reviews.error && <ErrorNote message={reviews.error} />}
        {reviews.loading ? (
          <Spinner />
        ) : reviews.data?.reviews.length === 0 ? (
          <p className="muted" style={{ fontSize: "var(--type-footnote)", marginTop: 18 }}>
            {t("Chưa có đánh giá. Những buổi chơi sẽ kể câu chuyện của bạn.")}
          </p>
        ) : (
          reviews.data?.reviews.map((review) => (
            <article
              className="list-row"
              style={{ alignItems: "flex-start" }}
              key={review.id}
            >
              <Avatar
                name={review.author.displayName}
                url={review.author.avatarUrl}
              />
              <div className="grow">
                <h3 style={{ fontSize: "var(--type-footnote)" }}>{review.author.displayName}</h3>
                <p style={{ color: "var(--color-accent)" }}>
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </p>
                {review.comment && (
                  <p style={{ color: "var(--color-ink)", lineHeight: "var(--leading-body)" }}>
                    {review.comment}
                  </p>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
