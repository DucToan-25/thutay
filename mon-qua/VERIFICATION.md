# Kết quả kiểm tra

## Đánh số tên ảnh — 24/10/2026

Đã đổi tên đủ 79 ảnh thành `1.jpg` đến `79.jpg` theo đúng thứ tự hiện có trong cấu hình, đồng thời cập nhật đường dẫn. Đối chiếu SHA256 trước và sau xác nhận dữ liệu của từng ảnh giữ nguyên. Kiểm tra cú pháp cấu hình và toàn bộ 79 đường dẫn đạt; thứ tự ảnh và chú thích được giữ nguyên.

## Toàn bộ ảnh kỷ niệm — 24/10/2026

Đã thay danh sách ảnh mẫu bằng đủ 79 ảnh JPG trong `dist/assets/photos/`, sắp theo tên file và giữ nguyên dữ liệu ảnh. `npm run check` đạt. Kiểm tra Chrome xác nhận cả 79 ảnh giải mã được và xuất hiện đủ qua 8 nhóm trên máy tính (1440px), 10 nhóm trên điện thoại (390px); mở được ảnh trong mỗi nhóm và không tràn ngang. Lượt kiểm tra dùng bó hoa dự phòng để tập trung vào tải ảnh và việc chuyển nhóm; mô hình hoa không thay đổi.

## Thời gian chờ đầu và cuối — 24/10/2026

Cấu hình hiện tại: chờ 5000ms sau khi hiệu ứng mở thư hoàn tất mới phát audio, không thêm khoảng nghỉ giữa file, chờ 3500ms sau file 13 rồi chuyển tới bó hoa. `npm run check` và 2 ca kiểm tra Chrome đạt: toàn bộ playlist với thời gian thực đo từ kết thúc animation đến lần phát đầu (4980–6500ms), từ kết thúc audio cuối đến chuyển cảnh (3480–4300ms), và chuyển cảnh thủ công trong khoảng chờ đầu không làm audio phát muộn. Các biên đo tính cả độ trễ trình duyệt; giá trị hẹn giờ là 5000ms và 3500ms.

## Bỏ khoảng nghỉ giữa file — 24/10/2026

`audio.gapMs` hiện là 0. Khi một file kết thúc, ứng dụng gọi phát file kế tiếp ngay, không đặt bộ hẹn giờ nghỉ. `npm run check` và ca kiểm tra toàn bộ 14 file M4A với các mốc cuộn đã đạt. Giữ thời gian chờ 2000ms sau file 13. Các ca thử tạm dừng trong khoảng nghỉ chủ động dùng cấu hình thử 200ms; cấu hình thực tế không có khoảng nghỉ.

## Cuộn thư theo audio — 24/10/2026

- Khoảng nghỉ hiện tại là 200ms. Mỗi file bắt đầu phát dẫn tới câu mở đầu tương ứng trong thư, bao gồm mốc 3.1 giữa đoạn văn. Hiệu ứng cuộn kéo dài 950ms, tăng tốc rồi chậm dần.
- `npm run check` và 8/8 ca trong `tests/audio-playlist.spec.js` đạt. Dùng các file M4A thật, tua gần cuối để xác minh chuyển tiếp toàn bộ 14 file và mốc cuộn. Cấu hình 200ms được kiểm tra trực tiếp; khoảng nghỉ thực tế được kiểm tra trong biên 180–1500ms để tính cả giải mã và lịch chạy trình duyệt. Khoảng chờ sau file 13 vẫn là 2000ms.
- Trên viewport điện thoại 390×844, xác minh các vị trí trung gian của chuyển động, cuộn tay ngắt hiệu ứng, file tiếp theo tự dẫn tới mốc mới và không tràn ngang. Chế độ giảm chuyển động đưa tới mốc ngay. Text trong DOM khớp từng đoạn cấu hình, không mất hoặc thêm chữ khi tạo mốc giữa đoạn.
- Tạm dừng giữa file, ẩn tab, chuyển cảnh thủ công, thử lại file lỗi và tạm dừng trong khoảng chờ cuối tiếp tục đạt.

## Cập nhật audio — 24/10/2026

- Đã thêm 14 file M4A theo đúng các mốc trong tài liệu: `1 → 2 → 3 → 3.1 → 4 → … → 13`. Hash của các bản trong website khớp với file gốc.
- `npm run check` đạt, bao gồm kiểm tra mọi đường dẫn trong playlist.
- 6/6 ca trong `tests/audio-playlist.spec.js` đạt với Chrome và file M4A thật. Ca thứ tự tua gần cuối từng file để kiểm tra toàn bộ chuyển tiếp mà không cần nghe hết bản ghi: không phát trước khi hiệu ứng mở hoàn tất, không bỏ đoạn hoặc đổi thứ tự, khoảng nghỉ giữa các lần phát nằm trong 480–1500ms và chuyển cảnh sau file 13 nằm trong 1980–2800ms. Cấu hình mục tiêu lần lượt là 500ms và 2000ms; sai số kiểm tra tính cả lịch chạy trình duyệt và giải mã audio.
- Tạm dừng trong khoảng nghỉ, ẩn tab, chuyển cảnh thủ công, thử lại file lỗi giữa playlist và tạm dừng đồng hồ cuối đều đạt. Thử lại file lỗi tiếp tục đúng đoạn, không bỏ qua.
- 4 ca audio hiện có cũng đạt: file hợp lệ, file ngắn sau hiệu ứng mở, trình duyệt chặn tự phát và file lỗi. Các kiểm tra này dùng WAV ngắn để xác minh hành vi.
- Nội dung thư và emoji giữ nguyên từ bản đã chèn. Các kiểm tra đồ họa cũ dưới đây là kết quả lịch sử, không phải lượt kiểm tra lại toàn bộ trong cập nhật audio này.

## Kiểm tra đồ họa trước đó

Ngày kiểm tra: 13/10/2026. Dùng Chrome đã cài trên máy và Playwright 1.56.1; WebGL kiểm tra bằng SwiftShader.

`npm run check` đạt: cú pháp JavaScript, cấu hình, đường dẫn tài nguyên, cấu trúc glTF và thư viện local.

15/15 ca kiểm tra trình duyệt đạt qua lượt chạy toàn bộ và các lượt chạy lại liên quan: 13 ca đạt trong lượt toàn bộ, ca bộ 30/60 ảnh đạt sau khi tăng thời gian kiểm tra lên 180 giây, ca chọn ảnh đạt sau khi chờ hình học thực tế của hiệu ứng phóng ảnh ổn định. Mã ứng dụng không thay đổi giữa các lượt này.

## Nội dung đã kiểm tra

- Mô hình hoa 3D, hình học và 20 texture tải sẵn khi phong thư đang hiển thị. Qua các cảnh vẫn dùng cùng một canvas; mỗi tài nguyên mô hình chỉ được yêu cầu một lần, không có lỗi JavaScript chưa xử lý.
- Sau khi bấm bó hoa, nền chuyển sang hồng sáng, hoa giữ vị trí trung tâm với kích thước lớn. Sáu ảnh hiện có nằm trong sáu trái tim pha lê, có clip hình tim, viền phản sáng, vị trí/kích thước/chiều sâu khác nhau và chuyển động độc lập.
- Nhịp chuyển động và hiệu ứng mở cảnh tính bằng thời gian thực; tốc độ không bị kéo chậm theo số khung hình. Không đo hoặc cam kết FPS của thiết bị khác.
- Chọn trái tim mở ảnh đầy đủ trong khung chữ nhật với `object-fit: contain`, hiện đúng ghi chú/ngày. Bó hoa, trái tim và ánh sáng tạm dừng; đóng ảnh hoặc nhấn Escape tiếp tục. Không có dialog hay trang ảnh phụ.
- Kiểm tra danh sách 30 và 60 ảnh: mọi ảnh được mở bằng bàn phím và hiện đúng ghi chú. Tối đa 10 ảnh mỗi nhóm trên máy tính, 8 trên điện thoại; đổi nhóm bằng bó hoa và giữ được quyền truy cập ảnh cuối khi thay đổi kích thước màn hình.
- Raycast nhận đúng thao tác bấm hoa; kéo chuột/cảm ứng đổi góc camera và vị trí ảnh, không vô tình chọn ảnh. Ảnh đang chọn vẫn hiển thị khi xoay hoặc thay đổi kích thước màn hình.
- Kiểm tra 320×640, 390×844, 768×1024, 1440×900, 1366×700 và 844×390. Cảnh chiếm toàn màn hình, không tràn ngang; ảnh chọn và ghi chú nằm trong viewport sau hiệu ứng chuyển tiếp.
- Chế độ giảm chuyển động giữ cảnh tĩnh. Bật chế độ này ngay khi hoa đang mở hoàn tất bố cục trung tâm. Tab/cảnh bị ẩn dừng animation và đồng hồ; trở lại tiếp tục từ vị trí đã dừng.
- Thư dài cuộn theo trang. Audio hợp lệ, audio kết thúc sớm, trình duyệt từ chối phát và file audio lỗi đều cho phép tiếp tục đúng luồng.
- Mô hình/WebGL lỗi có bó hoa minh họa dự phòng sử dụng được bằng bàn phím. Ảnh lỗi vẫn có khung chọn và ghi chú đọc được.
- Phong thư không có địa chỉ trên mặt, tiêu đề mờ trước khi lá thư trượt lên; không có thanh bước, nút xem lại thư hoặc bắt đầu lại trong cảnh hoa.

## Tài nguyên và ảnh kiểm tra

Ảnh chụp bố cục mới nằm trong `qa/`, tên bắt đầu bằng `crystal-`, gồm máy tính, điện thoại 320/390 px và trạng thái chọn ảnh. Báo cáo Playwright ở `qa/report/` tương ứng lượt chạy cuối.

Mô hình gốc `flower_bouquet.glb` ở thư mục cha giữ nguyên, 40.353.160 byte. Bản glTF/bin/texture trong `dist/assets/models/` giữ hình học và chất liệu đã tách từ mô hình gốc; ghi công icecool, CC BY 4.0 được giữ trong giao diện và `CREDITS.txt`.

Tại thời điểm kiểm tra đồ họa này, trang dùng thư mẫu, sáu ảnh minh họa và chưa có giọng đọc thật. WAV chỉ dùng trong kiểm tra. Trang được giữ cục bộ; gói `mon-qua-source.zip` là bản đóng gói cũ, chưa chứa cập nhật thư và audio. Bản hiện tại nằm trong `mon-qua/dist/`.
