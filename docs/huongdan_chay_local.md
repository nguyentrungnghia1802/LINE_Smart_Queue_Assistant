# Hướng dẫn chạy dự án LINE Smart Queue Assistant (Local)

## 1. Yêu cầu hệ thống

- Node.js >= 18 (khuyên dùng Node 20 hoặc 22)
- PostgreSQL >= 13 (cài sẵn, đã tạo user và database)
- Git, npm

## 2. Cấu hình môi trường

- Copy file `.env.example` thành `.env` và điền các thông tin kết nối database, JWT, ...
- Ví dụ cấu hình DB:
  ```env
  DATABASE_URL=postgresql://postgres:your_password@localhost:5432/line_queue
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=line_queue
  DB_USER=postgres
  DB_PASSWORD=your_password
  ```

## 3. Cài đặt dependencies

```bash
npm install
```

## 4. Khởi tạo database

- **Tạo schema và seed dữ liệu mẫu:**

```bash
npm run db:migrate      # Tạo bảng
npm run db:seed         # Thêm dữ liệu mẫu
```

- Nếu muốn reset sạch DB:

```bash
npm run db:reset        # Xóa sạch schema (dev only)
npm run db:migrate
npm run db:seed
```

## 5. Chạy backend API

```bash
npm run dev -w apps/api
```

- API mặc định chạy ở: http://localhost:4000

## 6. Chạy frontend web

```bash
npm run dev -w apps/web
```

- Web chạy ở: http://localhost:5173

## 7. Một số lỗi thường gặp

- **Port 4000 đã bị chiếm:**
  - Tắt các process backend cũ hoặc kill port: `netstat -ano | findstr :4000` rồi `taskkill /PID <PID> /F`
- **Không thấy bảng trong DB:**
  - Kiểm tra lại kết nối đúng DB, đúng port, đúng user.
- **API báo NOT_FOUND:**
  - Đảm bảo gọi đúng endpoint, ví dụ `/api/queues`, `/api/health`.

## 8. Liên hệ & hỗ trợ

- Nếu gặp lỗi, gửi log terminal và file `.env` (ẩn thông tin nhạy cảm) để được hỗ trợ.

---
