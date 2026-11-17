# Kiểm chứng kèo cộng đồng

Ngày: 2026-11-08. Bản code hiện tại đã được kiểm chứng local; chưa push/deploy bản này lên Railway. Người dùng sẽ tự kết nối và thử Muse sau.

## Kết quả

| Kiểm tra | Kết quả |
| --- | --- |
| Toàn bộ API | 221/221 tests, 30 files; database riêng `voi_community_test_20261108` |
| Tests community trong API | 66 tests về auth/scope, idempotency, concurrency, cập nhật, public privacy, báo cáo, analytics và retention |
| Web unit | 16/16 tests |
| Web UI | 10/10 Playwright tests, Chromium và WebKit |
| Typecheck | Shared, API và web đều pass |
| Production build | Shared/API build pass; Next standalone build và khởi động pass |
| OpenAPI | Các route, security và tham chiếu schema được kiểm tra qua HTTP |

UI dùng API thật với 25 bài giả lập, kiểm tra 1440/390/320 px, VI/EN, light/dark, filter và phân trang 20→22 bài đang tuyển, chi tiết thiếu thông tin, trạng thái full/cancelled/stale/expired, gửi báo cáo, login và guard trang riêng tư. Không phát hiện console error hoặc tràn ngang. Tám ảnh discover/detail ở desktop/mobile đã được xem để kiểm tra bố cục.

Ảnh local: `scratch/community-qa/evidence/`. Browser access host không kết nối được; browser-worker đã dùng Playwright CLI để chạy Chromium/WebKit. Link Facebook được kiểm tra hoặc chặn khi test click; không mở trang Facebook bên ngoài hay gửi tin nhắn.

## Kiểm tra API và vận hành

- Gửi payload dry run không tạo listing, retry cùng operation không tạo trùng.
- 25 bài được nhập qua HTTP API; thay đổi thời gian một bài đã xuất bản thành quá giờ trả EXPIRED và loại khỏi feed.
- Unit/integration tests có race thực giữa hai request nhập và giữa nhập với thao tác gỡ của operator; có lỗi database được chủ động tạo để chứng minh listing+operation rollback cùng nhau.
- CLI thực sự tạo area/source/client, cấp key vào file 0600, grant/ungrant, chạy song song hai key rồi thu hồi key cũ, gỡ/khôi phục, xử lý report, tắt/bật nguồn và chạy retention trên database QA riêng.
- Production-mode API boot pass, health/public feed/OpenAPI trả 200. Không dùng tài khoản giả làm chủ kèo và không thay đổi native session participation.
- Contact analytics qua web trả 204, không mở Facebook và không giữ chỗ. Counter dùng structured logs, chưa có dashboard.

## Tái chạy

```sh
pnpm --filter @voi/shared build
pnpm --filter @voi/api db:generate
TEST_DATABASE_URL='postgresql://voi:voi@localhost:55487/voi_test?schema=public' pnpm --filter @voi/api test
pnpm --filter @voi/web test
pnpm typecheck
```

Database `voi_test` phải được tạo và migrate trước, theo API README. Config test từ chối tên database không có `_test`; CI đã khai báo TEST_DATABASE_URL riêng.

UI test nhận `COMMUNITY_UI_FIXTURES` trỏ tới manifest các ID bài thử (mặc định `scratch/community-qa/fixtures.json`) và `WEB_UI_BASE_URL`. Khi thiếu manifest, suite skip có nêu lý do; đây không phải kết quả pass. Fixture chứa `ids.open/unknown/full/cancelled/stale/expired` và dữ liệu thử tương ứng. QA local hiện dùng web 43288, API 43287, database `voi_community_qa_20261108`.

## Chưa kiểm tra

- Skill Muse thực sự đọc Facebook, quyền sử dụng nguồn, mức chính xác của trích xuất và kết nối với người tổ chức thật.
- Deploy/migration trên Railway, cấu hình public web origin và pilot có nguồn thật.
- Điện thoại vật lý hoặc thay đổi trải nghiệm iOS native; DTO/route native được giữ nguyên và có API regression coverage.
