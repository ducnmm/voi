# Kiểm chứng chuẩn hóa trình độ và sân

Ngày: 18/11/2026 (Asia/Ho_Chi_Minh).

## Phạm vi bản triển khai

- Skill catalog v1 và các requirement nam/nữ/ALL có cấu trúc, parser BE, API filter và thống kê distinct source posts.
- Venue dùng chung, alias có ngữ cảnh địa chỉ/khu vực, Maps search và tọa độ có provenance; chọn Venue trên web/iOS.
- V1 tương thích, V2 yêu cầu bằng chứng trình độ giữ đúng đối tượng tuyển; public DTO không lộ evidence.
- Công cụ plan/apply/undo/correct có audit, bảo vệ phiên bản nguồn và sửa tay; cập nhật bộ bàn giao Muse.

## Kiểm thử local

| Kiểm chứng | Kết quả |
| --- | --- |
| Shared normalizer/catalog/matcher/formatter | 15/15 tests pass |
| API: domain hiện có và normalization | 231/231 tests pass, 31 files |
| Web unit | 20/20 tests pass |
| Web production build/typecheck | Pass |
| Chromium + WebKit UI | 30/30 pass, 0 skip; WebKit rank scroll có kiểm chứng bằng pointer thực |
| iOS Simulator generic Debug build, không signing | BUILD SUCCEEDED |
| iOS Simulator build-for-testing, app + UITest targets | TEST BUILD SUCCEEDED sau khi tách CreateSessionView thành các phần nhỏ |
| Python Muse helper offline | 8/8 pass |
| Python Muse helper → API test: catalog + V2 dry run | Pass; số listing và operation không đổi |

Các DB test tách biệt, tên chứa `_test_`; không dùng DB live cho test có truncate. UI kiểm tra guest/authenticated, bộ lọc cũ/mới, native venue picker/freeform, nguồn dữ liệu lỗi độc lập, VI/EN, sáng/tối, 320–1440px. Các link Maps được phân biệt tìm kiếm và vị trí đã xác minh.

## Corpus và công cụ backfill

Đầu vào: bản chụp 210 dòng trình độ/địa điểm nguồn, không sao chép liên hệ; fixture dùng post ID/URL giả, không nhập vào production.

- 147 COMPLETE, 31 PARTIAL, 32 UNRESOLVED về trình độ.
- 38 Venue, 67 alias chuẩn hóa duy nhất; 104 dòng MATCHED, 105 UNRESOLVED, 1 AMBIGUOUS.
- 505 requirement rows; thống kê vẫn đếm distinct listing, không đếm số rule.
- Không tạo tọa độ. Danh tính sân/chi nhánh được đối chiếu từ tên/địa chỉ nguồn; locationVerified vẫn false.
- Plan không ghi DB. Apply 210 dòng; lặp cùng plan changed=0, unchanged=210; undo khôi phục đúng 210; fresh apply thành công.
- observedAt, lastVerifiedAt, receivedAt, createdAt, updatedAt, version và snapshotHash không đổi do backfill.
- Snapshot mới hơn và undo sau khi nguồn đổi đều bị guard chặn đúng.
- 48 tổ hợp API filter (8 rank × ALL/MALE/FEMALE × includeUnknown true/false), phân trang toàn bộ corpus: ID set khớp shared matcher, không trùng trang; public requirements không có evidence.

## Rollout production

1. Push code đã qua kiểm thử; đợi API áp dụng migration additive và healthcheck thành công.
2. Chạy CLI plan với manifest Venue đã rà; kiểm tra số target, skill coverage, venue matches và conflict.
3. Apply plan có actor/audit; đọc lại watermarks, count dữ liệu native và các field nguồn. Retry cùng plan phải idempotent; nếu Muse cập nhật đồng thời thì bỏ qua dòng đó và lập plan mới.
4. Kiểm chứng catalog, public DTO, filters/statistics và health trên live.
5. Chuyển bộ hướng dẫn Muse theo commit đã deploy; giữ lịch hai giờ đang có, retry cũ và phạm vi credential hiện có.

### Kết quả live ngày 18/11/2026

- Code release: [`2fe99bb`](https://github.com/ducnmm/voi/commit/2fe99bb8366f8cb217545e18546d9839034d7aaf). API deployment `d4a1e38a-c3f3-42d7-8771-f9866f3a1323` và web deployment `67e36172-c6d8-442d-9d21-98745431d6f1` đều SUCCESS, cùng commit. Migration additive `20261118031500_community_normalization` đã áp dụng.
- Snapshot production trước backfill tăng lên **251 bài** do các lượt nhập mới. Plan `a9a9795e-4b2c-42eb-8259-9e60db85f159` áp dụng lúc **11:09 giờ Việt Nam**: changed=251, unchanged=0, skipped=0.
- Trình độ: **176 COMPLETE / 37 PARTIAL / 38 UNRESOLVED**, 608 requirement rows. Không còn bài thuộc phạm vi backfill thiếu normalization version.
- Sân: **110 MATCHED / 137 UNRESOLVED / 3 SUGGESTED / 1 AMBIGUOUS**; danh mục có **38 Venue / 67 alias**. Không tạo tọa độ; cả 38 sân vẫn có locationVerified=false.
- Đọc lại DB lúc 11:10: không field nguồn hoặc watermark nào thay đổi; số User/Group/Session giữ nguyên. Lặp cùng plan: changed=0, unchanged=251, skipped=0.
- Kiểm tra HTTP lúc 11:14: API và web 200; catalog 8 rank/38 sân. Feed đang tuyển có 67 bài; phân trang không trùng và không lộ evidence/rawText/hash nội bộ. Bộ lọc TBY trả 37 bài cho MALE và 40 bài cho FEMALE, khớp thống kê distinct posts; bộ lọc Venue chỉ trả đúng sân đã chọn.
- Muse xác nhận lúc 11:14 đã tải bộ bàn giao từ commit release, cập nhật tại chỗ task `voi-scan-import-2h`, giữ lịch mỗi hai giờ/Asia/Ho_Chi_Minh và năm nguồn. Hướng dẫn mới dùng schemaVersion=2 cho quan sát mới, giữ nguyên retry/checkpoint cũ, bắt buộc evidence.skill và không đoán rank/chi nhánh/tọa độ. Muse đọc catalog qua credential Secure Vault hiện có: 8 rank, 38 sân (TP.HCM 23, Hà Nội 9, Đà Nẵng 6). Không đổi quyền hay hạn khóa; lượt kế tiếp được Muse báo khoảng 11:24. Đây là xác nhận cấu hình/catalog, không phải bằng chứng một lượt quét v2 toàn bộ đã hoàn tất.
- GitHub CI job API pass. Lượt iOS E2E đầu trên Xcode 26.3 dừng ở compile do CreateSessionView quá phức tạp để type-check; đã tách Form/venue picker thành các phần nhỏ, giữ nguyên hành vi và accessibility IDs. Local build-for-testing đã biên dịch thành công cả app và UITest targets. Kết quả chạy E2E trên CI được theo dõi riêng, không suy từ build local.

Báo cáo máy đọc được được giữ trong `scratch/community-normalization-20261118/production-{plan,apply,verify}.json` và `production-http-verification.json` tại workspace vận hành. Các file này không đưa lên Git vì chứa snapshot nguồn. QA API/web và container Postgres test riêng đã được dọn sau kiểm chứng.

## Các trường hợp còn giữ review

Alias chưa được duyệt như Y++, trình độ theo từng sân/khung giờ, kinh nghiệm thay cho rank và địa điểm mâu thuẫn không bị ép thành dữ liệu chắc chắn. Chưa mở API geocoder trả phí hoặc tạo pin từ tên sân. Nhật ký từng run Muse, nhóm crosspost thành một event và giá theo nam/nữ là các bước tiếp theo, không được báo cáo là đã triển khai trong bản này.
