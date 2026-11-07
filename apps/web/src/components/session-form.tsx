"use client";
import { Select } from "@/components/select";
import { mediaSource } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SkillLevel } from "@voi/shared";
import { useAuth } from "@/lib/auth";
import {
  api,
  request,
  uploadImage,
  type CreateSessionInput,
} from "@/lib/api-client";
import { useResource } from "@/lib/use-resource";
import type { GroupSummary, SessionDetail } from "@/lib/api-types";
import { Icon } from "./icon";
import { Title, skillLabels } from "./primitives";
import { SessionMap } from "./session-map";
import { ErrorNote, Spinner } from "./ui";
function localTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function SessionForm({
  groupId: initialGroup,
  session,
  duplicate = false,
  onSaved,
}: {
  groupId?: string;
  session?: SessionDetail;
  duplicate?: boolean;
  onSaved?: (session: SessionDetail) => void;
}) {
  const { t } = useI18n();

  const { token } = useAuth();
  const router = useRouter();
  const groups = useResource<{ groups: GroupSummary[] }>("/groups");
  const offset = duplicate ? 7 * 86400000 : 0;
  const [groupId, setGroupId] = useState(
    initialGroup ?? session?.groupId ?? "",
  );
  const [title, setTitle] = useState(session?.title ?? "");
  const [venue, setVenue] = useState(session?.venueName ?? "");
  const [start, setStart] = useState(
    localTime(
      new Date(
        (session
          ? new Date(session.startsAt).getTime()
          : Date.now() + 86400000) + offset,
      ),
    ),
  );
  const [end, setEnd] = useState(
    localTime(
      new Date(
        (session ? new Date(session.endsAt).getTime() : Date.now() + 93600000) +
          offset,
      ),
    ),
  );
  const [courts, setCourts] = useState(session?.courtCount ?? 2);
  const [players, setPlayers] = useState(session?.maxPlayers ?? 8);
  const [skill, setSkill] = useState<SkillLevel>(
    session?.skillLevel ?? "INTERMEDIATE",
  );
  const [fixed, setFixed] = useState(
    !session || session.feePerPlayerVnd != null,
  );
  const [price, setPrice] = useState(session?.feePerPlayerVnd ?? 80000);
  const [courtFee, setCourtFee] = useState(session?.feeTotalVnd ?? 240000);
  const [shuttles, setShuttles] = useState(
    session?.shuttlecockCostVnd ?? 60000,
  );
  const [images, setImages] = useState<string[]>(session?.imageUrls ?? []);
  const [visibility, setVisibility] = useState(
    session?.visibility ?? "PRIVATE_LINK",
  );
  const [weekly, setWeekly] = useState(false);
  const [created, setCreated] = useState<SessionDetail[]>([]);
  const [latitude, setLatitude] = useState(session?.venueLat?.toString() ?? "");
  const [longitude, setLongitude] = useState(
    session?.venueLng?.toString() ?? "",
  );
  const [pickLocation, setPickLocation] = useState(false);
  const [note, setNote] = useState(session?.venueNote ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const editing = Boolean(session && !duplicate);
  const selectedGroup = groupId || groups.data?.groups[0]?.id || "";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      if (new Date(end) <= new Date(start))
        throw new Error(t("Giờ kết thúc phải sau giờ bắt đầu."));
      const input: CreateSessionInput = {
        title: title.trim() || undefined,
        venueName: venue.trim(),
        venueNote: note.trim() || undefined,
        ...(latitude !== "" && longitude !== ""
          ? { venueLat: Number(latitude), venueLng: Number(longitude) }
          : {}),
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        courtCount: courts,
        maxPlayers: players,
        skillLevel: skill,
        visibility,
        costTrackingEnabled: true,
        feeTotalVnd: fixed ? 0 : courtFee,
        shuttlecockCostVnd: fixed ? 0 : shuttles,
        ...(fixed ? { feePerPlayerVnd: price } : {}),
        imageUrls: images,
      };
      if ((latitude === "") !== (longitude === ""))
        throw new Error(t("Vui lòng nhập đủ vĩ độ và kinh độ."));
      if (
        latitude &&
        (Number(latitude) < -90 ||
          Number(latitude) > 90 ||
          Number(longitude) < -180 ||
          Number(longitude) > 180)
      )
        throw new Error(t("Tọa độ không hợp lệ."));
      const result = editing
        ? await request<{ session: SessionDetail }>(
            `/sessions/${session!.id}`,
            {
              token,
              method: "PATCH",
              body: {
                ...input,
                feePerPlayerVnd: fixed ? price : null,
                venueLat: latitude ? Number(latitude) : null,
                venueLng: longitude ? Number(longitude) : null,
              },
            },
          )
        : await api.createSession(token, selectedGroup, input);
      if (!editing && weekly) {
        const successful = [result.session];
        try {
          for (let week = 1; week <= 3; week++) {
            const nextStart = new Date(start);
            nextStart.setDate(nextStart.getDate() + week * 7);
            const nextEnd = new Date(end);
            nextEnd.setDate(nextEnd.getDate() + week * 7);
            const next = await api.createSession(token, selectedGroup, {
              ...input,
              startsAt: nextStart.toISOString(),
              endsAt: nextEnd.toISOString(),
            });
            successful.push(next.session);
          }
        } catch (err) {
          setCreated(successful);
          throw new Error(
            t("Đã tạo {0}/4 kèo. {1}", [
              successful.length,
              err instanceof Error
                ? err.message
                : "Không tạo được các tuần tiếp theo.",
            ]),
          );
        }
      }
      onSaved?.(result.session);
      router.push(`/sessions/${result.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Không thể lưu kèo."));
      setBusy(false);
    }
  }
  if (created.length)
    return (
      <div className="stack form-section">
        <Title
          title={t("Lịch lặp được tạo một phần")}
          subtitle={t("Các kèo đã tạo được giữ lại để tránh tạo trùng.")}
        />
        <ErrorNote message={error} />
        {created.map((item) => (
          <Link className="card" key={item.id} href={`/sessions/${item.id}`}>
            {item.title || item.venueName} {t(" ·")}{" "}
            {new Date(item.startsAt).toLocaleDateString(t("vi-VN"))} {t("→")}
          </Link>
        ))}
        <Link className="btn btn-primary" href="/">
          {t("Về danh sách kèo")}
        </Link>
      </div>
    );
  if (groups.loading) return <Spinner />;
  return (
    <div className="stack form-section">
      <Link
        href={session ? `/sessions/${session.id}` : "/"}
        className="row muted"
        style={{ fontSize: "var(--type-footnote)" }}
      >
        <Icon name="arrow" size={16} />
        {t("Quay lại")}
      </Link>
      <Title
        title={
          editing
            ? t("Chỉnh sửa kèo")
            : duplicate
              ? t("Hẹn kèo tuần sau")
              : t("Tạo kèo mới")
        }
      />
      {groups.error && <ErrorNote message={groups.error} />}
      {!groups.data?.groups.length ? (
        <div className="notice">
          {t("Bạn cần có nhóm trước khi tạo kèo.")}{" "}
          <Link href="/groups" style={{ textDecoration: "underline" }}>
            {t("Tạo nhóm của bạn →")}
          </Link>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <section className="card">
            <h2>{t("Thông tin kèo")}</h2>
            <div className="form-grid" style={{ marginTop: 20 }}>
              <label className="full">
                {t("Nhóm")}
                <Select
                  disabled={editing}
                  value={selectedGroup}
                  onValueChange={(value) => setGroupId(value)}
                >
                  {groups.data.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="full">
                {t("Tên kèo")}
                <input
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("Cầu lông tối thứ Ba")}
                />
              </label>
              <label>
                {t("Sân cầu lông")}
                <input
                  required
                  maxLength={120}
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder={t("Tên sân của bạn")}
                />
              </label>
              <label>
                {t("Trình độ")}
                <Select
                  value={skill}
                  onValueChange={(value) => setSkill(value as SkillLevel)}
                >
                  {Object.entries(skillLabels).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </section>
          <section className="card stack">
            <h2>{t("Địa điểm")}</h2>
            <label>
              {t("Ghi chú về sân")}
              <textarea
                maxLength={240}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("Cổng vào, số sân hoặc lưu ý cho mọi người…")}
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              aria-expanded={pickLocation}
              onClick={() => setPickLocation(!pickLocation)}
            >
              <Icon name="pin" size={18} />
              {latitude
                ? t("Chỉnh vị trí trên bản đồ")
                : t("Chọn vị trí trên bản đồ")}
            </button>
            {pickLocation && (
              <>
                <p className="muted" style={{ fontSize: "var(--type-footnote)" }}>
                  {t("Chạm lên bản đồ để ghim sân, hoặc nhập tọa độ bên dưới.")}
                </p>
                <SessionMap
                  sessions={[]}
                  pick={(lat, lng) => {
                    setLatitude(lat.toFixed(6));
                    setLongitude(lng.toFixed(6));
                  }}
                  location={
                    latitude && longitude
                      ? { lat: Number(latitude), lng: Number(longitude) }
                      : undefined
                  }
                />
                <div className="form-grid">
                  <label>
                    {t("Vĩ độ")}
                    <input
                      type="number"
                      step="any"
                      min={-90}
                      max={90}
                      value={latitude}
                      onChange={(event) => setLatitude(event.target.value)}
                    />
                  </label>
                  <label>
                    {t("Kinh độ")}
                    <input
                      type="number"
                      step="any"
                      min={-180}
                      max={180}
                      value={longitude}
                      onChange={(event) => setLongitude(event.target.value)}
                    />
                  </label>
                </div>
              </>
            )}
          </section>
          <section className="card">
            <h2>{t("Ảnh buổi chơi")}</h2>
            <p className="muted" style={{ fontSize: "var(--type-footnote)", margin: "8px 0 16px" }}>
              {t("Tối đa 6 ảnh, mỗi ảnh không quá 8 MB.")}
            </p>
            <div className="photo-strip">
              {images.map((url, i) => (
                <div key={url} style={{ position: "relative" }}>
                  <img src={mediaSource(url)} alt={t("Ảnh {0}", [i + 1])} />
                  <button
                    type="button"
                    aria-label={t("Xóa ảnh {0}", [i + 1])}
                    onClick={() =>
                      setImages(images.filter((_, index) => index !== i))
                    }
                    className="icon-btn"
                    style={{
                      position: "absolute",
                      right: 2,
                      top: 2,
                      width: 24,
                      height: 24,
                    }}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
            <input
              type="file"
              aria-label={t("Thêm ảnh kèo")}
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              disabled={uploading || images.length >= 6 || busy}
              style={{ marginTop: 12 }}
              onChange={async (event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (!token) return;
                setUploading(true);
                setError("");
                const urls: string[] = [];
                try {
                  if (files.length + images.length > 6)
                    throw new Error(t("Chỉ được chọn tối đa 6 ảnh."));
                  for (const file of files) {
                    if (file.size > 8 * 1024 * 1024)
                      throw new Error(
                        t("Ảnh quá lớn. Vui lòng chọn ảnh dưới 8 MB."),
                      );
                    urls.push(await uploadImage(token, file));
                  }
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : t("Không thể tải ảnh."),
                  );
                } finally {
                  setImages((current) => [...current, ...urls]);
                  setUploading(false);
                }
              }}
            />
            {uploading && (
              <p
                className="muted"
                role="status"
                style={{ fontSize: "var(--type-footnote)", marginTop: 8 }}
              >
                {t("Đang tải ảnh…")}
              </p>
            )}
          </section>
          <section className="card">
            <h2>{t("Thời gian & số lượng")}</h2>
            {!editing && (
              <label className="toggle-row" style={{ marginTop: 20 }}>
                <span>
                  <strong>{t("Lặp hằng tuần")}</strong>
                  <small>{t("Tạo kèo này và 3 tuần tiếp theo.")}</small>
                </span>
                <input
                  className="switch"
                  type="checkbox"
                  role="switch"
                  checked={weekly}
                  onChange={(event) => setWeekly(event.target.checked)}
                />
              </label>
            )}
            <div className="form-grid" style={{ marginTop: 20 }}>
              <label>
                {t("Bắt đầu")}
                <input
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                {t("Kết thúc")}
                <input
                  type="datetime-local"
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <label>
                {t("Số sân")}
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={courts}
                  onChange={(e) => setCourts(Number(e.target.value))}
                />
              </label>
              <label>
                {t("Số người tối đa")}
                <input
                  type="number"
                  min={1}
                  max={80}
                  required
                  value={players}
                  onChange={(e) => setPlayers(Number(e.target.value))}
                />
              </label>
            </div>
          </section>
          <section className="card">
            <h2>{t("Chi phí")}</h2>
            <div
              className="segmented"
              style={{ margin: "18px 0", width: "100%" }}
            >
              <button
                type="button"
                className={fixed ? "active" : ""}
                onClick={() => setFixed(true)}
                style={{ flex: 1 }}
              >
                {t("Giá mỗi người")}
              </button>
              <button
                type="button"
                className={!fixed ? "active" : ""}
                onClick={() => setFixed(false)}
                style={{ flex: 1 }}
              >
                {t("Chia chi phí")}
              </button>
            </div>
            <div className="form-grid">
              {fixed ? (
                <label className="full">
                  {t("Giá mỗi người (VND)")}
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                  />
                </label>
              ) : (
                <>
                  <label>
                    {t("Tiền sân (VND)")}
                    <input
                      type="number"
                      min={0}
                      required
                      value={courtFee}
                      onChange={(e) => setCourtFee(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    {t("Tiền cầu (VND)")}
                    <input
                      type="number"
                      min={0}
                      required
                      value={shuttles}
                      onChange={(e) => setShuttles(Number(e.target.value))}
                    />
                  </label>
                </>
              )}
              <label className="full">
                {t("Ai có thể xem?")}
                <Select
                  value={visibility}
                  onValueChange={(value) =>
                    setVisibility(value as typeof visibility)
                  }
                >
                  <option value="PRIVATE_LINK">
                    {t("Người có đường link")}
                  </option>
                  <option value="GROUP_ONLY">
                    {t("Thành viên trong nhóm")}
                  </option>
                </Select>
              </label>
            </div>
          </section>
          {error && <ErrorNote message={error} />}
          <button className="btn btn-primary" disabled={busy || uploading}>
            {busy
              ? t("Đang lưu…")
              : editing
                ? t("Lưu thay đổi")
                : t("Tạo kèo & rủ bạn")}
          </button>
        </form>
      )}
    </div>
  );
}
