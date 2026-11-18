# Hợp đồng API cho Muse AI

Contract v2, giữ tương thích v1. Trạng thái triển khai/kiểm chứng của đợt chuẩn hóa nằm trong [spec 0016](../../specs/0016-community-normalization/spec.md). Đối chiếu `/openapi.json` trước khi chuyển bot sang v2.

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
| `GET /v1/integrations/community-listings/catalog` | Bot read | Danh mục rank và Venue hiện có để đề xuất chuẩn hóa; không cấp quyền sửa/xác minh Venue. |
| `GET /v1/community-listings/skills` | Public | Scale và rank code/label/order của Voi. |
| `GET /v1/venues?q=...&areaCode=...&limit=...` | Public | Tìm Venue; kết quả có Maps link và trạng thái tọa độ. |
| `GET /v1/community-listings` | Public | Feed đang tuyển, filter khu vực/ngày/trình độ, cursor/limit. |
| `GET /v1/community-listings/areas` | Public | Mã và tên khu vực đã cấu hình để dùng trong bộ lọc. |
| `GET /v1/community-listings/:id` | Public | DTO công khai; bài cần review/suppressed/deleted hoặc nguồn tắt hiển thị trả 404. Bài đã hết hạn/full/cancelled có trạng thái phù hợp, không CTA đăng ký. |
| `POST /v1/community-listings/:id/reports` | Public có rate limit | Báo sai, đủ người, hủy, yêu cầu gỡ; không tự đổi trạng thái listing. |
| `POST /v1/community-listings/:id/events` | Public có rate limit | Ghi log VIEW hoặc CONTACT, không ghi danh hay giữ chỗ. CONTACT cần contactType SOURCE/PHONE/ZALO/FACEBOOK; trả 204. |

Không mở API tạo nguồn, cấp khóa hay khôi phục bài bị gỡ cho Muse. Các thao tác đó dùng CLI nội bộ có audit trong đợt đầu.

## V2 và dữ liệu chuẩn hóa

V1 tiếp tục nhận nguyên payload cũ. V2 giữ tất cả trường listing/evidence hiện có, cho phép thêm `listing.venueId` (ID catalog hoặc null), `listing.venueMapsUrl` (link HTTPS được hỗ trợ từ nguồn hoặc null), `listing.skillProposal` (đề xuất tùy chọn hoặc null) và `evidence.skill` (trích đoạn trong rawText). Khi skillText khác null, evidence.skill **bắt buộc không rỗng**, giữ nhãn nam/nữ và các điều kiện. BE đối chiếu nghĩa toàn bộ trích đoạn; đổi từ nguồn “chỉ tuyển nữ TB” sang skillText “Nam TB” bị từ chối bằng `SKILL_EVIDENCE_MISMATCH`. `schemaVersion` nằm trên batch envelope.

Ví dụ **fragment bổ sung**, không phải payload hoàn chỉnh:

```json
{
  "skillProposal": {
    "scaleCode": "VN_COMMUNITY_V1",
    "recruitmentAudience": "UNKNOWN",
    "requirements": [
      {"audience":"MALE","mode":"RANGE","minRank":"TBY","maxRank":"TB","minInclusive":true,"maxInclusive":true,"alternative":0,"evidence":"Nam TBY đến TB"},
      {"audience":"FEMALE","mode":"RANGE","minRank":"YEU_PLUS","maxRank":null,"minInclusive":true,"maxInclusive":true,"alternative":0,"evidence":"Nữ Yếu+ trở lên"}
    ]
  },
  "venueId": null,
  "venueMapsUrl": null
}
```

Khi không chắc, bỏ skillProposal và giữ skillText + evidence.skill; BE vẫn tự chuẩn hóa. Không gửi metadata/status do bot tự xác nhận. Rule dùng audience ALL/MALE/FEMALE, mode RANGE/UNRESTRICTED/UNKNOWN; RANGE phải có cận, đúng thứ tự trong cùng scale. Không đổi UNKNOWN thành UNRESTRICTED. Các rank liệt kê rời nhau là OR, không tự nối thành một khoảng rộng.

BE kiểm tra proposal và venueId dựa trên dữ liệu nguồn/catalog; một field do Muse đề xuất không đủ để xác minh. Giữ tên/địa chỉ nguồn ngay cả khi venueId đã biết. Hai cơ sở cùng tên/thương hiệu không dùng chung ID nếu khác địa điểm.

Listing DTO có thêm `skillNormalization` (scale/version/status/requirements/recruitmentAudience/notes/reasons), `venueId`, `venue`, `venueResolution`. Public requirements không trả evidence nguồn; integration read đã xác thực giữ bằng chứng để bot đối chiếu. `venue` gồm id/name/address/areaCode/latitude/longitude/mapsUrl/locationVerified/status. Tọa độ không có hoặc chưa xác minh trả null; không suy tọa độ từ tên sân.

Feed nhận `audience`, `rank`, `includeUnknown=true|false`, `venueId` bên cạnh filter cũ. Thống kê/range dùng mã rank; string vẫn được giữ để đối chiếu. SchemaVersion của retry đã lưu không được thay đổi; đổi sang v2 ở lần quan sát mới với operationId mới.

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
