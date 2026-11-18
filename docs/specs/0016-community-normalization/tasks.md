# Tasks — Chuẩn hóa trình độ và sân

Status: In progress — người dùng đã duyệt triển khai ngày 18/11/2026.

## P0 — Chốt dữ liệu và quy tắc

- [ ] Xuất corpus chỉ gồm dữ liệu cần chuẩn hóa; loại liên hệ và nội dung riêng tư khỏi báo cáo.
- [ ] Duyệt danh mục rank/alias v1, thứ tự, cận khoảng, đối tượng tuyển và các chuỗi phải review.
- [ ] Duyệt các Venue/chi nhánh phổ biến, quy tắc alias theo khu vực và nguồn tọa độ.
- [ ] Định nghĩa metric coverage, unknown/partial, branch conflict, thời gian recheck và nghi trùng.

## P1 — Nền tảng BE và tương thích

- [ ] Additive Prisma migration: skill catalog/requirements, Venue/aliases/external references, các FK nullable và normalization metadata.
- [ ] Shared schemas/OpenAPI v2, v1 vẫn nhận được; DTO cũ giữ tương thích.
- [ ] Backend skill normalizer và validation; venue resolver tách khỏi request làm giàu bên ngoài.
- [ ] API đọc catalog; Muse có thể đề xuất nhưng không tự xác minh/tạo canonical venue.
- [ ] CLI review/correction có audit và undo, giữ sửa tay khi hash bằng chứng chưa đổi.

## P2 — Backfill có kiểm chứng

- [ ] Dry run toàn bộ community listings hiện có, phân biệt matched/partial/unresolved/conflict.
- [ ] Review các chi nhánh nhiều bài; chuẩn hóa alias mà không gộp các cơ sở cùng thương hiệu.
- [ ] Apply từng batch có snapshot/version guard và báo cáo before/after.
- [ ] Chạy lại chứng minh idempotent; kiểm tra lastVerifiedAt/observedAt không đổi.

## P3 — Muse và sản phẩm

- [ ] Cập nhật bộ bàn giao Muse/schema/helper sau khi BE hỗ trợ v2.
- [ ] Test một lượt dry run và nhập v2 với khóa/scopes hiện có; không tự mở quyền quản lý catalog.
- [ ] Bộ lọc rank + đối tượng, venueId; card/detail hiển thị nam/nữ và giữ mô tả gốc.
- [ ] Venue picker cho native Session/Group; cập nhật DTO/model web và iOS.
- [ ] Maps link/chỉ đường; chỉ vẽ verified pins; bỏ iOS fallback tọa độ mock trong luồng thật.
- [ ] Kiểm tra cùng dữ liệu trên web/iOS và client legacy.

## P4 — Chất lượng vận hành và thống kê

- [ ] Đọc lại bài stale trước khi coi dữ liệu là mới; lưu run/per-source kết quả và tiến độ thành công.
- [ ] Nâng duplicate candidate bằng venueId + thời gian + bằng chứng chủ kèo; không tự gộp chỉ theo sân/giờ.
- [ ] Báo cáo distinct posts, venues và kèo đã nhóm; không đếm trùng các requirement rows.
- [ ] Thiết kế phí nam/nữ có khoảng giá/đơn vị riêng, triển khai sau nền tảng trên.

## Kiểm chứng và rollout

- [ ] Parser/range/unknown/OR/audience tests và corpus regression.
- [ ] Venue alias/branch ambiguity/provenance tests, coordinates thiếu và link tìm kiếm.
- [ ] Backfill idempotency/concurrency/correction preservation và v1/v2 compatibility tests.
- [ ] UI filter/picker/map tests ở VI/EN, sáng/tối và mobile.
- [ ] Review kết quả dry run trước khi áp dụng dữ liệu; rollout theo batch và theo dõi coverage/conflict/stale.
