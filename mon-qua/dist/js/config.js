// Chỉ chỉnh file này để thay lời thư và thêm ảnh / giọng đọc của bạn.
// Các đường dẫn được tính từ dist/index.html. Không đặt thông tin bí mật ở đây.
export const giftConfig = {
  sender: 'Nguyễn Đức Toàn',
  recipient: 'bạn',
  letter: {
    isSample: true,
    greeting: 'Gửi một người đặc biệt,',
    paragraphs: [
      'Có những điều thật giản dị, nhưng khi dành cho một người đặc biệt, chúng lại trở nên thật khác. Một lời hỏi thăm, một bông hoa, hay một khoảnh khắc nhỏ được giữ lại trong lòng.',
      'Mình gói ghém những điều ấy vào món quà này. Mong rằng khi mở nó, bạn sẽ có một chút bình yên, một chút ấm áp, và một lý do thật nhỏ để mỉm cười.',
      'Cảm ơn bạn vì đã có mặt. Chúc bạn luôn được yêu thương, theo cách dịu dàng nhất.'
    ]
  },
  audio: {
    // Sau khi nhận audio: đặt file vào assets/audio/ và thay '' bằng đường dẫn.
    src: '',
    label: 'Lời nhắn từ Toàn'
  },
  model: {
    src: 'assets/models/flower_bouquet.gltf',
    fallback: 'assets/illustrations/bouquet-fallback.svg',
    credit: { author: 'icecool', license: 'CC BY 4.0', href: 'assets/models/CREDITS.txt' }
  },
  // Sắp ảnh từ kỷ niệm đầu tiên đến mới nhất. Có thể thêm date: '14.02.2026'.
  photos: [
    { src: 'assets/photos/sample-1.svg', alt: 'Minh họa bãi biển lúc hoàng hôn', caption: 'Ảnh minh họa · Biển chiều' },
    { src: 'assets/photos/sample-2.svg', alt: 'Minh họa khu vườn có cổng vòm và hoa hồng', caption: 'Ảnh minh họa · Góc vườn' },
    { src: 'assets/photos/sample-3.svg', alt: 'Minh họa những ngọn đồi xanh trong sương', caption: 'Ảnh minh họa · Những ngọn đồi' },
    { src: 'assets/photos/sample-4.svg', alt: 'Minh họa cà phê, sách và bình hoa bên cửa sổ', caption: 'Ảnh minh họa · Góc quán quen' },
    { src: 'assets/photos/sample-5.svg', alt: 'Minh họa con phố có xe đạp dưới nắng', caption: 'Ảnh minh họa · Con phố nhỏ' },
    { src: 'assets/photos/sample-6.svg', alt: 'Minh họa hồ yên tĩnh dưới trăng lưỡi liềm', caption: 'Ảnh minh họa · Đêm bên hồ' }
  ]
};
