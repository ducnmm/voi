# Chuẩn hóa trình độ và địa điểm cho kèo cầu lông

## Status

Live — đã kiểm thử, push và deploy ngày 18/11/2026; backfill 251 bài, gắn 110 bài vào 38 sân. Trình độ chưa rõ và địa điểm mâu thuẫn giữ trạng thái review. Tiến độ và bằng chứng release ghi trong tasks/verification.

## Vấn đề và dữ liệu thực tế

Snapshot DB Railway lúc 10:08 ngày 18/11/2026 (Asia/Ho_Chi_Minh): 210 community listings, 144 giá trị `skillText` khác nhau, 145 giá trị `venueName` khác nhau; 162 bài có `venueAddress`. Đây là số cách ghi, không phải số trình độ hay số sân thực tế.

- Trình độ đang có enum thô `BEGINNER / INTERMEDIATE / ADVANCED / OPEN / UNKNOWN` và chuỗi `skillText`; chưa biểu diễn được yêu cầu riêng cho nam/nữ hoặc khoảng trình độ.
- Community listings lưu tên/địa chỉ sân dạng chuỗi, chưa có liên kết địa điểm hay tọa độ. Native sessions có tên sân và tọa độ tùy chọn nhưng cũng chưa có `venueId`.
- `Court` hiện tại là sân số 1/2… trong một session để xếp đội, không phải địa điểm kinh doanh dùng chung.
- Ví dụ dữ liệu thật: `Nam Tby → Tb / Nữ Yếu+ → Tb-`; `Nam: TBY / TB- / Nữ: Y+ trở lên`; `Nam: Y+ / TBY / TB- / Nữ: Từ 3 tháng trở lên (đã biết luật)`.
- Các cách ghi `The B Hòa Bình`, `The B Hoà Bình`, `Sân The B Hòa Bình` có thể cùng một chi nhánh. The B Hoàng Văn Thụ và The B Ung Văn Khiêm là các ứng viên chi nhánh khác, không được gộp vì cùng thương hiệu.

## Mục tiêu

1. Lọc và thống kê theo mã trình độ, khoảng trình độ, nhóm đối tượng tuyển và địa điểm ổn định.
2. Giữ nguyên thông tin nguồn để kiểm tra lại, sửa mapping và chạy lại normalizer.
3. Gắn đúng chi nhánh sân, mở bản đồ/chỉ đường và hiển thị pin khi có tọa độ đáng tin cậy.
4. Backend quyết định dữ liệu chuẩn hóa; Muse gửi quan sát và đề xuất có bằng chứng.
5. Contract cũ và dữ liệu đang hiển thị tiếp tục hoạt động trong quá trình chuyển đổi.

Ngoài đợt đầu: chuẩn hóa hồ sơ giới tính/trình độ thực tế của người chơi; tự xếp hạng Elo; tự đặt sân; tự suy luận điểm số từ giới tính; tự gộp mọi bài cùng sân/giờ; mua hoặc bật dịch vụ Maps trả phí.

## 1. Trình độ có cấu trúc

### Danh mục dùng chung

| Thực thể | Trường/chức năng |
| --- | --- |
| `SkillScale` | Mã thang, phiên bản, tên hiển thị. Ví dụ thang cộng đồng do Voi định nghĩa; không coi là chuẩn toàn quốc. |
| `SkillRank` | ID, `scaleId`, mã ổn định, nhãn, thứ tự so sánh, trạng thái sử dụng. |
| `SkillAlias` | Alias được duyệt → rank; có thể giới hạn theo nguồn/khu vực nếu cách gọi khác nhau. |
| `CommunitySkillRequirement` | `listingId`, `audience: ALL / MALE / FEMALE`, `mode: RANGE / UNRESTRICTED / UNKNOWN`, `minRankId`, `maxRankId`, cận bao gồm/không bao gồm, nhóm lựa chọn OR. |
| Metadata chuẩn hóa | `status: COMPLETE / PARTIAL / UNRESOLVED`, parser/dictionary version, `normalizedAt`, hash đầu vào, bằng chứng ngắn, nguồn sửa tay/audit. |

Nam và nữ dùng chung danh mục rank; yêu cầu của bài đăng có thể khác nhau. Không quy đổi “nữ TB” thành một rank nam thấp hơn.

Danh mục v1 phải chốt từ corpus thật. Các mã dự kiến như `NEWBIE`, `YEU`, `YEU_PLUS`, `TBY`, `TBY_PLUS`, `TB_MINUS`, `TB`, `TB_PLUS` chỉ là khởi điểm để duyệt. `Y++`, `TBY-`, `TB nhỉnh`… chưa có mapping được duyệt thì giữ chưa rõ. Không xóa dấu `+/-` khi chuẩn hóa token. Thứ tự rank là thứ tự trong thang Voi, không phải điểm năng lực đo được.

### Quy tắc diễn giải

| Nội dung nguồn | Dữ liệu chuẩn hóa |
| --- | --- |
| `Nam TBY → TB; nữ Yếu+ → TB-` | Hai yêu cầu RANGE: MALE `[TBY, TB]`, FEMALE `[YEU_PLUS, TB_MINUS]`. |
| `Nữ Y+ trở lên` | FEMALE có cận dưới YEU_PLUS, không giới hạn trên. |
| `Mọi trình độ` | UNRESTRICTED, không phải UNKNOWN. |
| Không nói trình độ nữ | Chưa biết yêu cầu riêng cho nữ; không đồng nghĩa cấm nữ hoặc mọi trình độ đều phù hợp. |
| `Chỉ tuyển nam` | Ràng buộc đối tượng tuyển riêng; không suy ra chỉ từ việc có dòng trình độ nam. |
| Danh sách mức rời nhau | Lưu nhiều lựa chọn OR; không tự mở rộng thành khoảng chứa các mức bị bỏ qua. |
| `Nữ chơi từ 3 tháng, biết luật` | Điều kiện kinh nghiệm/ghi chú riêng; không tự quy thành rank. |
| Mỗi sân hoặc mỗi khung giờ có trình độ khác nhau | PARTIAL/review đến khi xác định được phạm vi từng điều kiện. |

Hai rule nam/nữ là trường hợp thường gặp, không ép mọi bài thành đúng hai cặp min/max. Bài có một yêu cầu chung dùng ALL. Rule riêng theo đối tượng được ưu tiên so với ALL; nội dung xung đột cần review. Ràng buộc tuyển đối tượng nào tách khỏi khoảng trình độ để không biến “không nhắc nữ” thành “không nhận nữ”.

RANGE phải có ít nhất một cận; các cận phải thuộc cùng scale và đúng thứ tự. Khoảng rỗng, mã rank không hợp lệ hoặc hai cận khác scale bị từ chối. V1 triển khai yêu cầu chi tiết cho community listings trước; native sessions giữ enum hiện tại và dùng chung catalog khi bổ sung form/contract chi tiết ở giai đoạn sau.

### Lọc, hiển thị và thống kê

- Bộ lọc hỏi đối tượng tuyển cần xem và rank người chơi, áp dụng kiểm tra rank nằm trong khoảng; chỉ so sánh trong cùng thang.
- Có lựa chọn riêng cho bài chưa chuẩn hóa; không đổi UNKNOWN thành OPEN.
- Card hiển thị `Nam: TBY–TB · Nữ: Yếu+–TB-`; chi tiết vẫn cho xem mô tả nguồn. Bài chưa rõ vẫn hiển thị chuỗi gốc, không bị ẩn chỉ vì chưa chuẩn hóa trình độ.
- Thống kê đếm distinct listing, không đếm số dòng requirement. Khi có nhóm bài đăng chéo đã xác minh, báo cáo số bài và số kèo riêng biệt.
- Giữ enum cũ làm projection tương thích. Không suy ra rank chi tiết từ enum BEGINNER/INTERMEDIATE nếu không có bằng chứng.

## 2. Danh mục địa điểm sân

### Mô hình dữ liệu

| Thực thể/trường | Chức năng |
| --- | --- |
| `Venue` | Một địa điểm/chi nhánh vật lý: ID Voi, tên chuẩn, địa chỉ, mã khu vực, cặp tọa độ tùy chọn, trạng thái xác minh/đóng cửa/gộp. |
| `VenueAlias` | Tên gốc và tên tìm kiếm, ngữ cảnh khu vực/địa chỉ/nguồn, liên kết venue đã duyệt. Alias không unique toàn hệ thống. |
| `VenueExternalRef` | Provider, place ID và link liên quan; ID Voi độc lập với ID provider. |
| Location provenance | Nguồn tọa độ, người/phương thức xác minh, thời điểm, độ chính xác nếu có; provider cache có hạn dùng riêng. |
| `venueId?` | Thêm trên CommunityListing và Session; `defaultVenueId?` trên Group. Giữ tên/địa chỉ gốc hiện tại. |
| Resolution metadata | `UNRESOLVED / SUGGESTED / AMBIGUOUS / MATCHED`, candidate IDs, lý do, resolver version, hash đầu vào và audit. |

Một thương hiệu nhiều chi nhánh có nhiều Venue. Không lấy tên không dấu làm khóa định danh. Tên không dấu/chữ thường/bỏ từ “sân cầu lông” chỉ dùng để tìm ứng viên; vẫn giữ bản gốc để so số nhà, đường, nhánh cơ sở.

### Luồng đối chiếu

1. Muse gửi tên, địa chỉ, khu vực, link bản đồ được nêu trong nguồn và bằng chứng; có thể gợi ý venueId đã có.
2. BE kiểm tra ID, ngữ cảnh và alias đã xác minh. Chỉ một kết quả rõ ràng, không xung đột địa chỉ/khu vực mới tự gắn.
3. Tên gần giống, thiếu địa chỉ, nhiều chi nhánh hoặc dữ liệu nguồn mâu thuẫn → tạo gợi ý để review. Điểm similarity không tự trở thành xác suất hay quyền xác nhận sân.
4. Người vận hành chọn chi nhánh đúng hoặc tạo Venue mới sau kiểm tra. Mapping được audit và trở thành alias để những bài sau tự đối chiếu.
5. Muse không tự tạo Venue authoritative hay tự xác minh một tọa độ. Tách tác vụ nhập bài khỏi tác vụ làm giàu địa điểm, tránh một dịch vụ geocoder chậm chặn cả lô nhập.
6. Trường hợp chưa xác định được venueId vẫn giữ thông tin nguồn và không làm mất các bài hợp lệ đang hiển thị.

Review v1 dùng CLI nội bộ có báo cáo dry run và danh sách mapping trước khi apply. Giao diện review có phân quyền là bước tiếp theo; không dùng quyền community-write của Muse để xác nhận/gộp danh mục sân.

### Link bản đồ và pin

- Có thể làm nút `Mở Google Maps`/`Chỉ đường` bằng Maps URLs, không cần API key. Có Place ID đã xác nhận thì dùng ID; chưa có thì dùng tên + địa chỉ + khu vực và ghi đây là tìm kiếm, chưa phải vị trí xác minh. [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).
- Link tìm kiếm không chứng minh venue đã được match. Không lấy kết quả tìm kiếm đầu tiên làm canonical Venue.
- Chỉ vẽ pin và lọc theo khoảng cách khi có cặp tọa độ có nguồn gốc phù hợp và đã xác minh. Thiếu tọa độ thì bỏ pin, giữ link tìm kiếm.
- Venue đã MATCHED không đồng nghĩa tọa độ có hiệu lực mãi mãi: cache provider hết hạn phải ngừng cấp pin/lọc khoảng cách đến khi được làm mới. Việc này không tự xóa định danh venue đã xác nhận.
- Web hiện dùng Leaflet/OSM. Google Places có quy định lưu trữ nội dung, ngoại lệ Place ID, thời hạn cache tọa độ và yêu cầu hiển thị kết quả trên bản đồ Google. Vì vậy không dùng Places để sao chép một catalog tọa độ vĩnh viễn sang bản đồ Leaflet; tách reference/cache của provider khỏi dữ liệu Voi. [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies?hl=en).
- Tọa độ lưu lâu dài cho bản đồ hiện tại ưu tiên dữ liệu do chủ sân/người vận hành cung cấp có căn cứ, hoặc provider/dataset có quyền lưu và hiển thị phù hợp. Chọn adapter và ngân sách geocoder khi triển khai tự động; MVP link/catalog không phụ thuộc vào quyết định này.
- iOS hiện có fallback `Mock.venueCoordinate` khi thiếu tọa độ, có thể đặt pin mẫu ở HCM. Bỏ fallback này khi nối Venue; vị trí chưa biết phải là chưa biết.

DTO phải quy định một thứ tự ưu tiên: khi venueId đã được resolve, tên/địa chỉ chuẩn và tọa độ còn hiệu lực lấy từ Venue/location tương ứng. Các trường tên/địa chỉ/tọa độ legacy được giữ làm snapshot nguồn hoặc fallback có provenance; không duy trì hai bộ tọa độ cùng được coi là chuẩn. Nếu canonical location chưa xác minh/hết hạn, không lấy lại tọa độ cũ không rõ nguồn để vẽ pin.

## 3. Backend, Muse và dữ liệu hiện có

Thứ tự triển khai:

1. **Catalog và contract additive:** thêm bảng và cột nullable, API đọc danh mục/đề xuất, hỗ trợ ingest schema v2 song song v1. Contract hiện tại strict và dùng schemaVersion 1 nên không tự thêm field vào payload cũ.
2. **Normalizer BE + review:** parser từ điển được duyệt, range/audience validation, venue resolver, CLI audit/correction. Muse chỉ trích xuất và đề xuất; BE tính lại/validate trước khi lưu.
3. **Dry run và backfill:** chạy trên 210 bản ghi của snapshot hoặc tập đầy đủ mới nhất lúc triển khai. Báo cáo mapping thành công, partial, chưa rõ, conflict, chi nhánh nghi trùng; duyệt các alias phổ biến trước rồi mới apply.
4. **Chuyển Muse:** cập nhật schema, tài liệu, helper validate và thử payload v2 sau khi BE đã nhận v2. Cho phép v1 tiếp tục nhập và BE normalizer xử lý trong giai đoạn chuyển tiếp.
5. **UI + API lọc:** venue picker khi tạo/sửa kèo native; bộ lọc trình độ đối tượng/range, venueId; detail có link sân, bản đồ và chỉ đường phù hợp. Đồng bộ web/iOS, giữ DTO cũ trong thời gian chuyển đổi.
6. **Thống kê và cải thiện chống trùng:** distinct venueId, phân bố yêu cầu nam/nữ, coverage chuẩn hóa; dùng venueId + thời gian + bằng chứng chủ kèo/liên hệ để tìm bài đăng chéo.

Backfill cập nhật các trường/bảng chuẩn hóa (requirements, venueId) và normalization/resolution metadata. Không đổi `observedAt` hoặc `lastVerifiedAt`: đọc lại chuỗi trong DB không phải đọc lại Facebook. Mỗi apply có điều kiện snapshot hash/version để không ghi đè bài vừa được Muse cập nhật; rerun không tạo rule/venue lặp.

Sửa tay giữ hiệu lực khi bằng chứng nguồn không thay đổi. Nếu nguồn đổi trường trình độ/địa điểm liên quan, normalizer phải đánh giá lại và có thể chuyển sang review; không tiếp tục hiển thị pin/rule cũ sai ngữ cảnh. Lưu lịch sử sửa để có thể hoàn tác từng mapping; không rollback bằng drop bảng.

## 4. Các cập nhật nên làm sau nền tảng này

- **Chống trùng nội dung:** venueId giúp vượt qua lỗi tên sân khác cách ghi. Cùng sân + giờ vẫn có thể có nhiều nhóm chơi nên chưa đủ để tự gộp. Giữ mọi sourcePostId, quan sát và provenance; nhóm thành một kèo để hiển thị/thống kê sau khi đủ bằng chứng.
- **Đọc lại và vận hành:** lưu IntegrationRun/per-source progress, kết quả và checkpoint đã xử lý thành công để DB chứng minh lượt quét/recheck nào đã hoàn thành. Theo dõi tỷ lệ stale và backlog, không chỉ tổng bài mới. Snapshot kiểm tra trước ghi nhận 20 kèo tương lai stale hơn 4 giờ và 18 cờ nghi trùng.
- **Phí nam/nữ:** thêm các dòng giá theo đối tượng, đơn vị, khoảng giá và điều kiện phụ thu. Không ép giá nam/nữ thành một `feeVnd` đại diện. Có thể dùng chung enum audience nhưng điều kiện giá độc lập với điều kiện trình độ.

## Tiêu chí nghiệm thu

1. `TBY`, `TBY+`, `TB-`, `TB+` không bị mất dấu hay gộp do tokenizer; mã lạ không tự thành OPEN.
2. Hai khoảng nam/nữ, cận một phía, ALL, chưa rõ, mọi trình độ và danh sách OR được phân biệt; không suy giới tính hồ sơ hay đối tượng bị cấm từ phần thiếu.
3. Những biến thể tên của cùng chi nhánh đã xác nhận cùng venueId; chi nhánh khác không bị gộp; tên/địa chỉ nguồn vẫn còn.
4. Thiếu/sai tọa độ không tạo pin mẫu. Link tìm kiếm được phân biệt với venue đã xác minh.
5. Sau ingest mới, filter và báo cáo dùng dữ liệu có cấu trúc với tỷ lệ unknown/partial được công khai trong báo cáo.
6. Backfill idempotent, có audit/undo, không làm mới thời điểm đọc nguồn và không ghi đè snapshot mới hơn.
7. V1/v2, web/iOS và client cũ cùng hoạt động trong migration; không yêu cầu Muse tự mở rộng quyền xác nhận danh mục sân.
8. Bộ test gồm parser/range, branch ambiguity, giữ sửa tay, đổi bằng chứng nguồn, provider-coordinate provenance/cache và tương thích API; UI kiểm tra bộ lọc, venue picker, link/pin và trạng thái chưa rõ.

## Quyết định còn cần chốt khi bắt đầu triển khai

- Duyệt từ điển và thứ tự các rank v1 từ corpus thật, nhất là Y++, TBY+/-, “nhỉnh”. Không cần buộc tất cả 144 chuỗi vào một mapping ngay.
- Bắt đầu bằng link Maps + catalog do Voi kiểm chứng; chọn provider cho tự động đối chiếu/tọa độ sau khi xác định quyền sử dụng dữ liệu và ngân sách.
- Ưu tiên gắn các chi nhánh xuất hiện nhiều trước; phần còn lại vào queue để tăng độ phủ theo dữ liệu mới, không đặt mục tiêu tự động match 100%.
