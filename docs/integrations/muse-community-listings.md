# Kết nối Muse AI với kèo cộng đồng Voi

Muse đọc và chuẩn hóa bài ở bên ngoài. API nhận JSON, kiểm tra dữ liệu và xuất bản kèo đủ điều kiện. Người tổ chức không cần tài khoản Voi. Hướng dẫn này dành cho người vận hành cấu hình nguồn và người viết skill Muse.

## Địa chỉ API

```text
POST {API_ORIGIN}/v1/integrations/community-listings/batch
Authorization: Bearer <integration-key>
Content-Type: application/json
```

`API_ORIGIN` là backend, ví dụ `http://localhost:43187` khi chạy local. Sau khi phiên bản này được triển khai lên Railway, dùng domain API hiện có của dự án. `/api/v1` là proxy của web, không dùng làm prefix của backend.

Chi tiết JSON, lỗi và retry: [hợp đồng API](../specs/0015-community-listings/api-contract.md). Không dùng token Google/JWT của tài khoản Voi. Mỗi bot có client riêng; mỗi key chỉ truy cập nguồn và quyền được cấp.

## Chuẩn bị nguồn và cấp khóa

Chạy CLI trong thư mục `apps/api`, sau khi đã build shared/API và áp dụng migration lên đúng database. CLI dùng `DATABASE_URL` của môi trường hiện tại; xác định đúng môi trường trước khi thao tác.

```sh
node scripts/community-admin.mjs area:upsert --code hcm-binh-thanh --label 'Bình Thạnh, TP.HCM' --actor operator
node scripts/community-admin.mjs source:upsert --file /secure/source.json --actor operator
node scripts/community-admin.mjs client:create --name muse-pilot --actor operator
node scripts/community-admin.mjs client:grant --client CLIENT_ID --source pilot-source --actor operator
node scripts/community-admin.mjs key:issue --client CLIENT_ID --out /secure/muse-api-key --days 90 --actor operator
```

`source.json` có dạng sau; thay ID/link bằng nguồn thật đã chọn:

```json
{
  "id": "pilot-source",
  "externalGroupId": "123456789",
  "name": "Nhóm cầu lông pilot",
  "url": "https://www.facebook.com/groups/123456789/",
  "ingestEnabled": true,
  "publicEnabled": false
}
```

`publicEnabled: false` cho phép nhập nhưng giữ bài nội bộ. Khi nguồn phù hợp để hiển thị công khai, đổi thành true rồi chạy lại `source:upsert`. Muse cần gửi quan sát mới để bài đang cần review được xét xuất bản. Tắt nguồn bằng `source:disable` sẽ chặn nhập và ẩn các bài của nguồn ngay trên public API.

CLI chỉ in key ID và đường dẫn file. Token chỉ được ghi một lần vào file mới có quyền 0600. Đưa token vào Secrets/biến môi trường của Muse, xóa file trung gian sau khi đã lưu an toàn. Không dán token vào skill, repo, URL hoặc ảnh chụp. Khi đổi khóa, cấp khóa thứ hai cho cùng CLIENT_ID, thử thành công rồi `key:revoke --id KEY_ID --actor operator` với khóa cũ. `client:disable` thu hồi toàn bộ khả năng truy cập của bot.

## Thử payload trước khi nối skill

Tạo `payload.json` theo [mẫu contract](../specs/0015-community-listings/api-contract.md), thay sourceId, sourcePostId, sourceUrl, areaCode và thời gian bằng dữ liệu của lần thử. Nguồn/ID phải khớp, giờ nguồn là thời điểm thực sự đọc, không phải lúc retry.

```sh
node scripts/community-submit.mjs --api-origin http://localhost:43187 --key-file /secure/muse-api-key --file payload.json --dry-run
node scripts/community-submit.mjs --api-origin http://localhost:43187 --key-file /secure/muse-api-key --file payload.json
```

Chạy lại lệnh nhập với payload giữ nguyên để kiểm chứng `replayed: true`, không sinh kèo thứ hai. Muốn cập nhật bài, tạo operationId mới và observedAt của lần đọc mới; gửi snapshot đầy đủ. Đường dẫn web nằm trong `publicUrl` khi bài published và web origin đã được cấu hình.

## Quy tắc để đưa vào skill

1. Chạy mỗi hai giờ; giữ checkpoint lần quét thành công và đọc chồng 15 phút. Sau gián đoạn bù khoảng thiếu.
2. Nhận biết bài tuyển cầu lông, giữ nguyên source ID/permalink/thời điểm đăng. Dùng mã khu vực đã cấu hình; trường chưa biết gửi null hoặc UNKNOWN theo schema.
3. Một item đại diện một bài với một buổi cụ thể. Đánh dấu scheduleKind MULTIPLE/RECURRING/UNCLEAR khi không thể xác định một buổi duy nhất; backend giữ để review.
4. Không đoán thời gian, giá, số người hay liên hệ. Bằng chứng là trích đoạn ngắn từ bài cho lịch/sân/phí/số người. Chỉ lấy liên hệ được nêu cho tuyển người.
5. Gửi tối đa 25 items/request. Đọc kết quả từng item, không coi HTTP 200 là mọi bài đều nhập thành công.
6. Giữ nguyên operationId và toàn bộ payload khi retry timeout/5xx/429. Tôn trọng Retry-After; backoff có jitter và giới hạn số lần thử.
7. Mỗi lần đọc nguồn mới tạo operationId mới, kể cả nội dung không đổi. Gọi recheck endpoint để đọc lại bài còn hoạt động, gồm cả full/cancelled và bài thiếu ngày trong cửa sổ 7 ngày.
8. Chỉ gửi SOURCE_DELETED khi xác định bài bị xóa. Mất truy cập hoặc không thấy bài trong một lượt quét không phải bằng chứng xóa.
9. Ghi nhận needs_review/rejected và lý do để xử lý; không retry mù. Bot không được khôi phục bài bị gỡ hay tự thêm nguồn.
10. Không nhắn tin hay đăng bài thay người dùng trong luồng API này. Các thao tác Facebook do skill và quyền vận hành của Muse quyết định riêng.

## Quản lý bài sai và retention

```sh
node scripts/community-admin.mjs reports:list
node scripts/community-admin.mjs listing:suppress --id LISTING_ID --reason 'Yêu cầu gỡ' --actor operator
node scripts/community-admin.mjs report:resolve --id REPORT_ID --reason 'Đã xử lý' --actor operator
node scripts/community-admin.mjs listing:restore --id LISTING_ID --reason 'Đã kiểm tra lại' --actor operator
node scripts/community-admin.mjs retention --actor operator
```

Restore chỉ đưa về NEEDS_REVIEW để chờ quan sát mới, không tự xác minh hay xuất bản. CLI có audit cho các thao tác thay đổi; không ghi thông tin cá nhân vào reason nếu không cần thiết.

Worker retention chạy mỗi giờ: xóa raw text/bằng chứng đã hết hạn 30 ngày; xóa ledger replay sau 30 ngày; ẩn và làm sạch dữ liệu cá nhân của bài đã qua 90 ngày, giữ khóa nguồn chống nhập lại. Thông tin tự do của báo cáo cũ được làm sạch sau 90 ngày. Feed loại kèo tới giờ ngay khi truy vấn, không phải đợi worker.

API ghi structured logs cho kết quả nhập, `community.view` và `community.contact`. Bật LOG_LEVEL=info để tổng hợp số liệu pilot. Chỉ có listing/source/area ID và loại liên hệ; không ghi số điện thoại hay định danh theo dõi người chơi. Chưa có dashboard analytics; lượt click không phải số người ra sân.

## Cấu hình

| Biến | Mục đích |
| --- | --- |
| `COMMUNITY_LISTINGS_INGEST_ENABLED` | Bật/tắt toàn bộ luồng bot, mặc định true. Không có credential thì không nhập được. |
| `COMMUNITY_LISTINGS_PUBLIC_ENABLED` | Bật/tắt public catalogue API, mặc định true. Mỗi nguồn vẫn mặc định chưa công khai. |
| `COMMUNITY_LISTINGS_WEB_ORIGIN` | Origin HTTPS của web để tạo publicUrl; production không suy ra từ Host do người gọi gửi. |
| `COMMUNITY_LISTINGS_STALE_HOURS` | Sau bao nhiêu giờ chưa kiểm tra thì hiện cảnh báo cũ; mặc định 4. |

## Ranh giới kiểm chứng

Test tự động và QA local kiểm tra API/web với dữ liệu mẫu. Việc Muse đọc đúng nội dung Facebook, quyền của nguồn và khả năng liên hệ chủ kèo phải được kiểm tra khi người vận hành nối skill với nguồn thật. Click liên hệ chỉ là click, không phải xác nhận ra sân.
