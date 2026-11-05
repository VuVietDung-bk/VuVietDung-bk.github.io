# Moving Like A Knight (web)

A static Canvas port of the Java Swing game in `../Moving_Like_A_Knight/` for GitHub Pages. Open `index.html` through a static HTTP server or GitHub Pages; browsers do not load the individual level files reliably over `file://`.

## Chỉnh và thêm màn chơi

Mỗi màn là một file riêng trong `levels/mainlevels/`, giữ nguyên định dạng của game Java:

- Màn chính: `level_0.txt` … `level_49.txt`. Muốn sửa màn có sẵn, chỉ cần sửa đúng file đó rồi đẩy lên GitHub và tải lại trang.
- Màn ẩn: `level_1000.txt` … `level_1019.txt`.
- Vị trí flag của màn `N` nằm ở dòng `N + 1` trong `flagpos.txt` (dòng đầu là màn 0).
- Khi thêm màn chính mới, tạo `level_50.txt`, thêm dòng tương ứng vào `flagpos.txt`, rồi tăng `MAIN_LEVEL_COUNT` trong `level-loader.mjs`. Khi thêm màn ẩn, cập nhật `BONUS_LEVEL_IDS` ở cùng file.

Định dạng file màn:

```text
8 8 5 0
8,8,11,1
8,12,14,1
tele
3,4,10,12
```

Dòng đầu lần lượt là **hàng của quân ngựa, cột của quân ngựa, số bước, số lần dịch chuyển**. Mỗi dòng sau `hàng,cột_đầu,cột_sau,giá_trị_ô` mô tả các ô từ `cột_đầu` đến trước `cột_sau`; tọa độ bắt đầu từ 0, bàn có 25 hàng × 35 cột. Giá trị ô là 1, 2 hoặc 3. Phần `tele` và các dòng `hàng_vào,cột_vào,hàng_ra,cột_ra` chỉ cần khi có cổng dịch chuyển. File mẫu trên chỉ minh họa cú pháp; hãy tham khảo `level_0.txt` khi sửa màn thật.

## Custom level

Theo game Java gốc, mục **MORE** trong menu game mở sau khi qua màn 30. Trong đó chọn **Custom Levels** để tạo màn, **Saved Levels** để chơi hoặc sửa màn đã lưu.

Trong editor: dùng phím mũi tên hoặc chuột trái chọn ô; 1/2/3 đặt ô, 0 xóa ô, K đặt quân ngựa, T rồi Enter đặt cổng, V bắt đầu xác minh. Giải xong màn xác minh, bấm S và đặt tên để lưu. Khi xác nhận lưu bằng Enter hoặc nút chạm, trình duyệt tự tải file `.txt` về thư mục Downloads và vẫn lưu bản trong trình duyệt. Trong Saved Levels, Enter chơi, L sửa, X xóa. Sửa một màn đã lưu có thể dùng lại tên cũ để ghi đè; xác nhận lưu sẽ tải bản `.txt` mới.

Custom level cũng lưu trong `localStorage` của trình duyệt, nên không tự xuất hiện trên máy khác hoặc trên GitHub. Dùng **Export selected** nếu cần tải lại file `.txt`, hoặc **Import .txt** để mang file sang trình duyệt khác. Muốn đưa một custom level thành màn chính công khai, đổi tên file đã tải thành `level_N.txt`, đặt vào `levels/mainlevels/` và cập nhật số màn như hướng dẫn trên.

## Điều khiển

Trên bàn cờ và lúc xác minh custom level, **chuột trái** đổi hướng di chuyển. **Chuột phải** xác nhận nước đi nếu đã chọn hướng; nếu chưa chọn hướng, chuột phải hoàn tác. Chuột phải không mở menu ảnh của trình duyệt trên Canvas. Trong menu, chuột trái chọn mục và chuột phải mở mục đang chọn. Trên màn thắng, chuột phải qua màn tiếp theo.

| Màn hình | Phím |
| --- | --- |
| Title | Up/Down chọn mục, Left/Right chọn màn replay, Enter mở, S cài đặt, X về More |
| Board | Up/Down đổi hướng, Enter đi, Left hoàn tác, H gợi ý, F flag, giữ D để xóa tiến độ, E về menu, X về More |
| Win | Space qua màn, E về menu, X về More |
| More | Left/Right chọn mục, Enter mở, E về menu |
| Settings | Up/Down chọn cài đặt, Left/Right thay đổi, E về menu |
| Saved Levels | Up/Down chọn màn, Left/Right đổi trang, Enter chơi, L sửa, X xóa, E quay lại |
| Editor | Arrows chọn ô, 0–3 sửa ô, K đặt ngựa, T/Enter đặt cổng, D xóa cổng, V xác minh, S lưu sau xác minh, E quay lại |

## Mã nguồn web

- `game.js` khởi động ứng dụng; `controller.mjs` xử lý màn hình và input.
- `audio.mjs` quản lý nhạc và hiệu ứng; `board.mjs` quản lý nước đi, hoàn tác, gợi ý, flag và điểm.
- `level-loader.mjs` tải từng file màn; `level.mjs` đọc và ghi định dạng `.txt`.
- `editor.mjs` tạo và xác minh custom level; `storage.mjs` lưu dữ liệu trong trình duyệt; `renderer.mjs` vẽ ảnh gốc lên Canvas.
- `assets/images/` và `assets/music/` là bản sao nguyên vẹn của ảnh và âm thanh game Java. Âm thanh chỉ được tải sau tương tác đầu tiên.
