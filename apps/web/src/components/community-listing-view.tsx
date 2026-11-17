"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CommunityListingDTO } from "@voi/shared";
import { ApiError, publicRequest } from "@/lib/api-client";
import { communityContactHref, communityDate, communityFee, communitySkillLabels, communitySourceHref, communityStatusLabels, communityTime } from "@/lib/community-listings";
import { useI18n } from "@/lib/i18n";
import { usePublicResource } from "@/lib/use-public-resource";
import { Dialog } from "./dialog";
import { Icon } from "./icon";
import { Empty } from "./primitives";
import { Select } from "./select";

const reportTypes = {
  WRONG_INFO: "Thông tin không đúng",
  FULL: "Đã đủ người",
  CANCELLED: "Kèo đã hủy",
  REMOVAL_REQUEST: "Yêu cầu gỡ bài",
};

export function CommunityListingView({ id }: { id: string }) {
  const { t } = useI18n();
  const { data, error, loading, reload } = usePublicResource<{ listing: CommunityListingDTO }>(`/community-listings/${encodeURIComponent(id)}`);
  return <div className="community-surface">
    <Link className="community-back" href="/"><Icon name="chevron" size={14} />{t("Khám phá")}</Link>
    {loading && <div className="loading" role="status">{t("Đang tải…")}</div>}
    {error?.status === 404 ? <Empty icon="search" title={t("Kèo không còn hiển thị")} action={<Link className="btn btn-primary" href="/discover">{t("Khám phá kèo khác")}</Link>}>{t("Bài này đã được gỡ hoặc không còn được chia sẻ công khai.")}</Empty> : error && <div className="community-error" role="alert"><p>{t("Không thể tải kèo cộng đồng. Vui lòng thử lại.")}</p><button className="btn btn-secondary" onClick={reload}>{t("Thử lại")}</button></div>}
    {data && <ListingContent listing={data.listing} />}
  </div>;
}

function ListingContent({ listing }: { listing: CommunityListingDTO }) {
  const { t, locale } = useI18n();
  const [reportOpen, setReportOpen] = useState(false);
  const reportTrigger = useRef<HTMLButtonElement>(null);
  const viewed = useRef<string | null>(null);
  const track = (event: { type: "VIEW" } | { type: "CONTACT"; contactType: "SOURCE" | "ZALO" | "PHONE" | "FACEBOOK" }) => {
    void publicRequest(`/community-listings/${encodeURIComponent(listing.id)}/events`, { method: "POST", body: event }).catch(() => {});
  };
  useEffect(() => {
    if (viewed.current === listing.id) return;
    viewed.current = listing.id;
    void publicRequest(`/community-listings/${encodeURIComponent(listing.id)}/events`, { method: "POST", body: { type: "VIEW" } }).catch(() => {});
  }, [listing.id]);
  const sourceUrl = communitySourceHref(listing.sourceUrl);
  const contacts = listing.contacts.flatMap((contact) => {
    const href = communityContactHref(contact);
    return href ? [{ ...contact, href }] : [];
  });
  const active = listing.effectiveStatus === "OPEN";
  return <article className="community-detail">
    <header className="community-detail-header">
      <div className="community-source"><Icon name="globe" size={16} /><span>{listing.source.name}</span></div>
      <h1>{listing.title}</h1>
      <span className={`community-status ${active ? "is-open" : ""}`}>{t(communityStatusLabels[listing.effectiveStatus])}</span>
    </header>
    <div className="community-detail-grid">
      <div className="stack">
        {listing.stale && <div className="community-stale"><Icon name="clock" size={18} /><strong>{t("Thông tin chưa được cập nhật gần đây")}</strong></div>}
        <section className="card community-details" aria-label={t("Thông tin kèo")}>
          <dl>
            <div><dt><Icon name="calendar" size={19} />{t("Thời gian")}</dt><dd>{listing.startsAt ? communityDate(listing.startsAt, listing.timeZone, locale) : t("Chưa rõ ngày")}<span>{communityTime(listing, locale, t)}</span>{listing.timeZone === "Asia/Ho_Chi_Minh" && <small>{t("Giờ Việt Nam")}</small>}</dd></div>
            <div><dt><Icon name="pin" size={19} />{t("Sân")}</dt><dd>{listing.venueName || t("Chưa rõ sân")}<span>{listing.venueAddress || t("Chưa rõ địa chỉ chi tiết")}</span><small>{listing.areaLabel || listing.areaCode || t("Chưa rõ khu vực")}</small></dd></div>
            <div><dt><Icon name="badminton" size={19} />{t("Trình độ")}</dt><dd>{listing.skillText || t(communitySkillLabels[listing.skillLevel])}</dd></div>
            <div><dt><Icon name="info" size={19} />{t("Phí")}</dt><dd>{communityFee(listing, locale, t)}</dd></div>
            <div><dt><Icon name="people" size={19} />{t("Số người tuyển")}</dt><dd>{listing.requestedPlayers === null ? t("Chưa rõ số người tuyển") : t("Bài đăng tuyển {0} người", [listing.requestedPlayers])}</dd></div>
          </dl>
        </section>
        {listing.description && <section className="card community-description"><h2>{t("Thông tin từ bài đăng")}</h2><p>{listing.description}</p></section>}
        <section className="card community-provenance">
          <h2>{t("Nguồn bài đăng")}</h2>
          <p>{listing.source.name}</p>
          {listing.sourcePostedAt && <p>{t("Đăng {0}", [communityDate(listing.sourcePostedAt, listing.timeZone, locale, true)])}</p>}
          <p>{t("Kiểm tra gần nhất {0}", [communityDate(listing.lastVerifiedAt, listing.timeZone, locale, true)])}</p>
          <button className="community-text-button" ref={reportTrigger} onClick={() => setReportOpen(true)}>{t("Báo sai hoặc yêu cầu gỡ")}</button>
        </section>
      </div>
      <aside className="community-contact card">
        <div className="community-contact-icon"><Icon name="chat" size={23} /></div>
        <h2>{t("Liên hệ chủ kèo")}</h2>
        <p className="community-organizer">{listing.organizerName || t("Chủ bài đăng")}</p>
        <p className="muted">{t("Liên hệ chủ kèo để xác nhận còn chỗ.")}</p>
        <div className="community-contact-actions">
          {contacts.map((contact, index) => <a key={`${contact.type}-${index}`} className={`btn ${active && index === 0 ? "btn-primary" : "btn-secondary"}`} href={contact.href} onClick={() => track({ type: "CONTACT", contactType: contact.type })} target={contact.type === "PHONE" ? undefined : "_blank"} rel="noopener noreferrer">{contact.type === "PHONE" ? t("Gọi {0}", [contact.value]) : contact.type === "ZALO" ? t("Liên hệ qua Zalo") : t("Liên hệ qua Facebook")}</a>)}
          {sourceUrl && <a className={`btn ${active && !contacts.length ? "btn-primary" : "btn-secondary"}`} href={sourceUrl} onClick={() => track({ type: "CONTACT", contactType: "SOURCE" })} target="_blank" rel="noopener noreferrer"><Icon name="globe" size={18} />{t("Mở bài gốc")}</a>}
        </div>
      </aside>
    </div>
    <Dialog open={reportOpen} onClose={() => setReportOpen(false)} title={t("Báo sai hoặc yêu cầu gỡ")} returnFocusRef={reportTrigger}>
      {reportOpen && <CommunityReportForm listingId={listing.id} onClose={() => setReportOpen(false)} />}
    </Dialog>
  </article>;
}

function CommunityReportForm({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const { t } = useI18n();
  const [type, setType] = useState<keyof typeof reportTypes>("WRONG_INFO");
  const [note, setNote] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await publicRequest(`/community-listings/${encodeURIComponent(listingId)}/reports`, { method: "POST", body: { type, ...(note.trim() ? { note: note.trim() } : {}), ...(reporterContact.trim() ? { reporterContact: reporterContact.trim() } : {}) } });
      setSent(true);
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 429 ? "Bạn đã gửi nhiều báo cáo. Vui lòng thử lại sau." : reason instanceof ApiError && reason.status === 404 ? "Kèo không còn hiển thị." : "Không thể gửi báo cáo. Vui lòng thử lại.");
    } finally { setBusy(false); }
  };
  if (sent) return <div className="community-report-success" role="status"><Icon name="check" size={30} /><h3>{t("Đã nhận báo cáo")}</h3><p>{t("Voi sẽ xem xét báo cáo.")}</p><button className="btn btn-primary" onClick={onClose}>{t("Đóng")}</button></div>;
  return <form className="community-report-form" onSubmit={(event) => void submit(event)}>
    <label><span>{t("Lý do")}</span><Select value={type} onValueChange={(value) => setType(value as keyof typeof reportTypes)} aria-label={t("Lý do")} disabled={busy}>{Object.entries(reportTypes).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</Select></label>
    <label><span>{t("Ghi chú (không bắt buộc)")}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={4} disabled={busy} /></label>
    <label><span>{t("Liên hệ của bạn (không bắt buộc)")}</span><input value={reporterContact} onChange={(event) => setReporterContact(event.target.value)} maxLength={200} disabled={busy} /><small>{t("Chỉ dùng để xử lý báo cáo, không hiển thị công khai.")}</small></label>
    {error && <p className="error" role="alert">{t(error)}</p>}
    <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? t("Đang gửi…") : t("Gửi báo cáo")}</button>
  </form>;
}
