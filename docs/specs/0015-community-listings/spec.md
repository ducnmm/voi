# Kèo cộng đồng qua Muse AI

Status: Verified (local) — API/web đã kiểm chứng theo [báo cáo kiểm thử](verification.md). Chưa deploy production; người dùng tự kết nối và thử Muse sau.

## Mục tiêu

Giúp người chơi tìm kèo cầu lông đang tuyển và liên hệ người tổ chức ngay cả khi chủ kèo chưa có tài khoản Voi. Muse AI chạy skill bên ngoài để đọc nguồn Facebook được phép sử dụng, chuẩn hóa dữ liệu và gọi API. Voi chịu trách nhiệm xác thực, kiểm tra, lưu, cập nhật và hiển thị dữ liệu.

Đây là thử nghiệm hướng khám phá kèo công khai, mở rộng phạm vi quản lý nhóm theo [ADR 0004](../../adr/0004-community-discovery.md).

## Phạm vi và thứ tự bàn giao

1. **API và tài liệu cho Muse:** nhận bài theo lô, xác thực bot, chống trùng, cập nhật, ngừng hiển thị, dry run, ví dụ request/response và quy tắc retry.
2. **Khám phá trên web:** danh sách và trang chi tiết công khai để dữ liệu nhập vào có người sử dụng; liên hệ bên ngoài và báo sai/gỡ bài.
3. **Thử nghiệm vận hành:** kết nối Muse với dữ liệu mẫu, sau đó mở một cụm khu vực và nguồn đã cấu hình; đo chất lượng kèo và lượt liên hệ.

Phần 1 là bàn giao tích hợp backend. Phần 2 là điều kiện để thử nghiệm sản phẩm với người chơi, không coi việc ghi được vào database là đã hoàn thành trải nghiệm.

Ngoài đợt này: viết/chạy skill Muse; tham gia nhóm, đọc Facebook hoặc nhắn chủ kèo bằng tài khoản của người dùng; poster/caption để chia sẻ ngược ra Facebook; tự nhận quyền chủ kèo; RSVP, thanh toán, chat hoặc giả lập người tham gia cho kèo cộng đồng; mở catalogue công khai trên iOS; tự thu thập ảnh, geocode hoặc làm giàu thông tin liên hệ.

## Luồng chính

### Muse nhập và cập nhật bài

1. Vận hành cấp một khóa riêng và gán các nguồn bot được phép nhập. Khóa nằm trong secret store của Muse, không viết trong skill hay frontend.
2. Muse chạy mỗi hai giờ. Đọc từ checkpoint của lần thành công trước với khoảng chồng 15 phút, chia request tối đa 25 bài. Sau gián đoạn phải bù cửa sổ bị thiếu, không chỉ đọc hai giờ tính từ lúc chạy lại.
3. Bot gửi permalink/ID bài, thời điểm đăng và quan sát, nội dung gốc giới hạn dung lượng, thông tin trích xuất và bằng chứng cho các trường quan trọng.
4. Backend trả kết quả riêng cho từng item: tạo, cập nhật, không đổi, bỏ qua bản cũ, cần xem lại, bị từ chối. Retry không tạo thêm kèo.
5. Muse lưu kết quả, chỉ đánh dấu xử lý xong sau khi đã nhận kết quả cuối cùng hoặc đưa lỗi cần sửa vào danh sách xử lý. Lỗi tạm thời được retry theo cùng operation ID.
6. Mỗi lượt chạy còn kiểm tra lại các bài **đã nhập và chưa tới giờ đánh**. Chỉ đọc bài mới sẽ bỏ sót việc đủ người, đổi giờ và hủy buổi. Không nhìn thấy bài trong một lần quét không đồng nghĩa bài đã bị xóa.

### Người chơi tìm và liên hệ

1. Khách mở `/discover`, lọc khu vực, ngày và trình độ mà không cần tài khoản.
2. Mở `/community-listings/[id]` để xem giờ/sân/phí, thông tin chủ kèo, nguồn và thời điểm kiểm tra gần nhất.
3. Bấm liên hệ Zalo, Facebook, điện thoại hoặc mở bài gốc. Đây là hành động liên hệ; không có trạng thái đã đăng ký hay giữ chỗ trên Voi.
4. Có thể báo sai thông tin hoặc yêu cầu gỡ. Một báo cáo không tự động xóa bài; người vận hành xử lý qua công cụ nội bộ.

## Quy tắc sản phẩm

- Gọi người đăng tuyển là **chủ kèo**; thông tin chủ sân chỉ xuất hiện nếu nguồn nêu riêng, không tự suy ra hai người là một.
- Không yêu cầu người đăng xác nhận sở hữu trước khi xuất bản bài đủ điều kiện. Không tạo User/Group giả, gán đánh giá, huy hiệu xác minh hoặc người tham gia cho họ.
- Bài đủ điều kiện được hiển thị tự động. Trường thiếu/không chắc được giữ nội bộ với lý do cần xem lại; chỉ suy đoán của AI không đủ để điền ngày, địa chỉ, phí hay số người.
- Điều kiện xuất bản lần đầu: nguồn cho phép công khai, permalink bài hợp lệ, giờ bắt đầu cụ thể trong tương lai, khu vực và địa điểm đủ để người chơi nhận biết, cùng ít nhất một cách liên hệ hoặc permalink để người chơi hỏi chủ bài. Với bài đã xuất bản, việc thời gian trôi qua không làm mất tính hợp lệ của dữ liệu: giữ publicationStatus và tính `EXPIRED`, không chuyển review chỉ vì đã tới giờ.
- Chỉ công khai thông tin liên hệ được nêu cho mục đích tuyển người. Nội dung gốc và bằng chứng trích xuất không nằm trong public DTO.
- Nguồn nằm trong danh sách cấu hình của Voi; bot không tự tạo hay bật quyền xuất bản cho nguồn mới. Nguồn riêng tư/chưa rõ phạm vi công khai mặc định giữ nội bộ cho đến khi vận hành xác định được phạm vi sử dụng.
- Số người tuyển là số ghi trong bài tại một thời điểm: “Bài đăng tuyển 3 người”. Mặc định tình trạng hiện tại là “Liên hệ xác nhận”, không tính số chỗ trống từ click hoặc xem trang.
- Nếu quá 4 giờ chưa kiểm tra lại, hiển thị “Thông tin chưa được cập nhật gần đây”. Ngưỡng 4 giờ là cấu hình thử nghiệm, không phải cam kết rằng bài mới hơn còn chính xác.
- Khi tới giờ bắt đầu, bài rời danh sách đang tuyển. Trang chi tiết vẫn có thể cho biết đã bắt đầu/đã qua giờ; đây là quyết định MVP bảo thủ, không cần tự đoán giờ kết thúc.
- Bài báo đủ người, hủy hoặc nguồn xác nhận xóa rời danh sách tuyển ngay. Bài bị vận hành gỡ giữ dấu chặn nhập lại; bot không được tự khôi phục.
- MVP nhận một buổi cụ thể trên mỗi bài gốc. Bài nhiều buổi hoặc lịch tuần không có ngày cụ thể được giữ `NEEDS_REVIEW`; chưa tự sinh chuỗi trận từ lịch lặp.

## Thiết kế dữ liệu

Tạo miền dữ liệu riêng, không đổi ý nghĩa `Session` hiện tại.

| Thực thể | Vai trò và trường chính |
| --- | --- |
| `IntegrationClient` | Định danh bot ổn định, quyền, nguồn được nhập, disabledAt. Cấp/thu hồi bằng CLI nội bộ; chưa xây dashboard quản lý bot. |
| `IntegrationCredential` | Client ID, key ID, hash khóa, createdAt/expiresAt/revokedAt. Cho phép hai khóa cùng client trong thời gian rotation; ledger và rate limit dùng client ID nên không bị reset khi đổi khóa. |
| `CommunitySource` | Platform, external group ID, tên/link nguồn, bật/tắt nhập, chính sách xuất bản. Cấu hình do vận hành quản lý. |
| `CommunityArea` | Mã/tên khu vực và trạng thái bật, dùng chung cho validate bot và bộ lọc public. |
| `CommunityListing` | Khóa bài gốc, nguồn, nội dung chuẩn hóa, địa điểm/khu vực, giờ và múi giờ, mức chơi, phí và đơn vị phí, số người nguồn nói cần tuyển, liên hệ, sourcePostedAt/sourceUpdatedAt/observedAt/receivedAt, trạng thái, phiên bản, lý do giữ/gỡ. |
| `CommunityIngestOperation` | Unique `(integrationClientId, operationId)`, hash payload, kết quả item, listing ID, timestamps. Ghi nguyên tử cùng thay đổi listing để retry an toàn. |
| `CommunityListingReport` | Listing ID, loại báo cáo, ghi chú giới hạn, trạng thái xử lý. Thông tin liên hệ người báo là tùy chọn và riêng tư. |
| `CommunityAuditLog` | Người vận hành, thao tác, đối tượng và metadata tối thiểu cho cấu hình, cấp/thu hồi khóa, gỡ/khôi phục và retention. |

Khóa chống nhập trùng chính xác: `(platform, sourcePostId)`. Với Facebook group post, yêu cầu ID bài và permalink trực tiếp trỏ tới đúng nhóm/ID đã cấu hình; không chấp nhận URL rút gọn để backend tự theo redirect.

Cùng bài ở URL desktop/mobile có cùng ID nên chỉ có một listing. Hai bài đăng lại có ID khác nhau có thể là cùng kèo: MVP chỉ đánh dấu ứng viên trùng theo liên hệ + địa điểm + giờ, để vận hành kiểm tra. Không tự gộp bằng tiêu đề giống nhau. Đây là giới hạn cần đo trong thử nghiệm.

Tách ba khái niệm trạng thái:

- `publicationStatus`: `PUBLISHED | NEEDS_REVIEW | SUPPRESSED`.
- `sourceStatus`: `RECRUITING | FULL | CANCELLED | DELETED | UNKNOWN`.
- `effectiveStatus` tính lúc đọc: `OPEN | FULL | CANCELLED | EXPIRED | UNAVAILABLE`, cộng cờ `stale`. `OPEN` nghĩa đang hiển thị để liên hệ, không chứng minh còn chỗ.

Feed chỉ đọc bài published, nguồn còn cho phép hiển thị, chưa tới giờ, không full/cancelled/deleted. Kiểm tra thời gian ngay trong query để không phụ thuộc cron cho tính đúng. Worker dọn dữ liệu chỉ xử lý lưu trữ/retention.

## Đồng bộ và thứ tự cập nhật

- `operationId` định danh một lần gửi quan sát; retry giữ nguyên ID và payload, lần đọc mới dùng ID mới. Unique constraint và transaction bảo vệ hai request đồng thời.
- Cùng operation ID với nội dung khác trả lỗi `IDEMPOTENCY_CONFLICT`, không áp dụng payload thứ hai. Response replay ghi rõ `replayed: true`; trạng thái hiện tại phải đọc qua endpoint GET.
- Không giữ transaction chung cả lô; bài lỗi không rollback bài hợp lệ. Operation và thay đổi listing của từng item phải commit cùng nhau. Lỗi tạm thời không được lưu thành kết quả cuối cùng.
- `observedAt` là lúc bot thực sự đọc bài, không phải lúc retry. Không chấp nhận timestamp tương lai quá 5 phút. So sánh trong transaction: quan sát cũ không ghi đè quan sát mới; sourceUpdatedAt cũ hơn phiên bản đã biết cũng không được hạ dữ liệu. Giữ watermark sourceUpdatedAt không-null cuối cùng khi snapshot mới thiếu giá trị này. Hai quan sát cùng observedAt và nội dung khác nhau trả `OBSERVATION_CONFLICT`; deletion thắng khi cùng timestamp. Deletion mới hợp lệ không cần sourceUpdatedAt.
- Chỉ quan sát mới với nội dung thật sự được đọc lại mới tăng `lastVerifiedAt`, kể cả nội dung không thay đổi. Retry/dry run không làm bài trông mới hơn. Hash idempotency tính trên item canonical, không gồm runId của lần vận chuyển.
- Payload cập nhật là snapshot đầy đủ, trường chưa biết là `null`. Snapshot không hợp lệ được trả lỗi; snapshot hợp lệ nhưng không đủ điều kiện xuất bản chuyển về `NEEDS_REVIEW`, tránh giữ công khai thông tin cũ đã mất cơ sở.
- Có thể mở lại từ full/cancelled nếu quan sát mới chứng minh trạng thái đã đổi. Bài `DELETED` và `SUPPRESSED` chỉ được mở lại bằng thao tác vận hành có audit, bot không tự khôi phục.
- Recheck feed gồm bài còn trong tương lai kể cả full/cancelled, cùng bài `NEEDS_REVIEW` chưa rõ ngày trong 7 ngày từ firstSeenAt. Loại bài deleted/suppressed; sắp xếp theo lần kiểm tra cũ nhất và ID. Hết cửa sổ review không tự công khai; vận hành có thể yêu cầu kiểm tra lại riêng.
- Nguồn mất truy cập không tự tạo tombstone xóa. Bot chỉ gửi `DELETED` khi đã xác định bài bị xóa; bản không kiểm tra được giữ timestamp cũ và trở nên stale. Detail public của bài deleted/suppressed hoặc nguồn đã tắt quyền hiển thị trả 404, không giữ công khai liên hệ.

## API và vận hành

Hợp đồng đề xuất và ví dụ nằm trong [api-contract.md](api-contract.md).

- Tái sử dụng Zod/shared DTO, Fastify error envelope, Redis rate limit và request ID của dự án. Tạo integration auth riêng; không cấp JWT người dùng/host cho bot.
- Giới hạn mặc định thử nghiệm: 25 items/request, body 1 MiB, raw text 20.000 ký tự/item, tối đa 5 contact/item; 30 batch requests/phút/client. IP limit bổ sung cho request chưa xác thực. Trả `Retry-After` khi 429.
- Token ngẫu nhiên đủ entropy, chỉ lưu hash và key ID; so sánh an toàn, hỗ trợ khóa mới chạy song song ngắn hạn rồi thu hồi khóa cũ. Không đưa khóa vào URL/log/OpenAPI example.
- Text là dữ liệu, không phải HTML hay chỉ dẫn thực thi. Validate scheme/host của liên kết liên hệ; từ chối javascript/data URL. Backend không fetch URL bot gửi, không gọi AI trong request nhập bài.
- Log chỉ gồm request/run/operation/client/listing ID, kết quả, mã lỗi và độ trễ. Không log token, body gốc hoặc số điện thoại.
- Nội dung gốc/bằng chứng giữ nội bộ tối đa 30 ngày theo mặc định đề xuất. Operation replay giữ 30 ngày; bot không retry operation cũ hơn cửa sổ đó. Cơ chế upsert và kiểm tra thứ tự vẫn chống tạo trùng sau khi ledger hết hạn.
- Bài hết hạn 90 ngày được xóa/anonymize nội dung và liên hệ theo job; giữ khóa nguồn tối thiểu cần thiết để tránh nhập lại. Bài bị yêu cầu gỡ xóa dữ liệu công khai ngay và giữ tombstone tối thiểu.
- Metrics: số nhận/tạo/cập nhật/trùng/giữ/lỗi, thời gian từ đăng nguồn tới xuất bản, tỷ lệ stale, báo cáo sai, lượt xem chi tiết và click liên hệ. Click không được báo cáo là người đã tham gia.

Lượt xem/click được ghi qua structured logs `community.view`/`community.contact`, không có tracking ID hay nội dung liên hệ. Cần giữ log level info khi muốn tổng hợp số liệu pilot; chưa có dashboard analytics. Ngày nguồn và thời điểm nhận/xuất bản trong database hỗ trợ tính độ trễ và tỷ lệ stale.

## Thay đổi theo cấu trúc repo

- API: thêm Prisma models/migration, `plugins/integration-auth.ts`, route/service/presenter cho community listings và CLI quản lý client/source/suppression/reports; đăng ký trong `apps/api/src/app.ts`.
- Contracts: thêm schema/DTO riêng trong `packages/shared/src/index.ts`, cập nhật `apps/api/src/openapi.ts`. OpenAPI hiện viết tay nên phải cập nhật rõ từng request/response mới.
- Public API presenter dùng allowlist trường, không gọi `presentSession` hay serialize toàn bộ record Prisma.
- Web: thêm `/discover`, `/community-listings/[id]` và public fetch path riêng. Điều chỉnh guest shell/guard ở đúng route; không gỡ auth toàn app.
- Guest home dẫn tới khám phá; người đã đăng nhập có lối “Khám phá” cạnh các kèo/nhóm hiện có. Listing card riêng, có nhãn nguồn và CTA liên hệ. Không ép dữ liệu vào `SessionCard`.
- Các route `/sessions`, membership/privacy, native Session DTO và iOS giữ hợp đồng hiện tại. Không dùng trang session có participants/payment/check-in làm trang public listing.
- Ngày giờ lưu UTC, hiển thị theo timezone nguồn (mặc định Asia/Ho_Chi_Minh cho pilot). Khu vực chuẩn hóa theo mã cấu hình; chưa có tọa độ thì không vẽ pin hay quảng cáo lọc bán kính.
- Public feed lọc trên server, cursor ổn định `(startsAt, id)`, limit mặc định 20/tối đa 50; không tải hết rồi lọc ở frontend.

## Tiêu chí nghiệm thu

1. Không có/sai/đã thu hồi khóa bị từ chối; user token không nhập được; bot không thao tác được native sessions hay nguồn ngoài phạm vi.
2. Một payload hợp lệ tạo đúng một listing; retry cùng operation, URL alias và request đồng thời không tạo thêm kèo.
3. Trả kết quả theo từng item; bài sai không làm mất bài đúng; dry run không ghi listing, operation hay timestamp mới.
4. Bản quan sát cũ/retry không ghi đè cập nhật mới hoặc làm mới độ tin cậy; lần đọc mới có nội dung không đổi vẫn cập nhật freshness; đổi giờ/full/cancelled phản ánh đúng; bị vận hành gỡ không tự xuất hiện lại.
5. Thiếu ngày rõ ràng, nhiều buổi mơ hồ, nguồn không được công khai hoặc địa điểm không đủ thì không xuất bản; trường chưa biết không bị tự điền.
6. Đúng giờ bắt đầu bài biến mất khỏi feed dù worker không chạy. Mất một lần quét không xóa bài. Stale hiển thị đúng theo lastVerifiedAt.
7. Guest xem/lọc/mở/liên hệ được trên mobile và desktop, light/dark, VI/EN; link lỗi có fallback mở bài gốc. Không xuất hiện nút RSVP hay cam kết giữ chỗ.
8. Public DTO không lộ nội dung gốc, key, moderation notes, private native sessions, roster hoặc thanh toán. Nội dung/script và URL độc hại không được thực thi.
9. Báo sai/gỡ gửi được với rate limit, không làm bài tự biến mất; thao tác vận hành có audit và được kiểm tra phân quyền.
10. Hướng dẫn Muse có mẫu thành công, thiếu trường, retry timeout, 429, xung đột idempotency, cập nhật và xóa; Muse dry run và nhập mẫu đi hết luồng trước pilot.

## Bàn giao và điều kiện mở pilot

Các con số batch/rate/stale/retention ở trên là mặc định đề xuất để triển khai, có thể chỉnh sau thử nghiệm. Pilot giới hạn một cụm khu vực và vài nguồn do người vận hành chọn.

Thứ tự: duyệt phạm vi → triển khai và test local → cấp credential Muse qua kênh secret → dry run → nhập dữ liệu mẫu → kiểm tra guest web → triển khai additive migration/code → mở pilot và theo dõi. Production cần nguồn thật cùng vị trí lưu credential của Muse trước bước kết nối, chưa cần chúng để xây/test API.

Rollback: thu hồi bot key hoặc tắt ingest/nguồn, ẩn public catalogue bằng feature flag; giữ bảng mới và dữ liệu để điều tra. Không rollback migration bằng drop bảng. Railway/config/secrets sẽ có kế hoạch triển khai riêng sau khi code và kiểm thử sẵn sàng.
