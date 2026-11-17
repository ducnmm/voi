# Hợp đồng API cho Muse AI

Status: Implemented — đã kiểm thử local; chưa triển khai bản này lên production.

## Địa chỉ và xác thực

Muse gọi trực tiếp API backend. Theo cấu trúc hiện tại, prefix API là `/v1`; `/api/v1` là đường proxy của web, không phải prefix của Fastify.

```text
POST {API_ORIGIN}/v1/integrations/community-listings/batch
Authorization: Bearer <integration-key>
Content-Type: application/json
```

Key này là integration credential có quyền và nguồn được giới hạn, không phải JWT của người dùng. Không đưa key thật vào tài liệu, nội dung skill, frontend hay query string.

## Các endpoint

| Endpoint | Quyền | Mục đích |
| --- | --- | --- |
| `POST /v1/integrations/community-listings/batch` | Bot write + source scope | Upsert các snapshot, hoặc ngừng hiển thị bài qua quan sát FULL/CANCELLED/DELETED. `dryRun` để kiểm tra trước khi nhập. |
| `GET /v1/integrations/community-listings?sourceId=...&needsRecheck=true&cursor=...` | Bot read + source scope | Bài chưa tới giờ gồm full/cancelled; bài review chưa rõ ngày trong 7 ngày từ firstSeenAt. Loại deleted/suppressed; sắp theo lần kiểm tra cũ nhất và ID, có permalink/cursor/limit. |
| `GET /v1/integrations/community-listings/:id` | Bot read + source scope | Đọc kết quả/trạng thái hiện tại sau khi nhập hoặc retry; không truy cập listing ngoài phạm vi. |
| `GET /v1/community-listings` | Public | Feed đang tuyển, filter khu vực/ngày/trình độ, cursor/limit. |
| `GET /v1/community-listings/areas` | Public | Mã và tên khu vực đã cấu hình để dùng trong bộ lọc. |
| `GET /v1/community-listings/:id` | Public | DTO công khai; bài cần review/suppressed/deleted hoặc nguồn tắt hiển thị trả 404. Bài đã hết hạn/full/cancelled có trạng thái phù hợp, không CTA đăng ký. |
| `POST /v1/community-listings/:id/reports` | Public có rate limit | Báo sai, đủ người, hủy, yêu cầu gỡ; không tự đổi trạng thái listing. |
| `POST /v1/community-listings/:id/events` | Public có rate limit | Ghi log VIEW hoặc CONTACT, không ghi danh hay giữ chỗ. CONTACT cần contactType SOURCE/PHONE/ZALO/FACEBOOK; trả 204. |

Không mở API tạo nguồn, cấp khóa hay khôi phục bài bị gỡ cho Muse. Các thao tác đó dùng CLI nội bộ có audit trong đợt đầu.

## Payload mẫu

Dữ liệu dưới đây là ví dụ giả định. Nguồn, post ID và link thực tế phải khớp nhau và nằm trong cấu hình đã cấp cho bot.

```json
{
  "schemaVersion": 1,
  "runId": "muse-2026-11-10T02:00:00Z",
  "dryRun": false,
  "items": [
    {
      "operationId": "c563631c-684b-451f-a260-1c6a792b409d",
      "action": "UPSERT",
      "sourceId": "configured-source-id",
      "sourcePostId": "123456789012345",
      "sourceUrl": "https://www.facebook.com/groups/987654321098765/posts/123456789012345/",
      "sourcePostedAt": "2026-11-10T01:15:00Z",
      "sourceUpdatedAt": null,
      "observedAt": "2026-11-10T02:05:00Z",
      "rawText": "Tối 10/11, 19h-21h, sân A ở khu vực B, trình trung bình, 80k/người, tuyển 3 bạn. Nhắn FB chủ bài.",
      "listing": {
        "title": "Cầu lông tối 10/11 tại sân A",
        "description": "Buổi đánh trình độ trung bình, tuyển thêm 3 bạn.",
        "startsAt": "2026-11-10T12:00:00Z",
        "endsAt": "2026-11-10T14:00:00Z",
        "timeZone": "Asia/Ho_Chi_Minh",
        "venueName": "Sân A",
        "venueAddress": null,
        "areaCode": "configured-area-code",
        "skillLevel": "INTERMEDIATE",
        "skillText": "Trung bình",
        "feeVnd": 80000,
        "feeBasis": "PER_PERSON",
        "feeText": "80k/người",
        "requestedPlayers": 3,
        "organizerName": null,
        "contacts": [],
        "sourceStatus": "RECRUITING"
      },
      "evidence": {
        "schedule": "Tối 10/11, 19h-21h",
        "venue": "sân A ở khu vực B",
        "fee": "80k/người",
        "requestedPlayers": "tuyển 3 bạn"
      }
    }
  ]
}
```

`contacts` gồm các phần tử `{ type, value }`, type là `ZALO | FACEBOOK | PHONE`. Chỉ điền thông tin liên hệ trong bài; nếu không có, CTA mở sourceUrl. Không đoán profile từ tên hiển thị. Link profile phải thuộc host được cho phép, số điện thoại được chuẩn hóa nhưng không coi là đã xác minh.

Giờ phải có ISO offset và timezone. `null` diễn tả chưa biết; fee 0 và requestedPlayers 0 là dữ liệu có nghĩa, không dùng thay cho null. `feeBasis`: `PER_PERSON | PER_HOUR | TOTAL | OTHER | UNKNOWN`; không so sánh phí theo người với tổng tiền sân. Skill chuẩn hóa dùng enum contract mới kèm skillText nguồn, không suy ra từ giới tính/tuổi.

Chỉ `sourceStatus` và các trường listing phù hợp mới được bot cập nhật. `publicationStatus`, `lastVerifiedAt`, flags moderation và URL của Voi do backend quyết định. Title/description giới hạn lần lượt 160/2.000 ký tự; bằng chứng tối đa 1.000 ký tự/trường, không phải lời chỉ dẫn cho backend.

`skillLevel` nhận BEGINNER/INTERMEDIATE/ADVANCED/OPEN/UNKNOWN. `scheduleKind` nhận SINGLE/MULTIPLE/RECURRING/UNCLEAR, mặc định SINGLE. Để xuất bản, evidence.schedule và evidence.venue phải là trích đoạn có trong rawText (bỏ khác biệt hoa/thường và khoảng trắng); thiếu hoặc không khớp thì NEEDS_REVIEW. Đây là kiểm tra tính nhất quán đầu vào, không xác minh độc lập nội dung Facebook.

Cursor recheck giữ mốc thời điểm quét để bản đã cập nhật trong lúc phân trang không bị trả lặp vô hạn. Giữ nguyên cursor từ response khi đọc trang tiếp theo.

Với bài nguồn đã xóa, dùng item `action: "SOURCE_DELETED"` gồm operationId, sourceId, sourcePostId, sourceUrl, observedAt; không bắt buộc nội dung cũ. Lưu tombstone ngay cả khi listing chưa có để một quan sát UPSERT cũ không tạo lại bài. Khóa nguồn chưa tồn tại nhưng quan sát DELETED hợp lệ trả `created` với effectiveStatus UNAVAILABLE, không xuất bản. Việc không truy cập được bài không đủ để gửi action này.

Deletion thắng UPSERT cùng observedAt; hai UPSERT khác nội dung cùng observedAt trả `OBSERVATION_CONFLICT`. Giữ sourceUpdatedAt không-null cuối cùng làm watermark, deletion không cần trường này. Khi đã deleted/suppressed, chỉ vận hành được khôi phục; UPSERT của bot trả `rejected` với `RESTORE_REQUIRES_OPERATOR`.

## Response theo item

HTTP 200 khi envelope hợp lệ và batch đã được xử lý; không có nghĩa mọi item đều thành công.

```json
{
  "runId": "muse-2026-11-10T02:00:00Z",
  "dryRun": false,
  "results": [
    {
      "operationId": "c563631c-684b-451f-a260-1c6a792b409d",
      "outcome": "created",
      "replayed": false,
      "listingId": "listing-id",
      "publicationStatus": "PUBLISHED",
      "effectiveStatus": "OPEN",
      "publicUrl": "https://example.com/community-listings/listing-id",
      "warnings": ["AVAILABILITY_UNCONFIRMED"],
      "errors": []
    }
  ]
}
```

`outcome`: `created | updated | unchanged | ignored_stale | needs_review | rejected | retryable_error`. Item có `errors` chứa code, field và message an toàn; không echo rawText hay token. Item sai cấu trúc vẫn có `index` để đối chiếu nếu không đọc được operationId.

Dry run dùng cùng outcome enum và `dryRun: true` để diễn tả kết quả dự kiến, với `listingId/publicUrl: null` khi chưa tồn tại; không lưu operation, không sửa lastVerifiedAt. Apply vẫn kiểm tra lại trong transaction.

Nếu batch bị ngắt giữa chừng, Muse gửi lại các operationId với payload cũ. Backend trả lại kết quả đã commit và xử lý phần còn lại. Item cùng operationId khác payload bị `IDEMPOTENCY_CONFLICT`. Item trùng operationId trong một batch bị từ chối ở bước envelope validation.

## HTTP và retry

| Tình huống | Xử lý của Muse |
| --- | --- |
| 400 envelope/schemaVersion không hợp lệ | Sửa request, không retry mù. Lỗi riêng item nằm trong results HTTP 200. |
| 401 khóa sai/thu hồi | Dừng nhập, báo người vận hành. |
| 403 nguồn hoặc quyền không hợp lệ | Không nhập nguồn đó; không đổi nguồn khác để thử vượt scope. |
| 413 quá lớn | Chia nhỏ batch hoặc giới hạn raw text đúng contract. |
| 429 | Chờ Retry-After rồi retry cùng operationId/payload. |
| Timeout/5xx hoặc item retryable_error | Backoff có jitter 2s, 5s, 15s, 30s, 60s; tối đa 5 lần retry, sau đó lưu để xử lý tiếp. Giữ nguyên operationId/observedAt. |
| needs_review/rejected | Lưu lý do; khi có dữ liệu sửa gửi operation mới, không retry nguyên bài lỗi liên tục. |

Bot write scope kiểm tra trên toàn batch trước mutation: một source không được phép làm request trả 403 và không item nào được ghi. Validation dữ liệu sau bước này hoạt động riêng từng item.

Public DTO chỉ chứa nội dung chuẩn hóa được phép hiển thị, nguồn công khai, liên hệ, freshness và effectiveStatus. Không chứa rawText/evidence, integration client, operation history, internal reasons hoặc dữ liệu native Session. Không trả publicUrl cho listing không được xuất bản.

## Bộ tài liệu bàn giao khi triển khai

- OpenAPI có request/response/error schemas và enum đầy đủ; ví dụ cURL dùng biến môi trường, không chứa secret thật.
- Fixtures hợp lệ, thiếu trường, trùng bài, full/cancelled/deleted, quan sát cũ và batch lỗi một phần.
- Checklist cho skill: nguồn được cấp, checkpoint, reread bài còn hoạt động, giữ operation khi retry, xử lý timestamp và không suy đoán thông tin thiếu.
- Kết quả kiểm chứng Muse dry run → nhập → retry → cập nhật → guest xem/liên hệ → gỡ dữ liệu mẫu.
