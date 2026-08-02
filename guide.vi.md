# HƯỚNG DẪN SỬ DỤNG VÀ KIỂM THỬ

# LINE SMART QUEUE ASSISTANT

## 1. Mục đích tài liệu

Tài liệu này giúp ông Yamada và ông Omura có thể tự truy cập, hiểu, trải nghiệm và kiểm thử LINE Smart Queue Assistant từ đầu đến cuối mà không cần đọc mã nguồn.

Hướng dẫn đi theo hành trình thực tế: doanh nghiệp đăng ký dịch vụ, Platform Admin xét duyệt, Organization Owner thiết lập tổ chức, Branch Manager chuẩn bị chi nhánh và hàng đợi, khách hàng đặt lượt qua LINE/LIFF, sau đó Staff phục vụ và hoàn thành lượt.

Các ảnh trong tài liệu dùng chung bộ giao diện tiếng Nhật đã chụp bằng dữ liệu demo cô lập. Tên tiếng Nhật xuất hiện trong ảnh là dữ liệu mẫu, không phải dữ liệu khách hàng thật.

## 2. Thông tin truy cập

| Hạng mục              | Giá trị dùng khi kiểm thử                                                                |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Production URL        | `[BỔ SUNG PRODUCTION URL]`                                                               |
| Test URL              | `http://localhost:5173` cho bản local; `[BỔ SUNG TEST URL DÙNG CHUNG]` nếu có            |
| Email hỗ trợ          | `support@smartqueue.io.vn`                                                               |
| LINE Official Account | `[BỔ SUNG TÊN/LIÊN KẾT OA]`                                                              |
| Branch QR             | Local: mở mục **Mã QR** của Branch Manager; môi trường dùng chung: `[BỔ SUNG BRANCH QR]` |
| Ngày tài liệu         | `02/08/2026`                                                                             |
| Phiên bản             | `[BỔ SUNG RELEASE/COMMIT ĐƯỢC REVIEW]`                                                   |

> Khi review trên môi trường dùng chung, hãy xác nhận lại URL, phiên bản và QR với người phụ trách dự án. Không dùng QR của production để tạo dữ liệu thử nếu chưa được cho phép.

## 3. Tài khoản kiểm thử

Các tài khoản dưới đây chỉ dành cho dữ liệu demo local. Không dùng chúng cho production.

| Vai trò               | Email/Tài khoản                                                                  | Mật khẩu                   | Phạm vi                                                       |
| --------------------- | -------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------- |
| Platform Admin        | `admin@gmail.com`                                                                | `123456`                   | Toàn nền tảng: hồ sơ đăng ký và tổ chức                       |
| Organization Owner    | `manager2@gmail.com`                                                             | `123456`                   | Tổ chức demo, danh mục, chi nhánh, quản lý chi nhánh và audit |
| Branch Manager        | `manager@gmail.com`                                                              | `123456`                   | Một chi nhánh được phân công: Queue, stock, Staff, QR và lịch |
| Staff                 | `staff@gmail.com`                                                                | `123456`                   | Không gian phục vụ tại chi nhánh được phân công               |
| Customer through LINE | Mock LIFF: **Khách LINE demo**; thiết bị thật: tài khoản LINE của người kiểm thử | Không có mật khẩu hệ thống | Đặt lượt và xem ticket qua LINE/LIFF                          |

Nếu môi trường dùng chung dùng mật khẩu khác, hãy thay ô mật khẩu bằng `[CUNG CẤP QUA KÊNH AN TOÀN]`. Không ghi mật khẩu production vào tài liệu hoặc báo lỗi.

## 4. Tổng quan hệ thống

LINE Smart Queue Assistant giải quyết việc khách phải đứng chờ tại quầy mà không biết khi nào đến lượt. Khách quét một QR ổn định của chi nhánh, đăng nhập qua LINE, chọn hàng đợi và sản phẩm/dịch vụ, rồi nhận ticket có số người phía trước và thời gian chờ ước tính.

Các nhóm người dùng chính:

- **Business Applicant** gửi hồ sơ đăng ký dịch vụ.
- **Platform Admin** xét duyệt hoặc từ chối hồ sơ.
- **Organization Owner** quản lý danh mục sản phẩm/dịch vụ và các chi nhánh.
- **Branch Manager** vận hành một chi nhánh được giao.
- **Staff** xử lý các ticket đang hoạt động.
- **Customer** sử dụng LINE/LIFF, không dùng email/mật khẩu doanh nghiệp.

Trải nghiệm khách hàng là LINE-first: QR dẫn vào LIFF, LINE Login xác minh danh tính, còn LINE Messaging API là khả năng riêng dùng để gửi thông báo khi đủ điều kiện.

## 5. Tổng quan vai trò và quyền hạn

| Vai trò            | Có thể làm                                                                          | Không thuộc phạm vi vai trò                                      |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Business Applicant | Nhập thông tin doanh nghiệp, chọn gói, thanh toán demo và gửi hồ sơ                 | Không đặt mật khẩu quản lý; không tự tạo tổ chức                 |
| Platform Admin     | Xem/sửa hồ sơ đang chờ, duyệt, từ chối, xem tổ chức                                 | Không vận hành Queue thay chi nhánh trong luồng thông thường     |
| Organization Owner | Cài đặt tổ chức, danh mục, chi nhánh, mời/gỡ Branch Manager, xem audit và analytics | Không trực tiếp quản lý Queue, Staff, stock hay QR của chi nhánh |
| Branch Manager     | Quản lý đúng một chi nhánh được giao: lịch, Queue, gán danh mục, stock, Staff, QR   | Không sửa danh mục cấp tổ chức hoặc chi nhánh khác               |
| Staff              | Xem khách/đơn hàng, gọi/phục vụ/hoàn thành/hủy/no-show và in biên nhận              | Không cấu hình tổ chức, Queue, danh mục hoặc phân quyền          |
| Customer           | Chọn Queue, chọn mục, đặt lượt, thanh toán khi cần, xem ticket/lịch sử/cài đặt      | Không truy cập cổng doanh nghiệp                                 |

```mermaid
flowchart LR
  A[Doanh nghiệp gửi hồ sơ] --> B[Platform Admin xét duyệt]
  B --> C[Owner kích hoạt tài khoản]
  C --> D[Owner tạo danh mục và chi nhánh]
  D --> E[Branch Manager tạo Queue, stock, Staff và QR]
  E --> F[Customer quét QR và đặt lượt qua LINE]
  F --> G[Staff phục vụ]
  G --> H[Hoàn thành, biên nhận và thông báo LINE]
```

## 6. Luồng tổng thể

Luồng đầy đủ của hệ thống hiện tại:

1. Doanh nghiệp mở trang công khai và đăng ký sử dụng.
2. Người đăng ký nhập thông tin doanh nghiệp, đầu mối liên hệ và địa chỉ.
3. Người đăng ký khai số chi nhánh, lượng khách dự kiến và chọn gói phù hợp.
4. Demo Payment xác nhận hồ sơ thử nghiệm rồi gửi hồ sơ chờ duyệt.
5. Platform Admin mở hồ sơ, kiểm tra, sửa khi hồ sơ còn chờ nếu cần, rồi duyệt hoặc từ chối.
6. Khi duyệt, hệ thống tạo **Organization** và tài khoản **Owner ở trạng thái được mời**. Hệ thống **không tự tạo Branch hoặc Queue**.
7. Owner mở liên kết email dùng một lần, đặt mật khẩu và đăng nhập.
8. Owner tạo danh mục Product/Service cấp Organization.
9. Owner tạo Branch và mời ít nhất một Branch Manager.
10. Branch Manager đặt lịch hoạt động, tạo Queue, gán Product/Service, cấu hình stock và mời Staff.
11. Branch Manager công bố QR ổn định của Branch.
12. Customer quét QR, đăng nhập LINE, chọn Queue và mục cần dùng.
13. Customer đặt Booking; nếu có mục bắt buộc trả trước thì hoàn tất Demo Payment.
14. Hệ thống phát Ticket và hiển thị mã lượt, mã đơn, số người phía trước và ETA.
15. Staff gọi, bắt đầu phục vụ, thu phần còn lại nếu có, rồi hoàn thành.
16. Customer xem trạng thái hoàn thành/biên nhận; thông báo LINE được gửi nếu khách đủ điều kiện nhận.

## 7. Doanh nghiệp đăng ký sử dụng

### Mục đích

Tạo một hồ sơ đăng ký doanh nghiệp để Platform Admin xem xét. Người đăng ký chỉ cung cấp thông tin doanh nghiệp; biểu mẫu không yêu cầu mật khẩu quản lý.

### Điều kiện trước khi thực hiện

- Có URL của hệ thống.
- Có email công việc demo hoặc email được phép dùng để test.
- Biết số chi nhánh dự kiến và lượng khách trung bình hàng tháng.
- Đang dùng môi trường test có Demo Payment.

### Các bước thực hiện

1. Mở trang chủ.
2. Kiểm tra tên sản phẩm, nút **Đăng ký cho doanh nghiệp** và phần giới thiệu QR/LIFF.

![Trang chủ công khai](./docs/images/guide/01-landing-page.png)

_Hình 01 — Trang chủ công khai của LINE Smart Queue Assistant._

3. Nhấn **Đăng ký cho doanh nghiệp**.
4. Kiểm tra bước **Doanh nghiệp** và bảng tóm tắt gói ở bên phải.

![Bắt đầu đăng ký doanh nghiệp](./docs/images/guide/02-business-registration-start.png)

_Hình 02 — Điểm bắt đầu của biểu mẫu đăng ký._

5. Nhập lần lượt tên pháp lý, tên cửa hàng, loại hình, mã đăng ký, website nếu có, tên/chức vụ người phụ trách, email công việc và số điện thoại Nhật Bản hợp lệ.
6. Nhập mã bưu điện, tỉnh/thành, quận/huyện và địa chỉ. Không nhập mật khẩu Owner hoặc Manager.

![Biểu mẫu thông tin doanh nghiệp](./docs/images/guide/03-business-registration-form.png)

_Hình 03 — Thông tin doanh nghiệp, đầu mối liên hệ và địa chỉ bằng dữ liệu demo._

7. Nhấn **Tiếp theo**.
8. Nhập số cơ sở dự kiến và lượng khách hàng tháng.
9. Đọc hướng dẫn mức độ phù hợp rồi chọn **Starter**, **Standard** hoặc **Scale**. Giới hạn hiện tại là Starter tối đa 1 Branch, Standard tối đa 3 Branch, Scale không đặt giới hạn Branch trong cấu hình gói.

![Chọn gói đăng ký](./docs/images/guide/04-business-registration-plan.png)

_Hình 04 — Chọn gói và hướng dẫn mức độ phù hợp theo quy mô._

10. Nhấn **Tiếp theo**, kiểm tra tóm tắt và đánh dấu đồng ý điều khoản.
11. Nhấn **Thanh toán demo và gửi hồ sơ**. Demo Payment chỉ mô phỏng kết quả thành công trong môi trường test.
12. Ghi lại mã hồ sơ được hiển thị.

![Gửi hồ sơ thành công](./docs/images/guide/05-business-registration-complete.png)

_Hình 05 — Hồ sơ đã gửi và đang chờ Platform Admin xét duyệt._

### Kết quả mong đợi

- Trang xác nhận hiển thị **Hồ sơ đang chờ xét duyệt** và mã hồ sơ.
- Hồ sơ xuất hiện trong danh sách **Xét duyệt** của Platform Admin.
- Không có tài khoản Owner, Branch hoặc Queue nào được tạo ở bước gửi hồ sơ.
- Email đăng ký trùng hoặc payment reference đã dùng phải bị từ chối rõ ràng, không tạo hồ sơ trùng.

### Trường hợp nên kiểm thử

- Bỏ trống trường bắt buộc.
- Nhập email sai định dạng, số điện thoại không hợp lệ hoặc mã bưu điện sai.
- Chọn số chi nhánh vượt giới hạn của gói.
- Thử gửi hai lần cùng email/payment reference.
- Quay lại bước trước và xác nhận dữ liệu đã nhập còn đúng.
- Đổi Nhật/Việt/Anh trong khi điền biểu mẫu.

### Ảnh minh họa

Hình 01–05 ở ngay sau từng thao tác là toàn bộ luồng đăng ký tự động. Không có mật khẩu quản lý trong bất kỳ ảnh nào.

## 8. Platform Admin xét duyệt

### Mục đích

Kiểm tra tính đầy đủ của hồ sơ, chỉnh sửa hồ sơ đang chờ khi cần, rồi duyệt hoặc từ chối.

### Điều kiện trước khi thực hiện

- Có tài khoản Platform Admin.
- Có ít nhất một hồ sơ trạng thái **Chờ duyệt**.
- Môi trường email test đã được cấu hình; local dùng email mock và không gửi ra người thật.

### Các bước thực hiện

1. Mở `/login`.
2. Nhập tài khoản Platform Admin và nhấn **Đăng nhập**. Đây là đăng nhập email/mật khẩu dành cho vai trò doanh nghiệp, không phải LINE Login.

![Đăng nhập Platform Admin](./docs/images/guide/06-admin-login.png)

_Hình 06 — Trang đăng nhập chung cho Admin, Owner, Branch Manager và Staff._

3. Kiểm tra **Tổng quan quản trị**, số tổ chức, hồ sơ chờ duyệt, tăng trưởng và phân bổ gói.

![Dashboard Platform Admin](./docs/images/guide/07-admin-dashboard.png)

_Hình 07 — Dashboard tổng quan của Platform Admin._

4. Chọn menu **Xét duyệt**.
5. Dùng các tab **Chờ duyệt**, **Đã duyệt**, **Từ chối**, **Tất cả** hoặc ô tìm kiếm để tìm hồ sơ.

![Danh sách hồ sơ đăng ký](./docs/images/guide/08-admin-applications.png)

_Hình 08 — Danh sách hồ sơ đăng ký theo trạng thái._

6. Nhấn vào dòng hồ sơ cần kiểm tra.
7. Đối chiếu thông tin doanh nghiệp, liên hệ, địa chỉ, quy mô, gói và trạng thái Demo Payment.
8. Nếu hồ sơ vẫn **Chờ duyệt** và có lỗi có thể sửa an toàn, chỉnh trường tương ứng rồi nhấn **Lưu hồ sơ**.

![Chi tiết hồ sơ đăng ký](./docs/images/guide/09-admin-application-detail.png)

_Hình 09 — Hộp chi tiết cho phép kiểm tra và cập nhật hồ sơ đang chờ._

9. Để duyệt, nhấn **Duyệt và tạo tổ chức** rồi xác nhận cảnh báo.
10. Kiểm tra thông báo thành công và hồ sơ chuyển sang **Đã duyệt**.

![Kết quả duyệt hồ sơ](./docs/images/guide/10-admin-application-approval.png)

_Hình 10 — Kết quả sau khi tạo Organization và tài khoản Owner được mời._

11. Để kiểm thử từ chối, dùng một hồ sơ demo khác, chọn **Từ chối**, nhập lý do rõ ràng và xác nhận.

### Kết quả mong đợi

- Duyệt thành công tạo **Organization** và một **Owner được mời**.
- Duyệt **không tạo Branch và không tạo Queue**. Owner phải tự thiết lập các phần này sau khi kích hoạt.
- Khi email delivery hoạt động, Owner nhận email kích hoạt; hồ sơ bị từ chối nhận email thông báo/lý do. Local mock chỉ ghi nhận email test, không gửi thật.
- Thao tác duyệt/từ chối lặp lại không tạo thêm Organization.

### Trường hợp nên kiểm thử

- Tìm theo tên doanh nghiệp, email và mã hồ sơ.
- Lưu thay đổi của hồ sơ đang chờ.
- Duyệt hồ sơ có Demo Payment hợp lệ.
- Từ chối với và không có lý do bắt buộc.
- Mở hồ sơ đã duyệt và xác nhận không thể duyệt lần hai.
- Sau khi duyệt, đăng nhập Owner trước khi kích hoạt và xác nhận bị từ chối.

### Ảnh minh họa

Hình 06–10 minh họa cổng Admin và kết quả duyệt. Email kích hoạt thật cần được kiểm tra riêng trong hộp thư test.

## 9. Owner kích hoạt tài khoản

### Mục đích

Cho phép Owner được mời tự đặt mật khẩu và kích hoạt tài khoản bằng liên kết email dùng một lần.

### Điều kiện trước khi thực hiện

- Hồ sơ đã được Platform Admin duyệt.
- Có email kích hoạt trong hộp thư test hoặc liên kết kích hoạt do người phụ trách cung cấp an toàn.
- Liên kết chưa hết hạn và chưa được dùng.

### Các bước thực hiện

1. Mở email **Kích hoạt tài khoản Smart Queue Assistant**.
2. Nhấn liên kết kích hoạt. Hệ thống chỉ hiển thị email đã che bớt để tránh lộ thông tin.
3. Nhập mật khẩu mới tối thiểu 10 ký tự và nhập lại chính xác.

![Kích hoạt tài khoản Owner](./docs/images/guide/11-owner-activation.png)

_Hình 11 — Liên kết hợp lệ hiển thị Owner/Organization và email đã che._

4. Nhấn **Bắt đầu sử dụng**.
5. Quay lại trang đăng nhập và đăng nhập bằng email công việc cùng mật khẩu vừa tạo.
6. Nếu quên mật khẩu, chọn **Quên mật khẩu?**, nhập email và dùng liên kết reset nhận được. Màn hình luôn trả kết quả chung để không tiết lộ email có tồn tại hay không.

### Kết quả mong đợi

- Tài khoản và Organization chuyển sang hoạt động sau khi đặt mật khẩu hợp lệ.
- Link kích hoạt bị tiêu thụ sau lần thành công đầu tiên.
- Link hết hạn, sai hoặc đã dùng hiển thị thông báo không hợp lệ và không đổi mật khẩu.
- Đổi/reset mật khẩu làm các phiên đăng nhập cũ hết hiệu lực.

### Trường hợp nên kiểm thử

- Mật khẩu ngắn, xác nhận không trùng hoặc không đạt chính sách.
- Mở cùng link trong hai cửa sổ và chỉ hoàn tất ở một cửa sổ.
- Dùng lại link sau khi đã kích hoạt.
- Mở link hết hạn hoặc bị cắt mất một phần.
- Thử **Quên mật khẩu** với email có và không có trong hệ thống.

### Ảnh minh họa

Hình 11 chỉ dùng token fixture local và không để lộ token trong ảnh. Không chụp URL chứa token khi báo lỗi.

## 10. Organization Owner sử dụng hệ thống

### Mục đích

Thiết lập dữ liệu cấp Organization: thông tin tổ chức, danh mục Product/Service, Branch, Branch Manager, audit và analytics.

### Điều kiện trước khi thực hiện

- Owner đã kích hoạt tài khoản và đăng nhập.
- Organization đang hoạt động.
- Biết gói hiện tại và số Branch còn có thể tạo.

### Các bước thực hiện

1. Mở **Tổng quan** để xem doanh thu, số chi nhánh và hiệu quả theo chi nhánh.

![Dashboard Organization Owner](./docs/images/guide/12-owner-dashboard.png)

_Hình 12 — Dashboard cấp Organization của Owner._

2. Mở **Cài đặt** để cập nhật tên, thông tin liên hệ, địa chỉ và lịch mặc định của Organization. Lịch này là cơ sở khởi tạo cho Branch mới; Branch Manager vẫn quản lý lịch Branch của mình.
3. Mở **Sản phẩm**. Danh sách ở đây thuộc Organization, không thuộc riêng một Branch.

![Danh mục sản phẩm và dịch vụ](./docs/images/guide/13-owner-product-catalog.png)

_Hình 13 — Danh mục dùng chung của Organization với mã DV/SP tự sinh._

4. Nhấn **+ Thêm sản phẩm**.
5. Nhập tên, chọn **Sản phẩm** hoặc **Dịch vụ**, thêm mô tả/ảnh, giá, thời lượng phục vụ và thời gian chờ tối đa nếu cần.
6. Bật **Bắt buộc trả trước** nếu mục này phải thanh toán trước khi Booking được xác nhận.
7. Nhấn **Lưu**. Hệ thống tự sinh mã ổn định theo loại, ví dụ `SP...` cho Product và `DV...` cho Service; người dùng không tự nhập mã.

![Tạo Product hoặc Service](./docs/images/guide/14-owner-create-product.png)

_Hình 14 — Biểu mẫu tạo mục mới trong danh mục Organization._

8. Mở **Chi nhánh** để xem danh sách Branch, số Queue và các Branch Manager hiện tại.

![Danh sách Branch](./docs/images/guide/15-owner-branches.png)

_Hình 15 — Danh sách Branch thuộc Organization._

9. Nhấn **+ Thêm chi nhánh**.
10. Nhập tên, điện thoại Nhật Bản, email nếu có, mã bưu điện và địa chỉ.
11. Thêm ít nhất một Branch Manager bằng tên, email công việc, số điện thoại, chức danh và mã nhân viên. Đây là lời mời; Owner không đặt mật khẩu thay người được mời.
12. Nhấn **Tạo chi nhánh**. Starter cho phép tối đa 1 Branch, Standard tối đa 3, Scale không đặt giới hạn trong cấu hình hiện tại.

![Tạo Branch](./docs/images/guide/16-owner-create-branch.png)

_Hình 16 — Tạo Branch đồng thời mời ít nhất một Branch Manager._

13. Tại thẻ Branch, nhấn **Thêm quản lý** để mời thêm người quản lý.
14. Dùng thao tác gỡ để loại một Branch Manager khi cần. Không thể gỡ người quản lý hoạt động cuối cùng của Branch.

![Quản lý Branch Manager](./docs/images/guide/17-owner-branch-managers.png)

_Hình 17 — Hộp mời thêm Branch Manager vào Branch đã có._

15. Mở **Nhật ký** để xem các hành động nhân sự/Branch. Với dữ liệu mới, trang có thể hiển thị **Chưa có hoạt động** cho đến khi phát sinh sự kiện phù hợp.

![Nhật ký của Owner](./docs/images/guide/18-owner-audit.png)

_Hình 18 — Audit cấp Organization._

16. Chỉ xóa Branch demo khi thật sự cần. Đọc kỹ hộp cảnh báo: xóa Branch là hành động phá hủy, kéo theo Queue, đơn hàng, thanh toán, reservation, QR và dữ liệu vận hành liên quan; audit cuối vẫn được giữ để truy vết.

### Kết quả mong đợi

- Product/Service mới xuất hiện trong danh mục cấp Organization với mã tự sinh.
- Branch Manager chỉ được gán vào Branch đã chọn và nhận liên kết kích hoạt qua email khi delivery hoạt động.
- Branch mới có lịch khởi tạo và QR ổn định nhưng **không có Queue mặc định**.
- Owner thấy analytics/audit cấp Organization nhưng không thấy menu vận hành Queue, Staff, stock hoặc QR như Branch Manager.

### Trường hợp nên kiểm thử

- Tạo một Service giá 0 và một Product có giá.
- Tạo mục có/không bắt buộc trả trước, có/không có ảnh.
- Xác nhận mã SP/DV tăng tuần tự và không đổi khi sửa.
- Tạo Branch tới giới hạn gói rồi thử tạo thêm.
- Mời email trùng hoặc gỡ người quản lý cuối cùng.
- Đăng nhập Owner rồi thử mở URL Queue/Staff của Branch Manager; hệ thống phải từ chối hoặc chuyển hướng.
- Kiểm tra cảnh báo trước khi xóa Branch, không xác nhận trên dữ liệu cần giữ.

### Ảnh minh họa

Hình 12–18 minh họa đúng các màn hình Owner hiện có. Stock trong Hình 13 không phải stock dùng chung; số tồn thực tế được quản lý ở từng Branch.

## 11. Branch Manager sử dụng hệ thống

### Mục đích

Chuẩn bị và vận hành một Branch được phân công: thông tin chi nhánh, lịch, Queue, danh mục theo Queue, stock, Staff và QR.

### Điều kiện trước khi thực hiện

- Branch Manager đã kích hoạt và đăng nhập bằng email/mật khẩu doanh nghiệp.
- Tài khoản có đúng một Branch đang hoạt động được phân công.
- Owner đã tạo danh mục Product/Service cấp Organization.

### Các bước thực hiện

1. Mở **Tổng quan** và kiểm tra đúng tên Branch. Dashboard hiển thị doanh thu, tổng đơn, tỷ lệ hủy, số đơn đang xử lý, khách đang chờ và ETA trung bình nếu có dữ liệu.

![Dashboard Branch Manager](./docs/images/guide/19-branch-manager-dashboard.png)

_Hình 19 — Tổng quan vận hành của Branch Manager._

2. Mở **Cài đặt** để cập nhật tên, điện thoại, email, địa chỉ và cấu hình thanh toán của Branch.

![Cài đặt Branch](./docs/images/guide/20-branch-settings.png)

_Hình 20 — Thông tin và thiết lập nhìn thấy ở phạm vi Branch._

3. Tại **Giờ hoạt động**, bật/tắt ngày đóng cửa và đặt giờ mở/đóng cho từng ngày trong tuần.
4. Tại phần ngày ngoại lệ, thêm ngày nghỉ/lễ hoặc giờ khác thường. Ngày ngoại lệ được ưu tiên hơn lịch tuần.

![Giờ hoạt động và lịch ngoại lệ](./docs/images/guide/21-business-calendar.png)

_Hình 21 — Lịch tuần và khu vực cấu hình ngày ngoại lệ._

5. Mở **Hàng đợi**. Mỗi thẻ cho biết trạng thái và số liệu live.

![Danh sách Queue](./docs/images/guide/22-queue-list.png)

_Hình 22 — Một Branch có nhiều Queue độc lập._

6. Hiểu bốn trạng thái cấu hình:
   - **Đóng (Closed):** không nhận Booking mới.
   - **Đang mở (Open):** nhận khách nếu Branch đang trong giờ hoạt động và chưa đầy.
   - **Tạm dừng (Paused):** tạm ngừng nhận Booking mới nhưng vẫn giữ ticket đang hoạt động.
   - **Lưu trữ (Archived):** ngừng sử dụng Queue; không dùng cho Booking mới.
7. Nhấn **+ Tạo hàng đợi**.
8. Nhập tên, mô tả, trạng thái, tiền tố ticket, sức chứa tối đa và thời lượng phục vụ mặc định.
9. Kiểm tra cấu hình vắng mặt: số vị trí lùi và số lần vắng tối đa. Dữ liệu demo dùng lùi 3 vị trí, tối đa 3 lần.

![Tạo Queue](./docs/images/guide/23-create-queue.png)

_Hình 23 — Thông tin cơ bản và quy tắc vận hành của Queue._

10. Trong cùng biểu mẫu, tìm và đánh dấu Product/Service từ danh mục Organization để gán vào Queue. Khách chỉ nhìn thấy các mục đã gán cho Queue đang chọn.

![Gán Product hoặc Service vào Queue](./docs/images/guide/24-queue-product-assignment.png)

_Hình 24 — Queue chọn mục từ danh mục Organization, không tạo bản sao sản phẩm._

11. Mở **Sản phẩm** trong phạm vi Branch để cập nhật stock. Service có stock không giới hạn; Product có thể là không giới hạn hoặc số lượng hữu hạn tùy giá trị stock.

![Quản lý stock theo Branch](./docs/images/guide/25-branch-stock.png)

_Hình 25 — Cùng mã SP/DV của Organization nhưng stock thuộc Branch hiện tại._

12. Mở **Nhân viên** để xem Staff, trạng thái, email, chức danh và mã nhân viên.

![Danh sách Staff](./docs/images/guide/26-staff-list.png)

_Hình 26 — Staff chỉ thuộc Branch đang quản lý._

13. Nhấn **+ Thêm nhân viên**, nhập thông tin và gửi lời mời. Branch Manager không đặt mật khẩu cho Staff.

![Mời Staff](./docs/images/guide/27-invite-staff.png)

_Hình 27 — Biểu mẫu mời Staff vào Branch._

14. Mở **Mã QR** để xem QR ổn định của Branch.
15. Dùng **Sao chép liên kết**, **Sao chép mã QR** hoặc **In mã QR**. Một Branch chỉ có một QR ổn định; sau khi quét, khách chọn một trong các Queue đang có.

![QR ổn định của Branch](./docs/images/guide/28-branch-qr.png)

_Hình 28 — QR Branch và các điều khiển sao chép/in._

16. Khi xem Queue, không hiểu nhầm `currentNumber`: đây là **số thứ tự mới nhất đã phát trong ngày**, không phải số khách đang chờ. Số đang chờ phải đọc từ bộ đếm waiting/live count riêng.

### Kết quả mong đợi

- Branch Manager chỉ xem và sửa Branch được phân công.
- Queue mới không xuất hiện cho khách khi Closed/Paused/Archived, ngoài giờ hoặc đầy.
- Mỗi Queue chỉ hiển thị các mục đã được gán và còn khả dụng tại Branch.
- Stock thay đổi ở Branch này không làm đổi stock của Branch khác.
- QR giữ nguyên khi thêm/bớt Queue.

### Trường hợp nên kiểm thử

- Chuyển Queue lần lượt Closed/Open/Paused/Archived.
- Đặt capacity nhỏ rồi tạo đủ số ticket hoạt động.
- Tạo hai Queue với tiền tố khác nhau.
- Gán/bỏ gán một Product và kiểm tra catalog khách hàng.
- Đặt một Product stock 0, hữu hạn và không giới hạn.
- Mời Staff trùng email hoặc nhập số điện thoại sai.
- Mở URL Branch khác bằng Branch Manager; hệ thống phải từ chối.
- Thay đổi lịch tuần/ngày lễ rồi kiểm tra khả năng Booking.

### Ảnh minh họa

Hình 19–28 bao phủ toàn bộ menu Branch Manager hiện tại. Không có màn hình analytics riêng ngoài dữ liệu tổng quan Branch đang hiển thị.

## 12. Customer sử dụng LINE

### Mục đích

Cho khách hàng quét QR của Branch, xác thực bằng LINE, chọn Queue/Product/Service, tạo Booking và theo dõi Ticket.

### Điều kiện trước khi thực hiện

- Branch và Queue đang hoạt động, nằm trong giờ mở cửa, chưa đầy.
- Queue đã được gán ít nhất một Product/Service còn khả dụng.
- Trên điện thoại thật: đã cài LINE và có mạng.
- Trên browser local: Mock LIFF bật và hiển thị **Khách LINE demo**; Demo Payment bật.

### Các bước thực hiện

1. Quét Branch QR bằng LINE hoặc mở liên kết QR trong Mock LIFF.
2. Nếu chưa đăng nhập LINE, hoàn tất LINE Login/LIFF. Customer không nhập email/mật khẩu doanh nghiệp.
3. Tại **Trang chủ**, kiểm tra tên khách LINE đã xác minh và các lối tắt Đặt chỗ/Lượt hiện tại/Lịch sử/Cài đặt.

![LIFF Home trên mobile](./docs/images/guide/29-liff-home-mobile.png)

_Hình 29 — Trang chủ Mock LIFF với khách hàng demo._

> **Ảnh minh họa cần bổ sung thủ công:**
>
> Chụp màn hình LINE Login consent trên thiết bị thật; không để lộ thông tin tài khoản không cần thiết.

> **Ảnh minh họa cần bổ sung thủ công:**
>
> Chụp màn hình Add Friend/Unblock Official Account trên thiết bị thật.

4. Chọn **Đặt chỗ** hoặc mở lại Branch QR.
5. Kiểm tra đúng tên/địa chỉ Branch rồi mở danh sách **Chọn hàng đợi phục vụ**.

![Chọn Queue trên mobile](./docs/images/guide/30-customer-queue-selection-mobile.png)

_Hình 30 — Một QR Branch cho phép khách chọn Queue phù hợp._

6. Chọn Queue. Kiểm tra số người phía trước, thời gian chờ dự kiến và catalog riêng của Queue.

![Catalog theo Queue](./docs/images/guide/31-customer-catalog-mobile.png)

_Hình 31 — Chỉ các Product/Service được gán cho Queue mới xuất hiện._

7. Nhấn tên/ảnh hoặc nút xem chi tiết để đọc mô tả, giá, loại, thời lượng, yêu cầu trả trước và tình trạng tồn.

![Chi tiết Product hoặc Service](./docs/images/guide/32-product-detail-mobile.png)

_Hình 32 — Chi tiết mục trong catalog trên mobile._

8. Dùng nút `+`/`−` để chọn số lượng. Không thể chọn quá stock còn khả dụng.
9. Nhập họ tên khách và số điện thoại Nhật Bản hợp lệ, ví dụ số di động 10–11 chữ số đúng định dạng.
10. Chọn **Chia sẻ** vị trí nếu đồng ý dùng vị trí cho cảnh báo khoảng cách. Đây là tùy chọn; từ chối không chặn Booking.

![Biểu mẫu Booking của khách](./docs/images/guide/33-customer-booking-form-mobile.png)

_Hình 33 — Số lượng, thông tin khách và tổng tiền trước khi Booking._

11. Với đơn không có mục bắt buộc trả trước, nhấn **Đặt chỗ**. Hệ thống tạo Booking/Ticket và chuyển thẳng tới Ticket; hiện không có một trang success trung gian riêng.
12. Với đơn có mục bắt buộc trả trước, nhấn **Thanh toán và đặt chỗ**.
13. Trong local, chọn một phương thức trên **Thanh toán trực tuyến** rồi nhấn **Thanh toán demo**. Không nhập thẻ thật.

![Demo Payment trên mobile](./docs/images/guide/34-demo-payment-mobile.png)

_Hình 34 — Màn hình Demo Payment; số thẻ chỉ là dữ liệu mẫu hiển thị sẵn._

14. Sau khi payment return thành công, kiểm tra hệ thống chuyển về Ticket mà không tạo trùng khi tải lại hoặc quay lại URL return.

![Booking thành công chuyển tới Ticket](./docs/images/guide/35-booking-success-mobile.png)

_Hình 35 — Kết quả ngay sau Booking: ứng dụng chuyển trực tiếp tới Ticket._

15. Trên Ticket, kiểm tra **Mã lượt**, **Mã đơn hàng**, trạng thái, số người phía trước, ETA, Branch/Queue, giờ tạo, danh sách mục, tổng tiền, đã thanh toán và số còn lại.

![Chi tiết Ticket của khách](./docs/images/guide/36-customer-ticket-mobile.png)

_Hình 36 — Ticket đang hoạt động và tóm tắt thanh toán._

16. Mở **Lịch sử** để xem Booking cũ/mới và trạng thái tổng quát.

![Lịch sử Booking](./docs/images/guide/37-customer-booking-history-mobile.png)

_Hình 37 — Danh sách Booking thuộc tài khoản LINE đã xác minh._

17. Mở **Cài đặt** để bật/tắt từng loại thông báo, quản lý vị trí và đăng xuất.

![Cài đặt LINE và quyền riêng tư](./docs/images/guide/38-customer-line-preferences-mobile.png)

_Hình 38 — Tùy chọn thông báo, dữ liệu vị trí và đăng xuất._

18. Đặt thêm trong **cùng Queue** khi Ticket còn hoạt động: hệ thống gộp vào hành trình/ticket đang có thay vì phát thêm một ticket cạnh tranh trong cùng Queue.
19. Đặt ở **Queue khác**: hệ thống tạo Ticket riêng cho Queue đó.
20. Nếu được hỏi thêm/bỏ chặn Official Account, có thể từ chối và vẫn Booking. Tuy nhiên, LINE push có thể không giao được nếu chưa kết bạn hoặc đang chặn OA.

> **Ảnh minh họa cần bổ sung thủ công:**
>
> Chụp Native LINE QR scanner và kết quả mở LIFF trên thiết bị thật.

> **Ảnh minh họa cần bổ sung thủ công:**
>
> Chụp LINE Rich Menu trong ứng dụng LINE.

### Kết quả mong đợi

- Danh tính khách đến từ LINE Login/LIFF đã xác minh; hệ thống không tin LINE User ID do browser tự gửi.
- Giá, Organization, Branch, Queue, payment status và quyền hạn được hệ thống xác định lại, không lấy theo giá trị tự khai của browser.
- Booking không trả trước đi thẳng tới Ticket.
- Booking cần trả trước chỉ được xác nhận sau Demo Payment thành công.
- Từ chối Add Friend không chặn Booking nhưng có thể làm LINE notification thất bại.

### Trường hợp nên kiểm thử

- Số điện thoại Nhật Bản sai/đúng định dạng.
- Chọn Product hết stock hoặc số lượng vượt stock.
- Queue đóng, tạm dừng, đầy hoặc Branch ngoài giờ.
- Từ chối vị trí và vẫn hoàn tất Booking.
- Không kết bạn/chặn OA rồi kiểm tra Booking và delivery thông báo.
- Tải lại payment return và xác nhận không tạo đơn/ticket trùng.
- Đặt lặp cùng Queue và đặt ở Queue khác.
- Đăng xuất rồi mở lại trang cần LINE session.

### Ảnh minh họa

Hình 29–38 được chụp bằng Mock LIFF/Demo Payment. Chúng không giả lập màn hình chat LINE; các màn hình native cần bổ sung thủ công như ghi chú ở trên.

## 13. Ticket và Queue status

### Trạng thái Ticket

| Trạng thái                 | Ý nghĩa người dùng                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Waiting / Đang chờ**     | Ticket hợp lệ và đang xếp hàng.                                                                                                 |
| **Called / Đang gọi**      | Đã đến lượt; khách cần tới quầy.                                                                                                |
| **Serving / Đang phục vụ** | Staff đã bắt đầu phục vụ.                                                                                                       |
| **Served / Hoàn thành**    | Hành trình đã hoàn thành. Trên UI thường hiển thị **Hoàn thành**.                                                               |
| **Cancelled / Đã hủy**     | Ticket/đơn bị hủy theo thao tác hoặc chính sách.                                                                                |
| **No-show / Vắng mặt**     | Khách không có mặt sau số lần cho phép.                                                                                         |
| **Deferred / Lùi lượt**    | Đây là hành động đưa Ticket đang gọi trở lại Waiting ở vị trí sau; không phải một trạng thái lưu cố định riêng trong danh sách. |

### Các thông tin cần đối chiếu

- **Ticket Code/Mã lượt:** tiền tố Queue cộng số thứ tự trong ngày, ví dụ `A006`.
- **Order Number/Mã đơn hàng:** mã nghiệp vụ của lần đặt/mua; khác Ticket Code.
- **People ahead/Số người phía trước:** số ticket hoạt động đang đứng trước ticket này, không phải `currentNumber`.
- **ETA:** ước tính dựa trên dữ liệu vận hành/thời lượng hiện có; không phải cam kết thời gian chính xác.
- **Payment summary:** tổng tiền, đã thanh toán và còn lại.
- **Active ticket:** dùng để theo dõi lượt đang chờ/gọi/phục vụ.
- **Booking history:** danh sách lịch sử, bao gồm cả hành trình đã hoàn thành, hủy hoặc no-show.

## 14. Staff sử dụng hệ thống

### Mục đích

Vận hành các Ticket đang hoạt động tại Branch: gọi khách, xử lý vắng mặt, bắt đầu/hoàn thành dịch vụ, thu tiền còn lại và in biên nhận.

### Điều kiện trước khi thực hiện

- Staff đã kích hoạt tài khoản và được gán vào Branch.
- Queue có ít nhất một Ticket active.
- Staff đăng nhập bằng email/mật khẩu doanh nghiệp, không dùng LINE Login.

### Các bước thực hiện

1. Mở `/login`, nhập email Staff. Không để mật khẩu xuất hiện trong ảnh/video báo lỗi.

![Đăng nhập Staff](./docs/images/guide/39-staff-login.png)

_Hình 39 — Cùng trang đăng nhập doanh nghiệp nhưng điều hướng theo vai trò Staff._

2. Sau đăng nhập, kiểm tra đúng Branch/Queue và danh sách Ticket.
3. Chọn một Ticket để xem tên Booking, số điện thoại, tên LINE đã xác minh, mã đơn, Product/Service, số lượng, tiền đã trả và còn lại.
4. Hệ thống tự gọi Ticket Waiting đầu tiên khi Queue không có Ticket Called/Serving phù hợp; workspace không có quy trình **Call Next** thủ công riêng.

![Workspace Staff desktop](./docs/images/guide/40-staff-workspace-desktop.png)

_Hình 40 — Danh sách Ticket, chi tiết khách/đơn và thao tác trên desktop._

5. Trên điện thoại, dùng thanh ticket ngang và phần chi tiết xếp dọc; xác nhận không bị che bởi thanh điều hướng đáy.

![Workspace Staff mobile](./docs/images/guide/41-staff-workspace-mobile.png)

_Hình 41 — Bố cục Staff responsive ở 390×844._

6. Chọn Ticket **Đang gọi**. Kiểm tra nút **Bắt đầu phục vụ**, **Lùi xuống 3 lượt** và **Hủy lượt**.

![Ticket đang gọi](./docs/images/guide/42-ticket-called.png)

_Hình 42 — Called state và các hành động Staff được phép._

7. Nếu khách có mặt, nhấn **Bắt đầu phục vụ**. Ticket chuyển sang **Đang phục vụ**.

![Ticket đang phục vụ](./docs/images/guide/43-ticket-serving.png)

_Hình 43 — Serving state với nút hoàn thành và thanh toán còn lại._

8. Nếu còn số dư, chọn hình thức thu tại quầy và đánh dấu thanh toán theo quyền được hiển thị. Không đánh dấu đã trả nếu chưa thực nhận.
9. Nhấn **Hoàn thành**. Hệ thống tiêu thụ stock reservation, cập nhật Served/Hoàn thành và tự chuyển tới khách tiếp theo khi phù hợp.
10. Kiểm tra hộp kết quả; nhấn **In hóa đơn** hoặc đóng để tiếp tục.

![Hoàn thành Ticket](./docs/images/guide/44-ticket-completed.png)

_Hình 44 — Xác nhận hoàn thành và lối mở hóa đơn._

11. Trong cửa sổ in, kiểm tra Branch, Queue, ticket/order, thời gian, mục, số lượng, tổng, đã thanh toán và còn lại.

![Biên nhận](./docs/images/guide/45-receipt.png)

_Hình 45 — Biên nhận có thể in từ cửa sổ riêng._

12. Nếu khách vắng mặt lần đầu, chọn **Lùi xuống 3 lượt** và xác nhận. Ticket trở lại Waiting ở vị trí sau.

![Lùi lượt khi khách vắng](./docs/images/guide/46-absence-defer.png)

_Hình 46 — Sau thao tác defer, Ticket trở về Waiting và Queue tiếp tục._

13. Chính sách lặp lại hiện tại:
    - Lần vắng thứ nhất: lùi 3 vị trí.
    - Lần vắng thứ hai: tiếp tục lùi 3 vị trí.
    - Lần vắng thứ ba: chuyển No-show và hủy theo chính sách cấu hình; stock được giải phóng/khôi phục, refund workflow được tạo nếu có số trả trước phù hợp.
14. Dùng **Hủy lượt** chỉ khi có lý do hợp lệ; xác nhận ảnh hưởng tới đơn, stock và thông báo trước khi tiếp tục.

### Kết quả mong đợi

- Chỉ Ticket hợp lệ ở Branch được giao mới xuất hiện.
- Chuyển trạng thái theo thứ tự hợp lệ; thao tác lặp/idempotent không nhân đôi hiệu ứng.
- Complete tiêu thụ stock; cancel/no-show giải phóng stock theo nghiệp vụ.
- LINE delivery lỗi không rollback trạng thái Queue đã hoàn tất.
- Hóa đơn phản ánh đúng dữ liệu server, không dùng giá/payment status do browser tự gửi.

### Trường hợp nên kiểm thử

- Called → Serving → Served.
- Called → defer lần 1/lần 2 → quay lại Waiting.
- Lần vắng thứ 3 → No-show/cancel theo policy.
- Hủy Ticket có Product hữu hạn và kiểm tra stock.
- Thu phần còn lại rồi in biên nhận.
- Mở workspace trên desktop và mobile.
- Staff thử mở menu Manager/Admin; hệ thống phải từ chối hoặc chuyển hướng.

### Ảnh minh họa

Hình 39–46 được tạo từ Ticket fixture và Booking Mock LIFF trong cùng lần chạy kiểm thử.

## 15. LINE Notification

### Mục đích

Thông báo cho khách tại các mốc quan trọng mà không yêu cầu khách giữ LIFF luôn mở.

### Điều kiện trước khi thực hiện

- Customer đã đăng nhập qua LINE và tài khoản LINE đã được liên kết/xác minh.
- LINE Official Account có thể gửi tin cho khách: khách đã kết bạn và không chặn OA.
- Tùy chọn thông báo tương ứng đang bật.
- LINE Messaging API được cấu hình độc lập với LINE Login.

### Các bước thực hiện

1. Tạo Booking và kiểm tra sự kiện **Booking created**.
2. Tạo đủ ticket phía trước để khách chuyển đúng mốc **còn chính xác 5 người phía trước**.
3. Cho Staff gọi Ticket để kiểm tra **Called**.
4. Hoàn thành để kiểm tra **Completed**.
5. Kiểm tra riêng các tình huống **Deferred**, **Cancelled** và **No-show**.
6. Nhấn deep link trong tin để mở đúng Ticket.
7. Nếu Flex Message không giao/không render, kiểm tra text fallback.
8. Tắt một loại thông báo trong **Cài đặt** rồi lặp lại sự kiện tương ứng.

### Kết quả mong đợi

- Hệ thống xếp yêu cầu gửi cho: created, exactly-five-ahead, called, completed, deferred, cancelled và no-show.
- Ưu tiên Flex Message; có text fallback.
- Tin có deep link tới Ticket khi phù hợp.
- Delivery failure được ghi nhận/thử lại theo cơ chế vận hành nhưng không đảo ngược trạng thái Queue.
- LINE Login thành công không đồng nghĩa Messaging API chắc chắn gửi được; đây là hai capability tách biệt.

### Trường hợp nên kiểm thử

- Đã kết bạn OA và bật tất cả notification.
- Từ chối Add Friend hoặc chặn OA nhưng vẫn Booking.
- Tắt riêng từng preference.
- Mốc từ 6 xuống 5 người phía trước chỉ phát đúng sự kiện cần thiết.
- Mở deep link khi còn/không còn customer session.
- Flex không khả dụng và dùng text fallback.

### Ảnh minh họa

Hiện không có màn hình người dùng “Notification operations” trong Web để chụp an toàn thành `47-notification-operation.png`. Không tạo ảnh giả từ API hoặc giả lập chat LINE.

> **Ảnh minh họa cần bổ sung thủ công:**
>
> Chụp LINE Flex Message **Booking created** trên thiết bị thật.

> **Ảnh minh họa cần bổ sung thủ công:**
>
> Chụp LINE Flex Message **Called/Completed/Deferred/Cancelled/No-show** trên thiết bị thật.

> **Ảnh minh họa cần bổ sung thủ công:**
>
> Chụp text fallback và ticket deep link trên thiết bị thật.

> **Ảnh minh họa cần bổ sung thủ công:**
>
> Chụp device notification banner; che nội dung riêng tư không cần thiết.

## 16. Payment

### Mục đích

Phân biệt Booking không trả trước, chỉ trả cho mục bắt buộc, trả toàn đơn và phần còn lại thu tại quầy.

### Điều kiện trước khi thực hiện

- Branch đã có cấu hình thanh toán.
- Catalog có ít nhất một mục `requires prepayment` và một mục không yêu cầu.
- Local dùng **Demo Payment**; không nhập thông tin thẻ thật.

### Các bước thực hiện

1. Chọn chỉ các mục không yêu cầu trả trước: nút **Đặt chỗ** tạo Booking và số còn lại được thu tại quầy nếu có giá.
2. Chọn ít nhất một mục bắt buộc trả trước: UI chuyển sang **Thanh toán và đặt chỗ**.
3. Với scope **required-items-only**, chỉ tổng của các mục bắt buộc được trả online; các mục khác còn dư tại quầy.
4. Với scope **full-order**, toàn bộ đơn được trả online.
5. Trên Demo Payment, chọn phương thức mô phỏng và hoàn tất. Payment reference chỉ được dùng một lần; tải lại callback/return không được tạo thanh toán trùng.
6. Staff đối chiếu **Đã thanh toán** và **Còn lại** trước khi hoàn thành.
7. Khi hủy/no-show, kiểm tra trạng thái refund workflow và số tiền; không khẳng định tiền đã về tài khoản thật nếu provider chưa xác nhận.

### Kết quả mong đợi

- Tổng phải trả được server tính từ catalog hiện tại; browser không quyết định giá.
- Payment success chỉ được chấp nhận qua luồng provider/demo đã xác minh.
- UI cài đặt Branch có thể hiển thị `payOS` như collection provider. Phạm vi local guide chỉ xác minh Demo Payment.
- payOS production settlement/reconciliation và provider refund end-to-end chưa được coi là hoàn tất chỉ dựa trên UI hiện tại.
- Hủy đơn có thể tạo trạng thái/refund workflow nội bộ; không tuyên bố hoàn tiền provider thực tế nếu chưa có bằng chứng provider.

### Trường hợp nên kiểm thử

- Không prepayment.
- Chỉ một mục bắt buộc trong đơn hỗn hợp.
- Full-order payment.
- Payment cancel/fail rồi quay lại catalog.
- Return/callback lặp và payment reference đã dùng.
- Hủy sau khi đã trả trước và kiểm tra refund status.
- Staff thu phần còn lại, in biên nhận và đối chiếu số tiền.

### Ảnh minh họa

Xem Hình 34 cho Demo Payment, Hình 36 cho payment summary trên Ticket và Hình 45 cho biên nhận.

## 17. Stock

### Mục đích

Xác minh Product definition thuộc Organization trong khi số tồn thuộc từng Branch.

### Điều kiện trước khi thực hiện

- Owner đã tạo Product/Service.
- Branch Manager đã gán mục vào Queue.
- Có một Product hữu hạn, một Product không giới hạn và một Service.

### Các bước thực hiện

1. Owner mở danh mục để xác nhận tên, giá, loại và mã Product/Service dùng chung.
2. Branch Manager mở **Sản phẩm** và đặt stock tại Branch:
   - **Không giới hạn:** không giảm theo số lượng hữu hạn.
   - **Hữu hạn:** nhập số lượng cụ thể.
   - **Hết hàng:** stock khả dụng bằng 0; khách không thể đặt thêm.
3. Customer tạo Booking có Product hữu hạn. Hệ thống reservation stock ngay khi Booking hợp lệ.
4. Staff hoàn thành: reservation được consume.
5. Hủy hoặc để Booking hết hạn theo flow tương ứng: reservation được release/restore.
6. Dùng hai customer session đồng thời chọn món cuối cùng; chỉ một giao dịch được giữ món, giao dịch còn lại nhận lỗi hết hàng/xung đột rõ ràng.

### Kết quả mong đợi

- Sửa Product ở Organization phản ánh định nghĩa chung; stock Branch A không đổi stock Branch B.
- Booking giữ stock nguyên tử, tránh bán quá số lượng.
- Completion tiêu thụ; cancellation/expiry giải phóng theo trạng thái hiện tại.
- Service không bị chặn vì stock hữu hạn.

### Trường hợp nên kiểm thử

- Stock 0, 1, 2 và không giới hạn.
- Hai khách tranh món cuối cùng.
- Booking rồi hủy.
- Booking rồi hoàn thành.
- Payment thất bại trước khi Booking được xác nhận.
- Gỡ Product khỏi Queue nhưng vẫn giữ Product trong danh mục Organization.

### Ảnh minh họa

Xem Hình 13 cho Product definition cấp Organization, Hình 24 cho gán vào Queue và Hình 25 cho stock cấp Branch.

## 18. Session và đăng xuất

- Phiên business (Admin/Owner/Branch Manager/Staff) hết hạn khi không hoạt động khoảng **15 phút** và có giới hạn tuyệt đối **12 giờ** dù vẫn thao tác.
- Phiên customer LINE có thời hạn dài hơn, hiện khoảng **30 ngày**, nhưng vẫn phụ thuộc trạng thái LINE/LIFF và có thể cần xác thực lại.
- Khi còn refresh hợp lệ, ứng dụng có thể làm mới phiên trong nền; người dùng thường không thấy thao tác kỹ thuật này.
- Khi phiên hết hẳn, UI chuyển về đăng nhập hoặc yêu cầu mở lại LINE. Hãy lưu thông tin đang nhập trước khi thử kịch bản hết phiên.
- **Đăng xuất** xóa phiên hiện tại trên thiết bị/browser đó.
- Đổi mật khẩu hoặc reset mật khẩu làm các phiên business cũ mất hiệu lực; đăng nhập lại bằng mật khẩu mới.
- Nếu trang tải mãi sau khi session hết hạn, tải lại một lần. Nếu vẫn còn, đăng xuất/đóng LIFF rồi mở lại đúng URL; không gửi cookie/token trong báo lỗi.

## 19. Ngôn ngữ

Hệ thống hỗ trợ **日本語 (Japanese)**, **Tiếng Việt** và **English** qua bộ chọn **Ngôn ngữ** ở đầu trang. Japanese là ngôn ngữ fallback khi bản dịch dữ liệu hoặc chuỗi giao diện chưa có.

Khi kiểm thử từng ngôn ngữ:

1. Đổi ngôn ngữ và kiểm tra menu, tiêu đề, nút, validation, trạng thái và nội dung payment.
2. Kiểm tra layout không tràn khi chuỗi English/Vietnamese dài hơn Japanese.
3. Phân biệt bản dịch UI với dữ liệu do doanh nghiệp nhập. Tên Branch/Product tiếng Nhật có thể giữ nguyên nếu không có bản dịch dữ liệu tương ứng.
4. Tại trang QR, dữ liệu Branch có thể được nạp theo ngôn ngữ mặc định trước khi người dùng đổi ngôn ngữ. Nếu cần đối chiếu toàn bộ nội dung localized, đổi ngôn ngữ trước rồi mở lại QR.
5. Đăng xuất/đăng nhập lại để xác nhận lựa chọn được lưu theo hồ sơ khi có quyền lưu.
6. Nếu thiếu bản dịch, hệ thống phải fallback Japanese có ý nghĩa, không hiển thị khóa kỹ thuật.

## 20. Các kịch bản kiểm thử đề xuất

### A. Complete business onboarding

- [ ] Gửi hồ sơ hợp lệ bằng email `.invalid` hoặc email test được cấp.
- [ ] Xác nhận biểu mẫu không hỏi mật khẩu Manager.
- [ ] Admin tìm đúng hồ sơ, mở chi tiết và duyệt.
- [ ] Xác nhận chỉ Organization và Owner được mời được tạo; Branch/Queue bằng 0.
- [ ] Owner dùng link một lần để đặt mật khẩu và đăng nhập.
- [ ] Dùng lại link và xác nhận bị từ chối.

### B. Owner catalog and Branch setup

- [ ] Tạo một Service không trả trước.
- [ ] Tạo một Product bắt buộc trả trước, có ảnh và giá.
- [ ] Xác nhận mã DV/SP tự sinh.
- [ ] Tạo Branch với ít nhất một lời mời Branch Manager.
- [ ] Kiểm tra giới hạn Starter/Standard/Scale.
- [ ] Xem audit và analytics.
- [ ] Không xác nhận xóa Branch nếu còn dữ liệu cần giữ.

### C. Branch Manager Queue and Staff setup

- [ ] Cập nhật địa chỉ và lịch tuần.
- [ ] Thêm một ngày nghỉ ngoại lệ.
- [ ] Tạo Queue Open với tiền tố riêng và capacity nhỏ.
- [ ] Gán ít nhất hai mục từ catalog Organization.
- [ ] Đặt stock hữu hạn/không giới hạn/hết hàng.
- [ ] Mời Staff và kiểm tra đúng Branch.
- [ ] Sao chép/in QR và mở đúng Branch.

### D. Customer LINE booking without prepayment

- [ ] Quét QR, LINE Login và chọn Queue.
- [ ] Chọn mục không bắt buộc trả trước.
- [ ] Nhập tên và số điện thoại Nhật Bản hợp lệ.
- [ ] Từ chối vị trí và vẫn Booking.
- [ ] Xác nhận chuyển thẳng tới Ticket.
- [ ] Đối chiếu Ticket Code, Order Number, people ahead, ETA và số còn lại.

### E. Customer booking with demo prepayment

- [ ] Chọn mục bắt buộc trả trước.
- [ ] Kiểm tra đúng số phải trả theo scope.
- [ ] Hoàn tất Demo Payment, không nhập thẻ thật.
- [ ] Xác nhận quay về đúng Ticket.
- [ ] Tải lại return và xác nhận không có đơn/ticket/payment trùng.
- [ ] Đối chiếu tổng, đã thanh toán và còn lại.

### F. Staff service completion

- [ ] Đăng nhập Staff và chọn đúng Queue.
- [ ] Kiểm tra auto-called ticket.
- [ ] Bắt đầu phục vụ.
- [ ] Thu/đánh dấu số dư nếu có.
- [ ] Hoàn thành và mở biên nhận.
- [ ] Đối chiếu Ticket/Order/items/tổng tiền.
- [ ] Kiểm tra khách tiếp theo được xử lý.

### G. Cancellation and stock restoration

- [ ] Ghi stock trước Booking.
- [ ] Booking Product hữu hạn.
- [ ] Xác nhận stock khả dụng được giữ.
- [ ] Hủy Ticket bằng Staff.
- [ ] Xác nhận reservation được release/stock được khôi phục.
- [ ] Nếu đã trả trước, kiểm tra refund workflow; không mặc định provider đã hoàn tiền.

### H. Repeat booking in the same Queue

- [ ] Tạo Ticket active ở Queue A.
- [ ] Quét lại cùng Branch và chọn Queue A.
- [ ] Đặt thêm Product/Service.
- [ ] Xác nhận không tạo ticket cạnh tranh thứ hai trong cùng Queue.
- [ ] Đối chiếu ticket/hành trình hiện tại và các order liên quan.

### I. Cross-Queue booking

- [ ] Giữ Ticket active ở Queue A.
- [ ] Mở lại Branch QR và chọn Queue B.
- [ ] Tạo Booking hợp lệ.
- [ ] Xác nhận có Ticket riêng với prefix/people ahead/ETA của Queue B.
- [ ] Staff mỗi Queue chỉ thấy dữ liệu vận hành phù hợp.

### J. Absence/defer/no-show

- [ ] Gọi Ticket rồi defer lần 1; xác nhận lùi 3 vị trí.
- [ ] Gọi lại và defer lần 2; xác nhận tiếp tục lùi.
- [ ] Gọi lại lần 3; xác nhận No-show/cancel theo policy.
- [ ] Kiểm tra stock release và refund workflow.
- [ ] Kiểm tra notification Deferred và No-show trên thiết bị thật.

### K. Authorization boundaries

- [ ] Owner thử mở URL Queue/Stock/Staff/QR của Branch Manager.
- [ ] Branch Manager thử mở catalog Organization, Branch khác và Admin.
- [ ] Staff thử mở Manager/Admin.
- [ ] Customer thử mở cổng business.
- [ ] Đổi Organization/Branch/LINE User ID trong URL hoặc dữ liệu browser và xác nhận không vượt quyền.
- [ ] Xác nhận giá/payment status không thay đổi theo dữ liệu browser tự sửa.

### L. Mobile and responsive behavior

- [ ] LIFF ở 390×844 không có cuộn ngang.
- [ ] Nút chính và bottom navigation không chồng nhau.
- [ ] Product detail, payment và ticket đọc được trên mobile.
- [ ] Staff mobile vẫn chọn ticket và thao tác được.
- [ ] Desktop 1440×1000 không bị cắt modal/bảng quan trọng.
- [ ] Xoay màn hình hoặc đổi kích thước và kiểm tra trạng thái không mất.

### M. Localization

- [ ] Chạy một luồng bằng Japanese.
- [ ] Chạy lại bằng Vietnamese.
- [ ] Chạy lại bằng English.
- [ ] Kiểm tra Japanese fallback cho dữ liệu chưa dịch.
- [ ] Không có khóa i18n thô hoặc text tràn.
- [ ] Định dạng JPY, ngày/giờ và số phù hợp.

### N. Session expiration and logout

- [ ] Để phiên business idle đến khi hết hạn và kiểm tra chuyển đăng nhập.
- [ ] Xác nhận transparent refresh không làm mất thao tác khi còn hợp lệ.
- [ ] Đăng xuất business rồi dùng Back và xác nhận trang bảo vệ không mở.
- [ ] Đăng xuất customer trong LIFF rồi mở Ticket.
- [ ] Đổi mật khẩu và xác nhận phiên cũ bị thu hồi.
- [ ] Không đính kèm cookie/token vào báo lỗi.

## 21. Checklist trải nghiệm nhanh trong 15–20 phút

1. [ ] Mở Landing Page và đọc cách hệ thống dùng QR/LINE.
2. [ ] Mở Business Registration, đi qua hai bước đầu nhưng không cần gửi hồ sơ mới nếu thời gian ngắn.
3. [ ] Đăng nhập Platform Admin.
4. [ ] Mở một Organization Application và đối chiếu gói/thanh toán demo.
5. [ ] Đăng xuất, đăng nhập Organization Owner.
6. [ ] Xem Product Catalog và Branches.
7. [ ] Đăng xuất, đăng nhập Branch Manager.
8. [ ] Xem Queue, Staff, Stock và QR.
9. [ ] Dùng LINE thật quét QR hoặc mở bằng Mock LIFF.
10. [ ] Chọn Queue và tạo Customer Booking không trả trước hoặc Demo Payment.
11. [ ] Xem Ticket Code, Order Number, people ahead, ETA và payment summary.
12. [ ] Đăng xuất business nếu cần rồi đăng nhập Staff ở cửa sổ khác.
13. [ ] Mở đúng Ticket, **Bắt đầu phục vụ** và **Hoàn thành**.
14. [ ] Quay lại Customer Ticket và kiểm tra trạng thái; trên thiết bị thật kiểm tra LINE Notification.

## 22. Các giới hạn hiện tại

- **Thanh toán thật:** Demo Payment đã được xác minh cho local. payOS/provider production settlement, reconciliation và refund end-to-end vẫn cần nghiệm thu với provider; không xem trạng thái nội bộ là bằng chứng tiền thật đã hoàn.
- **LINE trên thiết bị thật:** LINE Login consent, Add Friend/Unblock, Rich Menu, Flex Message, native QR scanner và notification banner cần acceptance test trên điện thoại thật.
- **Rich Menu production:** cần xác minh cấu hình và deep link trong OA production.
- **Google Routes/vị trí:** cần credentials production và chấp thuận privacy phù hợp trước nghiệm thu khoảng cách/route thực.
- **ETA/forecast:** là heuristic đo từ dữ liệu vận hành, không phải mô hình machine learning đã huấn luyện; kết quả có thể thay đổi khi dữ liệu ít hoặc thời lượng phục vụ biến động.
- **Media/object storage:** local dùng media mock; object storage, lifecycle và quyền truy cập production cần hardening/kiểm tra vận hành riêng.
- **Hạ tầng production:** quan sát, backup/restore và một số quy trình vận hành cần được nghiệm thu trong môi trường production-like.
- **Tải lớn:** production-scale load/soak testing vẫn đang chờ; chức năng đã triển khai không đồng nghĩa đã chứng minh tải cực đại.
- **Notification operations UI:** hiện chưa có dashboard người dùng để xem delivery status; bằng chứng chat LINE phải lấy trên thiết bị thật hoặc qua vận hành được cấp quyền.

## 23. Xử lý sự cố đơn giản

| Hiện tượng                   | Cách xử lý ở mức người dùng                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Không đăng nhập được         | Kiểm tra đúng cổng business, email, mật khẩu và trạng thái kích hoạt. Customer phải vào qua LINE/LIFF, không dùng email.                 |
| Session hết hạn              | Lưu thông tin nếu còn có thể, tải lại, đăng nhập lại hoặc mở lại LIFF từ LINE.                                                           |
| QR mở sai đường dẫn          | Đối chiếu tên Branch trong trang mở ra; yêu cầu Branch Manager in/sao chép lại QR ổn định từ menu **Mã QR**.                             |
| Không nhận LINE notification | Kiểm tra preference, đã kết bạn/chưa chặn OA, đúng tài khoản LINE và thử mở Ticket trực tiếp. Booking vẫn có thể thành công dù push lỗi. |
| Queue không nhận khách       | Kiểm tra Queue có Open không, capacity, Branch có trong giờ làm việc không và catalog còn mục khả dụng không.                            |
| Branch ngoài giờ             | Xem lịch tuần/ngày ngoại lệ; quay lại trong giờ mở hoặc nhờ Branch Manager sửa lịch nếu cấu hình sai.                                    |
| Product hết hàng             | Chọn mục khác hoặc liên hệ Branch; Branch Manager kiểm tra stock đúng Branch.                                                            |
| Payment reference đã dùng    | Không gửi lại cùng tham chiếu; quay về Ticket/Lịch sử để kiểm tra giao dịch đã được ghi nhận trước khi thử mới.                          |
| Trang cứ loading             | Kiểm tra mạng, tải lại một lần, đóng overlay, đăng nhập lại. Ghi lại URL/thời gian/Request ID nếu vẫn xảy ra.                            |
| Lỗi bố cục mobile            | Đặt zoom về 100%, thử portrait, chụp toàn màn hình kèm model thiết bị/browser và kích thước viewport.                                    |

Không tự sửa URL chứa token, cookie, giá hoặc payment status để “khắc phục”; hãy gửi báo lỗi theo mẫu bên dưới.

## 24. Mẫu báo lỗi

Sao chép mẫu sau cho mỗi lỗi độc lập:

```text
Tiêu đề:
URL:
Thời gian và múi giờ:
Vai trò:
Thiết bị/model:
Hệ điều hành:
Browser/LINE version:
Ngôn ngữ:
Branch:
Queue:
Điều kiện trước khi thực hiện:

Các bước tái hiện:
1.
2.
3.

Kết quả thực tế:
Kết quả mong đợi:
Tần suất: Luôn luôn / Thỉnh thoảng / Một lần
Mức độ: Blocker / Cao / Trung bình / Thấp
Ảnh hoặc video đính kèm:
Request ID nếu UI hiển thị:
Ghi chú bổ sung:
```

Không đưa mật khẩu, token kích hoạt/reset, cookie, secret, thông tin thẻ thật, LINE User ID thô hoặc dữ liệu cá nhân khách hàng thật vào tiêu đề, nội dung, ảnh hay video. Dùng dữ liệu demo và che thông tin không cần thiết.

## 25. Liên hệ hỗ trợ

- Email: `support@smartqueue.io.vn`
- Người phụ trách dự án: `[BỔ SUNG TÊN PROJECT OWNER]`
- Kênh liên hệ ưu tiên: `[BỔ SUNG SLACK/TEAMS/EMAIL/ĐIỆN THOẠI]`
- Khung giờ hỗ trợ: `[BỔ SUNG GIỜ VÀ MÚI GIỜ]`

Khi liên hệ, gửi kèm phiên bản, môi trường, vai trò, Branch/Queue, thời gian xảy ra và mẫu báo lỗi ở Mục 24. Không gửi secrets hoặc dữ liệu khách hàng thật.
