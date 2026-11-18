# Tasks — Chuẩn hóa trình độ và sân

Status: Live — phần nền tảng, sản phẩm và backfill đã triển khai ngày 18/11/2026. P4 ghi rõ phần vận hành/thống kê còn theo sau; bằng chứng trong verification.md.

## P0 — Chốt dữ liệu và quy tắc

- [x] Xuất corpus chỉ gồm dữ liệu cần chuẩn hóa; loại liên hệ và nội dung riêng tư khỏi báo cáo.
- [x] Duyệt danh mục rank/alias v1, thứ tự, cận khoảng, đối tượng tuyển và các chuỗi phải review.
- [x] Duyệt các Venue/chi nhánh phổ biến, quy tắc alias theo khu vực và nguồn tọa độ.
- [x] Metric coverage/unknown/partial/branch conflict; giữ recheck và duplicate candidate hiện có, nâng cấp vận hành ở P4.

## P1 — Nền tảng BE và tương thích

- [x] Additive Prisma migration: skill catalog/requirements, Venue/aliases/external references, các FK nullable và normalization metadata.
- [x] Shared schemas/OpenAPI v2, v1 vẫn nhận được; DTO cũ giữ tương thích.
- [x] Backend skill normalizer và validation; venue resolver tách khỏi request làm giàu bên ngoài.
- [x] API đọc catalog; Muse có thể đề xuất nhưng không tự xác minh/tạo canonical venue.
- [x] CLI review/correction có audit và undo, giữ sửa tay khi hash bằng chứng chưa đổi.

## P2 — Backfill có kiểm chứng

- [x] Dry run toàn bộ community listings hiện có, phân biệt matched/partial/unresolved/conflict.
- [x] Review các chi nhánh nhiều bài; chuẩn hóa alias mà không gộp các cơ sở cùng thương hiệu.
- [x] Apply từng batch có snapshot/version guard và báo cáo before/after.
- [x] Chạy lại chứng minh idempotent; kiểm tra lastVerifiedAt/observedAt không đổi.

## P3 — Muse và sản phẩm

- [x] Cập nhật bộ bàn giao Muse/schema/helper sau khi BE hỗ trợ v2.
- [x] Test v2 ingest/dry run và quyền catalog bằng test integration key cùng phạm vi community; không mở quyền quản lý catalog. Muse đọc catalog live bằng credential hiện có và xác nhận đã lưu hướng dẫn v2 vào scheduled task.
- [x] Bộ lọc rank + đối tượng, venueId; card/detail hiển thị nam/nữ và giữ mô tả gốc.
- [x] Venue picker cho native Session/Group; cập nhật DTO/model web và iOS.
- [x] Maps link/chỉ đường; chỉ vẽ verified pins; bỏ iOS fallback tọa độ mock trong luồng thật.
- [x] Kiểm tra API/DTO legacy, web với dữ liệu thật trên DB QA và iOS build. iOS E2E được theo dõi riêng.

## P4 — Chất lượng vận hành và thống kê

- [ ] Đọc lại bài stale trước khi coi dữ liệu là mới; lưu run/per-source kết quả và tiến độ thành công.
- [ ] Nâng duplicate candidate bằng venueId + thời gian + bằng chứng chủ kèo; không tự gộp chỉ theo sân/giờ.
- [x] Báo cáo distinct source posts/venues, không đếm trùng requirement rows.
- [ ] Báo cáo kèo đã nhóm sau khi triển khai crosspost grouping.
- [ ] Thiết kế phí nam/nữ có khoảng giá/đơn vị riêng, triển khai sau nền tảng trên.

## Kiểm chứng và rollout

- [x] Parser/range/unknown/OR/audience tests và corpus regression.
- [x] Venue alias/branch ambiguity/provenance tests, coordinates thiếu và link tìm kiếm.
- [x] Backfill idempotency/concurrency/correction preservation và v1/v2 compatibility tests.
- [x] UI filter/picker/map tests ở VI/EN, sáng/tối và mobile.
- [x] Review dry run, rollout có guard và kiểm tra coverage/conflict/watermark trên live.
