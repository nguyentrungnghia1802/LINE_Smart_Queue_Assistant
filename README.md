# LINE Smart Queue Assistant

<details>
<summary><strong>🇯🇵 日本語</strong></summary>

🌐 Webサイト：[https://smartqueue.io.vn/](https://smartqueue.io.vn/)

## LINEで始める、見える・離れられる受付体験

LINE Smart Queue Assistantは、日本の店舗、サロン、クリニック、サービス窓口向けの受付・予約・注文・決済基盤・顧客通知プラットフォームです。お客様は店舗に並び続ける代わりに、固定QRからLINEで受付し、自分の順番と待ち時間目安を確認できます。事業者は役割別のWeb画面で、組織、支店、キュー、商品、在庫、スタッフ、受付状況を管理します。

### 背景と課題

対面サービスでは、待ち時間が見えないためにお客様が受付付近を離れられず、スタッフも口頭での呼出し、予約、商品、在庫、支払、領収書、通知を別々に扱うことがあります。これにより、お客様の不安、受付の混雑、呼出し漏れ、運用データの分断が生じます。

> **図版プレースホルダー — 背景**
>
> TODO: 受付周辺で待ち続ける従来体験と、LINEで順番を確認して自由に行動できる体験を対比した図を追加します。

<!-- TODO: Add a production-approved Japanese background illustration without using real customer data. -->

> **図版プレースホルダー — 課題**
>
> TODO: 「待ち時間が見えない」「受付業務が分散」「通知が届かない」を示す課題図を追加します。

<!-- TODO: Add a production-approved Japanese problem illustration without broken image links. -->

### 解決方法と提供価値

1つのBranch QRからLINE/LIFFを開き、確認済みLINEアカウントでQueueと商品・サービスを選びます。発行されたTicketには受付番号、注文番号、前方人数、ETA、明細、支払状況が表示されます。Staffは自動呼出しされたTicketを対応開始・完了し、必要に応じて不在後退、取消、残金回収、領収書発行を行います。

主な価値は次のとおりです。

- お客様が受付付近を離れても順番を確認できます。
- 店舗ごとの複数Queueを1つの固定QRから選べます。
- Organization共通の商品定義とBranch別在庫を明確に分離します。
- 予約、Ticket、決済状態、在庫、Staff操作を一貫して管理します。
- LINE通知でcreated、5人待ち、called、completed、不在・取消のイベントを伝えます。
- 日本語、ベトナム語、英語でレビューできます。

> **図版プレースホルダー — コンセプト**
>
> TODO: 「Branch QR → LINE Login → Queue選択 → Booking → Ticket → Staff対応 → LINE通知」の1枚図を追加します。

<!-- TODO: Add a production-approved Japanese concept illustration. Keep the placeholder visible until the asset exists. -->

### 利用者と主な機能

| 利用者             | 主な機能                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| Business Applicant | 法人情報、規模、プラン、Demo Paymentを含む利用申請                       |
| Platform Admin     | 申請の確認・編集・承認・却下、Organization作成                           |
| Organization Owner | Organization設定、商品・サービス、Branch、Branch Manager、操作ログ、分析 |
| Branch Manager     | 割当Branchの営業時間、Queue、商品割当、在庫、Staff、固定QR               |
| Staff              | Ticket自動呼出し、対応開始・完了、取消、不在処理、残金、領収書           |
| Customer           | LINE/LIFF認証、Queue・商品選択、Booking、決済、Ticket・履歴・設定        |

### 全体フロー

```text
法人申込み
→ Platform Admin承認
→ Owner有効化
→ Organizationカタログ
→ Branch作成・Branch Manager招待
→ Queue・商品割当・Branch在庫・Staff・QR
→ LINE Login・Queue選択・Booking・必要時の決済
→ Ticket・Staff対応・完了・領収書・LINE通知
```

承認時に作成されるのはOrganizationと招待Ownerだけです。BranchとQueueは自動作成されません。CustomerはLINE/LIFF専用で、Admin、Owner、Branch Manager、Staffは業務用メール／パスワードを使用します。

### 画面イメージ

![公開トップページ](./docs/images/guide/01-landing-page.png)

_公開サイトから法人導入と製品体験へ進みます。_

![Organization商品カタログ](./docs/images/guide/13-owner-product-catalog.png)

_OwnerがOrganization共通の商品・サービスを管理します。_

![Branch固定QR](./docs/images/guide/28-branch-qr.png)

_1つのBranchに1つの固定QRがあり、読み取り後にQueueを選択します。_

![Customer Ticket](./docs/images/guide/36-customer-ticket-mobile.png)

_Customerは受付番号、前方人数、ETA、注文と支払をモバイルで確認します。_

![Staffワークスペース](./docs/images/guide/40-staff-workspace-desktop.png)

_Staffは顧客、注文、Ticket状態、残金、対応操作を1画面で扱います。_

### 現在の状態

| 領域                                    | 状態                                                    |
| --------------------------------------- | ------------------------------------------------------- |
| 法人申込み・Admin審査・Owner有効化      | 実装済み、ローカルfixtureで検証済み                     |
| Owner／Branch Manager／Staff画面        | 実装済み、役割境界と主要フローを検証済み                |
| QR／Mock LIFF／Customer Booking／Ticket | 実装済み、browserテストで検証済み                       |
| Demo Payment                            | ローカルで検証済み                                      |
| LINE Login／Messaging／Rich Menu        | 実装あり。一部はLINE実機・production OAで受入確認が必要 |
| 3言語UI                                 | 日本語既定・fallback、ベトナム語、英語を実装済み        |

### 現在の制限

- 実決済のsettlement、reconciliation、provider refundはproviderとのend-to-end受入が必要です。
- LINE Login同意、友だち追加、Rich Menu、Flex Message、native QR scanner、通知バナーは実機確認が必要です。
- Google Routesの実利用にはproduction credentialとprivacy同意が必要です。
- ETAは運用データによるheuristicで、学習済みMLモデルではありません。
- production object storage、運用監視、backup／restore、production-scale負荷試験は追加hardening・受入が必要です。
- 利用者向け通知配信ステータスdashboardは現在ありません。

### 短い技術情報

システムはReact/ViteのWeb UI、Express/TypeScript API、PostgreSQLで構成され、Docker Composeで隔離されたローカル検証ができます。Customer認証のLINE Login/LIFFと通知のLINE Messaging APIは別機能です。価格、Organization、Branch、LINE User ID、payment status、権限範囲はbrowser入力を信用せず、server側で確認します。

### ガイドと連絡先

- [日本語ご利用ガイド](./docs/guide/guide.md)
- サポート：[trungnghia180205@gmail.com](mailto:trungnghia180205@gmail.com)
- プロジェクト担当者：グエン・チュン・ギア
- 連絡先：[メール](mailto:trungnghia180205@gmail.com)／[LinkedIn](https://www.linkedin.com/in/nguyen-trung-nghia-366842157/)

</details>

<details>
<summary><strong>🇬🇧 English</strong></summary>

🌐 Website: [https://smartqueue.io.vn/](https://smartqueue.io.vn/)

## A visible queue experience that starts in LINE

LINE Smart Queue Assistant is a queue, reservation, ordering, payment-foundation, and customer-notification platform for Japanese shops, salons, clinics, and service counters. Customers use one stable Branch QR and LINE instead of remaining beside the counter. Businesses manage organizations, branches, queues, catalog items, stock, Staff, and active Tickets through role-specific web workspaces.

### Background and problem

In many in-person services, customers cannot see when their turn will arrive and are reluctant to leave the waiting area. Staff may separately manage verbal calls, reservations, products, stock, payments, receipts, and customer messages. This produces anxiety, crowding, missed calls, and fragmented operational data.

> **Illustration placeholder — Background**
>
> TODO: Add a comparison between the traditional counter wait and a LINE-based experience in which customers can move freely while monitoring their turn.

<!-- TODO: Add a production-approved English background illustration without real customer data. -->

> **Illustration placeholder — Problem**
>
> TODO: Add a visual for invisible wait time, fragmented counter work, and missed notifications.

<!-- TODO: Add a production-approved English problem illustration without broken image links. -->

### Solution and value

A stable Branch QR opens LINE/LIFF. A verified LINE customer selects a Queue and Products/Services, then receives a Ticket with code, order number, people ahead, ETA, items, and payment status. Staff processes the auto-called Ticket, starts and completes service, and can defer absence, cancel, collect a balance, and print a receipt.

The product provides:

- freedom for customers to leave the counter while retaining queue visibility;
- multiple Queues behind one stable Branch QR;
- clear separation of Organization-owned Product definitions and Branch-owned stock;
- consistent Booking, Ticket, payment, stock, and Staff operations;
- LINE lifecycle notifications for created, exactly-five-ahead, called, completed, absence, and cancellation events;
- Japanese, Vietnamese, and English review experiences.

> **Illustration placeholder — Concept**
>
> TODO: Add a single flow visual: Branch QR → LINE Login → Queue selection → Booking → Ticket → Staff service → LINE notification.

<!-- TODO: Add a production-approved English concept illustration and keep this visible until the asset exists. -->

### Roles and key features

| User               | Key capabilities                                                                      |
| ------------------ | ------------------------------------------------------------------------------------- |
| Business Applicant | Business details, scale, plan, Demo Payment, and application submission               |
| Platform Admin     | Review/edit/approve/reject applications and create Organizations                      |
| Organization Owner | Organization settings, Products/Services, Branches, Branch Managers, audit, analytics |
| Branch Manager     | Assigned Branch hours, Queues, item assignments, stock, Staff, and stable QR          |
| Staff              | Auto-called Tickets, start/complete, cancellation, absence handling, balance, receipt |
| Customer           | LINE/LIFF authentication, Queue/items, Booking, payment, Ticket, history, preferences |

### Complete flow

```text
Business application
→ Platform Admin approval
→ Owner activation
→ Organization catalog
→ Branch creation and Branch Manager invitation
→ Queue, item assignment, Branch stock, Staff, and QR
→ LINE Login, Queue selection, Booking, and payment when required
→ Ticket, Staff service, completion, receipt, and LINE notification
```

Approval creates only the Organization and invited Owner; it creates no Branch or Queue. Customers use LINE/LIFF only. Admin, Owner, Branch Manager, and Staff use business email/password login.

### Product screenshots

![Public landing page](./docs/images/guide/01-landing-page.png)

_The public site introduces the product and business application._

![Organization Product catalog](./docs/images/guide/13-owner-product-catalog.png)

_The Owner manages shared Organization-level Product and Service definitions._

![Stable Branch QR](./docs/images/guide/28-branch-qr.png)

_Each Branch has one stable QR; the Customer selects a Queue after scanning._

![Customer Ticket](./docs/images/guide/36-customer-ticket-mobile.png)

_The mobile Ticket shows code, people ahead, ETA, order, and payment._

![Staff workspace](./docs/images/guide/40-staff-workspace-desktop.png)

_Staff sees customer, order, Ticket state, balance, and service actions together._

### Current status

| Area                                                 | Status                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Business application, Admin review, Owner activation | Implemented and verified with local fixtures                            |
| Owner, Branch Manager, and Staff workspaces          | Implemented; role boundaries and primary flows verified                 |
| QR, Mock LIFF, Customer Booking, and Ticket          | Implemented and browser-tested                                          |
| Demo Payment                                         | Verified locally                                                        |
| LINE Login, Messaging, and Rich Menu                 | Implemented; selected acceptance remains on physical LINE/production OA |
| Three-language UI                                    | Japanese default/fallback plus Vietnamese and English implemented       |

### Current limitations

- Real settlement, reconciliation, and provider refund require end-to-end acceptance with the payment provider.
- LINE Login consent, Add Friend, Rich Menu, Flex Message, native QR scanner, and notification banners require physical-device testing.
- Real Google Routes use requires production credentials and privacy consent.
- ETA is an operational heuristic, not a trained ML model.
- Production object storage, observability, backup/restore, and production-scale load testing require further hardening and acceptance.
- There is currently no end-user notification-delivery status dashboard.

### Short technical note

The system uses a React/Vite web UI, an Express/TypeScript API, and PostgreSQL, and supports isolated local verification through Docker Compose. LINE Login/LIFF customer authentication and LINE Messaging API notification delivery are separate. The server revalidates price, Organization, Branch, LINE User ID, payment status, and authorization rather than trusting browser input.

### Guide and contact

- [English user guide](./docs/guide/guide.en.md)
- Support: [trungnghia180205@gmail.com](mailto:trungnghia180205@gmail.com)
- Project lead: Nguyen Trung Nghia
- Contact: [Email](mailto:trungnghia180205@gmail.com) / [LinkedIn](https://www.linkedin.com/in/nguyen-trung-nghia-366842157/)

</details>

<details>
<summary><strong>🇻🇳 Tiếng Việt</strong></summary>

🌐 Website: [https://smartqueue.io.vn/](https://smartqueue.io.vn/)

## Trải nghiệm xếp hàng minh bạch, bắt đầu từ LINE

LINE Smart Queue Assistant là nền tảng quản lý hàng đợi, đặt chỗ, đơn hàng, nền tảng thanh toán và thông báo khách hàng dành cho cửa hàng, salon, phòng khám và quầy dịch vụ tại Nhật Bản. Khách dùng một QR ổn định của Branch và LINE thay vì phải đứng cạnh quầy. Doanh nghiệp quản lý Organization, Branch, Queue, danh mục, stock, Staff và Ticket bằng các workspace theo vai trò.

### Bối cảnh và vấn đề

Trong nhiều dịch vụ trực tiếp, khách không biết khi nào đến lượt nên khó rời khu vực chờ. Nhân viên có thể phải tách rời việc gọi khách, đặt chỗ, sản phẩm, stock, thanh toán, biên nhận và nhắn tin. Hệ quả là khách lo lắng, khu vực tiếp nhận đông, dễ bỏ lỡ lượt và dữ liệu vận hành bị phân tán.

> **Placeholder minh họa — Bối cảnh**
>
> TODO: Bổ sung hình so sánh việc đứng chờ truyền thống với trải nghiệm theo dõi lượt qua LINE và tự do di chuyển.

<!-- TODO: Add a production-approved Vietnamese background illustration without real customer data. -->

> **Placeholder minh họa — Vấn đề**
>
> TODO: Bổ sung hình thể hiện thời gian chờ không rõ, nghiệp vụ quầy phân tán và thông báo bị bỏ lỡ.

<!-- TODO: Add a production-approved Vietnamese problem illustration without broken image links. -->

### Giải pháp và giá trị

QR ổn định của Branch mở LINE/LIFF. Khách đã được LINE xác minh chọn Queue và Product/Service, sau đó nhận Ticket có mã lượt, mã đơn, số người phía trước, ETA, mục đã chọn và trạng thái thanh toán. Staff xử lý Ticket được gọi tự động, bắt đầu/hoàn thành phục vụ, lùi lượt khi vắng, hủy, thu số dư và in biên nhận.

Giá trị chính:

- Khách có thể rời quầy nhưng vẫn theo dõi được thứ tự.
- Một QR Branch ổn định phục vụ nhiều Queue.
- Product definition thuộc Organization, còn stock thuộc từng Branch.
- Booking, Ticket, payment, stock và thao tác Staff được quản lý nhất quán.
- LINE thông báo các mốc created, còn đúng 5 người, called, completed, vắng mặt và hủy.
- Có thể review bằng tiếng Nhật, tiếng Việt và tiếng Anh.

> **Placeholder minh họa — Khái niệm**
>
> TODO: Bổ sung một sơ đồ: Branch QR → LINE Login → chọn Queue → Booking → Ticket → Staff phục vụ → LINE notification.

<!-- TODO: Add a production-approved Vietnamese concept illustration and keep this placeholder visible until it exists. -->

### Vai trò và chức năng chính

| Người dùng         | Chức năng chính                                                                 |
| ------------------ | ------------------------------------------------------------------------------- |
| Business Applicant | Thông tin doanh nghiệp, quy mô, gói, Demo Payment và gửi hồ sơ                  |
| Platform Admin     | Xem/sửa/duyệt/từ chối hồ sơ và tạo Organization                                 |
| Organization Owner | Cài đặt Organization, Product/Service, Branch, Branch Manager, audit, analytics |
| Branch Manager     | Lịch, Queue, gán danh mục, stock, Staff và QR ổn định của Branch được giao      |
| Staff              | Ticket gọi tự động, bắt đầu/hoàn thành, hủy, xử lý vắng, số dư và biên nhận     |
| Customer           | Xác thực LINE/LIFF, chọn Queue/mục, Booking, payment, Ticket, lịch sử, cài đặt  |

### Luồng đầy đủ

```text
Doanh nghiệp đăng ký
→ Platform Admin duyệt
→ Owner kích hoạt
→ Danh mục Organization
→ Tạo Branch và mời Branch Manager
→ Queue, gán mục, stock Branch, Staff và QR
→ LINE Login, chọn Queue, Booking và thanh toán khi cần
→ Ticket, Staff phục vụ, hoàn thành, biên nhận và LINE notification
```

Khi duyệt, hệ thống chỉ tạo Organization và Owner được mời; không tự tạo Branch hoặc Queue. Customer chỉ dùng LINE/LIFF. Admin, Owner, Branch Manager và Staff dùng email/mật khẩu doanh nghiệp.

### Ảnh sản phẩm

![Trang chủ công khai](./docs/images/guide/01-landing-page.png)

_Trang công khai giới thiệu sản phẩm và luồng đăng ký doanh nghiệp._

![Danh mục Product của Organization](./docs/images/guide/13-owner-product-catalog.png)

_Owner quản lý Product/Service dùng chung ở cấp Organization._

![QR ổn định của Branch](./docs/images/guide/28-branch-qr.png)

_Mỗi Branch có một QR ổn định; khách chọn Queue sau khi quét._

![Customer Ticket](./docs/images/guide/36-customer-ticket-mobile.png)

_Ticket mobile hiển thị mã lượt, số người phía trước, ETA, đơn và thanh toán._

![Staff workspace](./docs/images/guide/40-staff-workspace-desktop.png)

_Staff xem khách, đơn, trạng thái Ticket, số dư và thao tác phục vụ trên một màn hình._

### Trạng thái hiện tại

| Phạm vi                                                | Trạng thái                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| Đăng ký doanh nghiệp, Admin xét duyệt, Owner kích hoạt | Đã triển khai và xác minh bằng fixture local                       |
| Workspace Owner, Branch Manager và Staff               | Đã triển khai; đã xác minh quyền và luồng chính                    |
| QR, Mock LIFF, Customer Booking và Ticket              | Đã triển khai và kiểm thử browser                                  |
| Demo Payment                                           | Đã xác minh trên local                                             |
| LINE Login, Messaging và Rich Menu                     | Đã có; một số phần còn cần nghiệm thu bằng LINE thật/OA production |
| UI ba ngôn ngữ                                         | Japanese mặc định/fallback, Vietnamese và English đã triển khai    |

### Giới hạn hiện tại

- Settlement, reconciliation và provider refund thật cần nghiệm thu end-to-end với nhà cung cấp thanh toán.
- LINE Login consent, Add Friend, Rich Menu, Flex Message, native QR scanner và notification banner cần kiểm thử trên thiết bị thật.
- Google Routes thực cần production credentials và chấp thuận privacy.
- ETA là heuristic vận hành, không phải mô hình ML đã huấn luyện.
- Object storage, observability, backup/restore production và kiểm thử tải quy mô production cần hardening/nghiệm thu thêm.
- Hiện chưa có dashboard người dùng cho trạng thái delivery notification.

### Ghi chú kỹ thuật ngắn

Hệ thống dùng Web UI React/Vite, API Express/TypeScript và PostgreSQL; có thể kiểm thử local cô lập bằng Docker Compose. LINE Login/LIFF dùng để xác thực Customer, còn LINE Messaging API dùng để gửi notification — đây là hai capability riêng. Server xác minh lại price, Organization, Branch, LINE User ID, payment status và authorization thay vì tin dữ liệu browser gửi lên.

### Hướng dẫn và liên hệ

- [Hướng dẫn sử dụng](./docs/guide/guide.vi.md)
- Hỗ trợ: [trungnghia180205@gmail.com](mailto:trungnghia180205@gmail.com)
- Người phụ trách dự án: Nguyễn Trung Nghĩa
- Liên hệ: [Email](mailto:trungnghia180205@gmail.com) / [LinkedIn](https://www.linkedin.com/in/nguyen-trung-nghia-366842157/)

</details>
