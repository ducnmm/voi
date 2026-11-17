# Muse → Voi: nhập kèo thật

Web: https://web-production-6ad62.up.railway.app/
API: https://api-voi.up.railway.app
Khám phá: https://web-production-6ad62.up.railway.app/discover

Đây là bàn giao cho Muse ở máy cloud. Đọc `API-CONTRACT.md` và `shared-schema.ts` trước khi chuyển dữ liệu. Chúng được sao chép từ contract/schema hiện tại của Voi; trạng thái deployment trong bản contract là ghi nhận cũ, kiểm tra `/openapi.json` trên API để xác nhận bản live. Voi đã có schema; không dùng schema tự thiết kế trước đó để POST.

## Chuẩn bị

Người vận hành cung cấp `runtime.json` với nguồn/khu vực đã đăng ký và file khóa integration riêng qua kênh bảo mật. Không ghi hoặc in khóa trong chat, tài liệu, payload, URL, log hay ảnh chụp. Không dùng token đăng nhập người dùng. Không tự thêm nguồn hoặc đổi source ID để vượt quyền.

`runtime.example.json` chỉ minh họa cấu trúc; danh sách nguồn/khu vực thật do người vận hành cấp. `sourceId` là ID nội bộ Voi; `sourcePostId` là ID bài Facebook, khác nhau. `externalGroupId` và group ID trong permalink phải là **số**, không dùng vanity alias như `clbcaulonghcm`. Khi link khảo sát dùng alias, lấy numeric group ID từ Facebook thật rồi dùng `https://www.facebook.com/groups/NUMERIC_GROUP_ID/posts/POST_ID/`; không tự đoán hoặc dùng số thành viên làm ID.

## Chuyển khảo sát hiện có

- Mỗi item là **một bài Facebook**: giữ nguyên source ID, post ID và permalink. Hai bài đăng chéo có ID khác vẫn là hai item; không tự gộp và không thay khóa chống trùng thành số điện thoại + tên sân. Backend nhận diện/cảnh báo nghi trùng.
- Đọc lại bài trước khi nhập thật. `observedAt` phải là thời điểm thực sự đọc bài. Retry dùng nguyên thời điểm, operationId và payload đã lưu; mỗi quan sát mới tạo operationId mới.
- Bài đã qua giờ không xuất hiện trong feed đang tuyển. Bỏ qua bài mẫu đã hết hạn khi mục tiêu là bổ sung kèo đang chơi được; không đổi ngày cũ thành ngày mới để xuất bản.
- Một ngày/buổi rõ ràng: `scheduleKind: SINGLE`, giờ ISO có offset và timezone. Nhiều buổi / lịch lặp / mơ hồ: `MULTIPLE` / `RECURRING` / `UNCLEAR`, không tự sinh ngày; ngày chưa rõ để `null`. Backend giữ các bài này để review.
- Số slot không rõ → `requestedPlayers: null`, không dùng sức chứa sân hoặc “vài slot” làm số. Giá/đơn vị không rõ → `feeVnd: null` và/hoặc `feeBasis: UNKNOWN`, giữ văn bản gốc trong `feeText`; không biến giá nam/nữ thành một mức giá đại diện. “30K/slot” không tự coi là `PER_PERSON`; nếu đơn vị rõ nhưng khác enum thì dùng `OTHER` và giữ `feeText`.
- Trình độ không ánh xạ chắc chắn → `skillLevel: UNKNOWN`, giữ `skillText`. Không suy ra trình độ từ giới tính/tuổi. Thiếu liên hệ → mảng `contacts: []`; chỉ dùng số/link được công khai trong bài để tuyển người. `PHONE.value` là số, còn `ZALO.value` phải là URL `https://zalo.me/SO_DIEN_THOAI`, không gửi một số trần với type ZALO. Facebook contact là profile URL thật trong bài; không đoán profile từ tên tác giả.
- Gửi đủ trường nullable trong `listing`; trường chưa biết là `null`, không bỏ trường bắt buộc. `title` ≤160, `description` ≤2000, `rawText` ≤20000 ký tự; tối đa 5 contacts và 25 items/batch.
- `evidence.schedule` và `evidence.venue` phải trích nguyên văn từ `rawText`, không viết lại bằng suy luận. Không có bằng chứng thì giữ thiếu để BE trả `needs_review`.
- Bài còn tuyển → `RECRUITING`; đã đủ → `FULL`; hủy → `CANCELLED`; không rõ → `UNKNOWN`. `SOURCE_DELETED` chỉ khi xác định bài bị xóa, không khi mất quyền truy cập.

## Chạy một lượt nhập

Lưu payload chính xác vào `payload.json` theo `API-CONTRACT.md`. Không tạo lại operationId khi retry. File helper không tự trích nội dung Facebook và không tự thêm trường; bạn chuẩn bị payload từ quan sát thật.

```sh
python3 submit.py validate --config runtime.json --file payload.json
python3 submit.py batch --config runtime.json --key-file /secure/voi-key --file payload.json
```

Lệnh `batch` mặc định chỉ dry run. Kiểm tra từng item, sửa lỗi dữ liệu bằng quan sát/operation mới khi phù hợp. `needs_review` không đồng nghĩa đã xuất bản. Khi dự kiến đúng, lượt nhập thật đã được người dùng yêu cầu:

```sh
python3 submit.py batch --config runtime.json --key-file /secure/voi-key --file payload.json --apply
```

Helper retry timeout/429/5xx hoặc item `retryable_error` tối đa 5 lần, giữ nguyên payload; dừng ngay 400/401/403. Sau apply, helper GET từng listing trả về để kiểm tra trạng thái hiện tại. `HTTP 200` không đủ: đọc `outcome`, `publicationStatus`, `effectiveStatus`, `errors`, `warnings` và kết quả xác minh. Không phát tán link khi bài `NEEDS_REVIEW`, `UNAVAILABLE` hoặc `EXPIRED`.

Có thể kiểm tra trạng thái hoặc lấy danh sách cần đọc lại:

```sh
python3 submit.py get --config runtime.json --key-file /secure/voi-key --id LISTING_ID
python3 submit.py recheck --config runtime.json --key-file /secure/voi-key --source-id SOURCE_ID
```

`recheck` trả một trang; giữ `nextCursor` nguyên vẹn và truyền `--cursor` khi lấy trang kế. GET danh sách không tự đọc lại Facebook: mở permalink, quan sát lại rồi gửi snapshot mới. Nếu POST bị timeout rồi retry, dùng listing ID trong kết quả replay để GET và xác nhận trạng thái; không tạo item mới chỉ vì timeout.

Bàn giao kết quả: số bài đọc, created/updated/unchanged/ignored_stale/needs_review/rejected, listing IDs, URL công khai hợp lệ và lỗi cần xử lý. Giữ checkpoint và payload đã gửi; không đánh dấu hoàn tất bài còn lỗi tạm thời. Lượt hiện tại chỉ nhập và kiểm chứng theo yêu cầu, **chưa tạo lịch chạy định kỳ**.
