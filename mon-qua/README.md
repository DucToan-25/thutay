# Món quà online — Nguyễn Đức Toàn

Website HTML, CSS và JavaScript thuần: mở phong thư → đọc thư/nghe lời nhắn → chạm bó hoa 3D → ngắm bó hoa ở giữa nền hồng sáng, xung quanh là những trái tim pha lê chứa ảnh kỷ niệm đang bay nhẹ.

## Chạy trên máy

Cần Node.js 20 trở lên. Trong thư mục `mon-qua`, chạy:

```powershell
npm run serve
```

Mở **http://127.0.0.1:4173**. Không cần cài npm để chạy website; mã, thư viện Three.js và font đã nằm trong `dist`. Dùng HTTP server thay vì mở `index.html` trực tiếp bằng `file://` vì JavaScript modules và mô hình cần HTTP.

## Thêm nội dung của bạn

Tất cả thông tin nằm trong **`dist/js/config.js`**:

- `sender`, `recipient`: tên người gửi/người nhận.
- `letter.greeting`, `letter.paragraphs`: lời chào và các đoạn thư. Sau khi thay nội dung, đặt `letter.isSample: false`.
- `letter.signature.label`, `letter.signature.name`: lời ký và chữ ký cuối thư. Thư hiện tại đã được chèn nguyên văn, chia đoạn và thêm 5 emoji.
- `audio.tracks`: danh sách file trong `dist/assets/audio/` theo thứ tự phát. Hiện có 14 file M4A: `1 → 2 → 3 → 3.1 → 4 → … → 13`, tương ứng các mốc trong tài liệu. `audio.gapMs: 0` là khoảng nghỉ giữa file; `audio.startDelayMs: 3000` là thời gian chờ sau hiệu ứng mở thư; `audio.finishDelayMs: 3000` là khoảng chờ sau file cuối.
- `model.src`: mô hình thật bạn cung cấp đã được tích hợp ở dạng `flower_bouquet.gltf` cùng `.bin` và thư mục `textures/`. Đây là dữ liệu tách nguyên vẹn từ `flower_bouquet.glb` gốc, không giảm chất lượng hình học hay nén lại texture. GLB/GLTF dùng GLTFLoader; GLTF phải kèm các file `.bin`/texture ở đúng đường dẫn tương đối. OBJ/FBX cần bổ sung bộ tải tương ứng.
- `photos`: đặt ảnh trong `dist/assets/photos/`, sửa danh sách `{ src, alt, caption }` theo thứ tự bạn muốn các nhóm ảnh xuất hiện. Có thể thêm `date` để ghi ngày; website không tự tạo ngày. Trong mỗi nhóm, các trái tim có vị trí, kích thước và chiều sâu ngẫu nhiên. Hiện có toàn bộ 79 ảnh JPG bạn đã thêm, sắp theo tên file và đánh số kỷ niệm.

Ví dụ:

```js
audio: { tracks: ['assets/audio/1.m4a', 'assets/audio/2.m4a'], gapMs: 0, startDelayMs: 3000, finishDelayMs: 3000, label: 'Lời nhắn từ Toàn' },
photos: [
  { src: 'assets/photos/ky-niem-01.jpg', alt: 'Mô tả bức ảnh', caption: 'Một ngày thật vui', date: '14.02.2026' }
]
```

Nên dùng ảnh JPEG/WebP tối đa khoảng 1600–2000px chiều dài để tải nhanh; ảnh giữ nguyên tỉ lệ. Đường dẫn trong cấu hình tính từ `dist/index.html`. Nội dung thư dùng `textContent`, không diễn giải thành HTML.

`audio.letterCues` nối tên từng file với câu bắt đầu đoạn tương ứng. Khi file bắt đầu phát, thư tự cuộn tới câu đó trong 950ms với chuyển động tăng tốc rồi chậm dần. Mốc `3.1` nằm giữa đoạn văn; chữ và dấu câu vẫn giữ nguyên. Cuộn tay, chạm màn hình hoặc dùng phím cuộn sẽ ngắt hiệu ứng hiện tại; file kế tiếp tiếp tục dẫn tới đoạn mới. Tạm dừng audio hoặc rời trang thư hủy hiệu ứng đang chạy. Chế độ giảm chuyển động đưa tới đoạn ngay, không chạy hiệu ứng cuộn.

## Hành vi và dự phòng

Audio bắt đầu 3 giây sau khi hiệu ứng mở phong thư và hiện trang thư kết thúc. Mỗi file phát hết sẽ gọi phát file kế tiếp ngay, không thêm khoảng nghỉ; file kế tiếp được tải trước. Hết file `13.m4a`, trang chờ 3 giây rồi tự chuyển đến bó hoa. Thanh tiến trình điều khiển file đang chọn, nhãn hiển thị vị trí trong danh sách 14 file. Tạm dừng hoặc ẩn tab cũng dừng đồng hồ nghỉ; nhấn phát để tiếp tục. Chuyển sang bó hoa thủ công hủy audio và mọi lịch phát còn lại. File lỗi dừng tại đúng đoạn để thử lại; trình duyệt chặn tự phát sẽ hiện lời nhắc nhấn nút phát. Khi chưa có audio, bộ điều khiển được ẩn.

Mô hình và tất cả texture bắt đầu tải ngay khi mở website. Hình học, ảnh và shader được chuẩn bị trước khi vào cảnh hoa; không có vòng animation chạy trong lúc cảnh bị ẩn. Nếu người nhận chuyển quá nhanh hoặc mạng chậm, trạng thái tải vẫn được hiển thị cho đến khi sẵn sàng. Màu và vật liệu gốc được giữ nguyên. Tải lỗi/WebGL không hỗ trợ sẽ hiện bó hoa minh họa có thể nhấn để tiếp tục. Kiểm tra `model.src`, file GLTF và Console khi cần sửa tài nguyên.

Mô hình “Flower Bouquet” có thông tin tác giả **icecool**, giấy phép **CC BY 4.0** được nhúng trong file gốc và `dist/assets/models/CREDITS.txt`. Biểu tượng thông tin nhỏ ở góc cảnh hoa liên kết đến nguồn này. Khi thay mô hình, cập nhật `model.credit` theo tác giả/giấy phép mới. File GLB gốc ở thư mục cha vẫn được giữ nguyên.

Phong thư lớn, không có chữ trên mặt phong thư, dùng bàn tay chuyển động để gợi ý mở. Khi nhấn mở, tiêu đề phía trên mờ đi trước lúc lá thư trượt lên. Không còn thanh hiển thị các bước ở cuối trang. Trang thư rộng, chữ dễ đọc; thư dài cuộn theo trang, không bị nhốt trong ô đọc nhỏ.

Cảnh hoa chiếm trọn màn hình. Chạm bó hoa hoặc dùng Enter/Space trên mô hình để mở bố cục nền hồng sáng, ánh sao lấp lánh và bó hoa lớn ở giữa như ảnh tham chiếu. Bó hoa là mô hình 3D thật được dựng bằng Three.js; vẫn giữ hình học và vật liệu của mô hình bạn cung cấp. Các trái tim pha lê trong suốt chứa ảnh rải khắp không gian, khác nhau về vị trí, kích thước, góc nghiêng và chiều sâu. Mỗi trái tim chuyển động độc lập; bó hoa xoay và nghiêng mượt, với nhịp nhanh hơn cảnh cũ. Các trái tim không xếp thành vòng, lưới hoặc đường đi cố định.

Một nhóm hiển thị tối đa 10 ảnh trên máy tính và 8 ảnh trên điện thoại. Khi có nhiều ảnh hơn giới hạn, nhóm tiếp theo xuất hiện sau 9 giây; chạm bó hoa hoặc dùng Enter/Space trên mô hình để chuyển nhóm ngay. Các nhóm duyệt hết danh sách rồi lặp lại, nên mọi ảnh đều có thể xem. Khi số ảnh nằm trong giới hạn, tất cả cùng hiện quanh bó hoa.

Chạm trái tim để dừng chuyển động, mở ảnh thành khung chữ nhật đầy đủ và xem ghi chú/ngày ngay trong cảnh. Ảnh được giữ nguyên tỉ lệ, không bị cắt theo hình trái tim lúc đang xem. Chạm lại, nhấn Escape hoặc nút đóng nhỏ để tiếp tục chuyển động từ vị trí đã dừng. Kéo chuột/một ngón tay để đổi góc nhìn, con lăn/hai ngón tay để thu phóng. Ảnh đang chọn và ghi chú được giữ khi đổi kích thước màn hình; khung xem tự co lại để vừa màn hình. Animation dừng khi tab/cảnh bị ẩn. Khi thiết bị chọn giảm chuyển động, bố cục đứng yên; chọn trái tim đang hiện hoặc chạm bó hoa để chuyển nhóm ảnh.

Các file `love.html`, `stylelove.css`, `login.js`, `main-obfuscated.js` chỉ được đọc làm tham khảo. Mã obfuscate đã được phân tích tĩnh; phần hiệu ứng hiện dùng các module rõ ràng, không cần mã đăng nhập đó để chạy.

## Kiểm tra

```powershell
npm run check
npm ci --ignore-scripts
npm test
```

Kiểm tra trình duyệt dùng Chrome đã cài, không cần tải trình duyệt mới. Các file kiểm tra nằm trong `tests/`. Bản hiện tại được giữ cục bộ theo lựa chọn của bạn; không triển khai lên Sites. `dist/` là thư mục static đầy đủ.

## Cấu trúc

```text
dist/
  index.html
  css/                 giao diện, không gian ảnh và ghi chú tại ảnh
  js/                  config, trạng thái, audio, mô hình, gallery
  assets/
    models/            mô hình hoa thật
    photos/            ảnh/ảnh minh họa
    audio/             giọng đọc sẽ bổ sung sau
    fonts/             font hỗ trợ tiếng Việt và giấy phép OFL
    illustrations/     favicon, bó hoa dự phòng
  vendor/three/        thư viện Three.js và giấy phép MIT
scripts/               server cục bộ, kiểm tra và chuẩn bị tài nguyên
tests/                 kiểm tra luồng trên trình duyệt
```
