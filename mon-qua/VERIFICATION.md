# Kết quả kiểm tra

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

Hiện dùng thư mẫu, sáu ảnh minh họa và chưa có giọng đọc thật. WAV chỉ dùng trong kiểm tra. Trang được giữ cục bộ; gói `mon-qua-source.zip` chứa mã và tài nguyên để chạy, không gồm `node_modules`, cache tài nguyên hoặc kết quả kiểm tra.
