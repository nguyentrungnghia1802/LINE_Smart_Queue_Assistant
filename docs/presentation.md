# LINE Smart Queue Assistant — Thuyết Trình

**Thời lượng:** 12–15 phút  
**Người thuyết trình:** Tôi  
**Khán giả:** Anh (Quản lý cấp trên)

---

## Phần 1: Giới thiệu (2 phút)

> Xin chào anh! Hôm nay tôi xin thuyết trình về sản phẩm **LINE Smart Queue Assistant** — một hệ thống quản lý xếp hàng thông minh, tích hợp LINE.

### Tình huống hiện tại

- Khách hàng vào cửa hàng chưa biết phải chờ bao lâu
- Staff không có công cụ để quản lý thứ tự xếp hàng hiệu quả
- Manager không thể theo dõi doanh thu, hiệu suất từ xa

### Giải pháp

Hệ thống này giúp:

- 👥 **Khách hàng** lấy số thứ tự qua QR Code → nhận thông báo LINE khi đến lượt
- 👔 **Staff** quản lý xếp hàng bằng giao diện web (gọi, phục vụ, bỏ qua)
- 📊 **Manager** xem doanh thu, trạng thái queue từ bảng điều khiển

---

## Phần 2: Luồng hoạt động chính (7–8 phút)

### Bước 1: Khách hàng quét QR tại quầy

```
[Quầy bán hàng]
      │
      └─► QR Code treo tường
           │
           └─► Camera điện thoại quét
                │
                └─► LINE tự động mở ứng dụng
                     (hoặc mở trình duyệt web)
```

**Trình diễn:**

- Dịch mã QR từ ManagerQR page → scan bằng điện thoại
- Trang landing hiển thị: tên cửa hàng, sản phẩm, thời chờ dự tính
- Khách chọn sản phẩm, nhập tên/SĐT → **Lấy số thứ tự**

### Bước 2: Khách hàng nhận số thứ tự + Notification

```
System tạo:
  ✓ Queue entry (số thứ tự A001, A002, ...)
  ✓ Order (danh sách sản phẩm, giá tiền)
  ✓ Push notification LINE: "Số của bạn: A001, vị trí 5/12"
```

**Khách hàng nhìn thấy:**

- Đơn hàng của tôi: số thứ tự, sản phẩm, tổng tiền
- Thời chờ dự tính: ~10 phút
- Badge: "Gọi lượt" khi đến gần

### Bước 3: Staff nhìn bảng xếp hàng thực thời

```
[Staff Dashboard]
┌─────────────────────────────────────┐
│  Counter A — 12 khách chờ          │
├─────────────────────────────────────┤
│  ⭐ A001 Nguyễn Văn An          │
│  ⏳ A002 Phạm Thị B (4 min)    │
│  ⏳ A003 Trần Minh C (8 min)   │
└─────────────────────────────────────┘
```

**Trình diễn:**

- Mở Staff Dashboard
- Nhấn **"Gọi lượt tiếp theo"** → A001 được đánh dấu "CALLED"
- Hệ thống tự động gửi LINE notification cho A001: "Vào quầy ngay!"

### Bước 4: Staff hoàn thành phục vụ

```
Staff thao tác:
  1. Nhấn "Phục vụ" → order status = "serving"
  2. Phục vụ khách ~30 phút
  3. Nhấn "Hoàn thành" → order status = "completed"
     → Doanh thu được tính
     → A002 tự động được gọi tiếp
```

**Tác dụng:**

- ETA tự động cập nhật cho khách hàng chờ
- Notification LINE gửi cho A002: "Đến lượt bạn rồi!"

---

## Phần 3: Bảng điều khiển Manager (3–4 phút)

### Dashboard chính

```
Manager mở http://localhost:5173/manager
```

**Hiển thị:**

1. **Revenue Overview** — tổng doanh thu hôm, 7 ngày, tỷ lệ huỷ
2. **Top Services** — sản phẩm bán chạy nhất
3. **Queue Status** — số khách chờ từng loại
4. **Recent Orders** — 10 đơn hàng gần nhất (trạng thái, giá tiền)

**Trình diễn:**

- Nhấn tab "Queues" → quản lý từng loại queue (mở, đóng, tăng giới hạn)
- Nhấn tab "Products" → thêm/sửa sản phẩm, thay đổi thời phục vụ
- Nhấn tab "Staff" → thêm nhân viên, quản lý ca làm

---

## Phần 4: Lợi ích chính (1–2 phút)

### Cho khách hàng

✅ Không phải chờ dựng lâu — biết rõ thứ tự + thời gian  
✅ Nhận thông báo LINE khi gọi → không lo bỏ lượt  
✅ Có thể theo dõi từ bất cứ đâu qua ứng dụng

### Cho Staff

✅ Giao diện đơn giản, rõ ràng — không bị nhầm lẫn thứ tự  
✅ Tự động tính ETA — không phải nhắc khách  
✅ Đặc biệt hỗ trợ khi bận rộn

### Cho Manager

✅ Báo cáo doanh thu chi tiết (ngày/tuần/tháng)  
✅ Phát hiện sản phẩm bán chậm → điều chỉnh  
✅ Quản lý nhân viên từ xa, theo dõi hiệu suất  
✅ Giảm tình trạng khách không hiểu hay bỏ lượt

---

## Phần 5: Công nghệ + Bảo mật (1 phút)

### Stack công nghệ

- **Frontend:** React + TypeScript (mỹ quan, trải nghiệm tốt)
- **Backend:** Node.js + TypeScript (hiệu suất cao, dễ mở rộng)
- **Database:** PostgreSQL 16 (dữ liệu an toàn, truy vấn nhanh)
- **Messaging:** LINE Messaging API (push real-time)

### Bảo mật

- 🔐 JWT Token cho xác thực người dùng
- 🔒 Dữ liệu khách hàng được mã hóa, không lưu password rõ
- 🛡️ Xác nhận chữ ký LINE trước xử lý webhook
- 👤 Phân quyền: Admin > Manager > Staff > Customer

---

## Phần 6: Demo trực tiếp (2–3 phút)

### Kịch bản demo

**Tình cảnh:** Hôm nay quầy cắt tóc có 3 khách đến

1. **Khách thứ 1 quét QR → lấy số A001**
   - Hiện trên Staff dashboard
   - A001 thấy: "Chờ dự tính 10 phút"

2. **Khách thứ 2 quét → A002**
   - Thời chờ cập nhật: "15 phút"

3. **Staff nhấn "Gọi" A001**
   - A001 nhận LINE notification: "Vào quầy!"
   - Dashboard đổi màu: A001 đang phục vụ

4. **10 phút sau, Staff hoàn thành → nhấn "OK"**
   - A002 tự động được gọi
   - A002 nhận notification
   - Doanh thu cộng vào tổng

5. **Manager mở dashboard**
   - Thấy 1 đơn hoàn thành, 1 đơn đang xử lý
   - Doanh thu hôm: +350,000 đ

---

## Phần 7: Kế hoạch tiếp theo (tuỳ chọn)

### Tính năng sắp tới

- 📱 Ứng dụng di động native (iOS, Android)
- 💳 Tích hợp thanh toán online
- 📈 Phân tích AI: dự báo khách đông, tối ưu nhân sự
- 📢 Quảng cáo sản phẩm qua LINE

### Mở rộng

- Hỗ trợ nhiều chi nhánh cửa hàng
- Báo cáo so sánh hiệu suất giữa chi nhánh
- API cho hệ thống bán hàng bên ngoài

---

## Câu hỏi & Trao đổi

**Anh có câu hỏi hoặc góp ý gì không?**

---

## Phụ lục: Tài khoản demo

Nếu anh muốn thử:

| Vai trò  | Email              | Mật khẩu |
| -------- | ------------------ | -------- |
| Manager  | manager@gmail.com  | 123456   |
| Staff    | staff@gmail.com    | 123456   |
| Customer | customer@gmail.com | 123456   |

**Link:** `http://localhost:5173/login`

---

_Cảm ơn anh đã lắng nghe!_
