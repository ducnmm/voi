# Các bước triển khai kèo cộng đồng

Status: Verified (local). API/web đã hoàn thành và kiểm thử; production/pilot chưa chạy. Kết nối Muse với nguồn thật do người dùng thử sau. Xem [kết quả kiểm chứng](verification.md).

## 1 Chốt hợp đồng và dữ liệu

- [x] Ghi nhận quyết định thử nghiệm khám phá công khai; cập nhật các non-goal sản phẩm mâu thuẫn khi bắt đầu triển khai.
- [x] Chốt Zod schemas/DTO độc lập cho bot và public; chuẩn hóa mã khu vực, skill, feeBasis, contacts, timezone và error codes.
- [x] Tạo migration additive cho client/credential/source/listing/operation/report, indexes và unique keys.
- [x] Định nghĩa source lifecycle, suppression tombstone, retention và thứ tự quan sát.

## 2 Xây API để Muse gọi

- [x] Integration authentication, key hashing/rotation/revocation và source scope; CLI cấp key/cấu hình nguồn.
- [x] Service validation/publish eligibility, presenter dùng allowlist và batch route có giới hạn.
- [x] Transaction theo item, ledger operation, concurrency/replay/hash conflict và stale update guard.
- [x] Dry run không ghi dữ liệu; recheck feed cho bot và GET trạng thái riêng.
- [x] Public feed/detail có filter và cursor; expiry đúng trong query, source disable/suppression áp dụng khi đọc.
- [x] Report endpoint, rate limit và CLI xem/xử lý report, suppress/restore có audit.
- [x] Log redaction, giới hạn nội dung/URL và job retention; cập nhật OpenAPI/API reference.

## 3 Mở trải nghiệm web công khai

- [x] Public fetch và guest shell cho `/discover` và `/community-listings/[id]`; các guard khác vẫn hoạt động.
- [x] Guest home dẫn đến khám phá; bổ sung lối vào cho người đã đăng nhập.
- [x] Feed/filter/card/detail riêng, nguồn/freshness/phí/số người tuyển, CTA liên hệ/mở bài gốc và báo sai.
- [x] Empty/loading/error/expired/full/cancelled/404 states, VI/EN, mobile/desktop, light/dark và keyboard accessibility.
- [x] Click liên hệ chỉ ghi nhận analytics tối thiểu, không thay đổi availability hay tạo participant.

## 4 Kiểm chứng

- [x] Unit: URL normalization, lịch/timezone, publish eligibility, phí/null, source status và stale/expiry.
- [x] API integration trên database riêng: bot auth/scope/revoke/rotation, atomic per-item operation, concurrency, timeout replay, partial failure, dry run, old/equal timestamps, deletion ordering và recheck recovery.
- [x] Privacy/security: anonymous DTO, native GROUP_ONLY isolation, public/source suppression, XSS/URL injection, body/rate limits, secret/log redaction.
- [x] Regression: auth/groups/native sessions/RSVP hiện có, shared contracts, typecheck và production builds.
- [x] Browser QA: guest từ home đến liên hệ, filters/pagination, mobile/desktop, light/dark, VI/EN; không phát sinh RSVP hoặc yêu cầu login trên public path.
- [x] Thử API và CLI bằng fixtures có cùng payload Muse; không lấy dữ liệu nhóm thật để thay cho test xác định.
- [ ] Người dùng tự nối và thử skill Muse với nguồn thật sau bàn giao.

## 5 Pilot

- [ ] Chọn khu vực và vài nguồn đầu tiên; cấu hình quyền nguồn cùng credential qua secret store của Muse.
- [ ] Chuẩn bị kế hoạch deploy additive migration/code/config và feature flag; xem diff production trước khi áp dụng.
- [ ] Dry run nguồn đã chọn, kiểm tra mẫu thủ công, sau đó mở nhập và public UI.
- [ ] Kiểm chứng bản live với dữ liệu thử có nhãn, cleanup đúng ID và không ảnh hưởng dữ liệu người dùng.
- [ ] Theo dõi trong hai tuần: kèo hữu ích mỗi khu vực/ngày, độ trễ nhập, stale/trùng/sai, click liên hệ và phản hồi kết nối thật.
- [ ] Quyết định mở rộng nguồn hoặc thêm công cụ tạo bài/poster từ kết quả pilot.

## Phụ thuộc

Hợp đồng/dữ liệu → API → tích hợp Muse và web → kiểm chứng → pilot. Sau khi DTO ổn định, phần web và hướng dẫn Muse có thể làm song song. Pilot cần nguồn thật và nơi cấp credential; triển khai local không phụ thuộc quyền truy cập tài khoản Facebook.
