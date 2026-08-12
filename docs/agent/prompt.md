# Quick Prompts

Các prompt dưới đây được thiết kế để dùng cùng `docs/agent/AGENTS.md`.

`AGENTS.md` chịu trách nhiệm về các rule ổn định của repository: scope, architecture, security, validation,
documentation, branch safety và giới hạn Git/remote operations.

Mỗi prompt chỉ mô tả **mục tiêu hiện tại** và **mức finalization được phép**. Không lặp lại các rule đã có trong
`AGENTS.md`.

Theo mặc định, remote CI chạy bất đồng bộ. Với finalization chỉ đến push hoặc tạo/update Pull Request, Agent
không chờ hoặc poll CI sau khi remote operation thành công. Chỉ chờ CI khi prompt yêu cầu rõ hoặc khi cần merge.

---

## 1. Task tiếp theo

```text
Tuân thủ `docs/agent/AGENTS.md`.

Đọc `docs/agent/tasks/task.md` và thực hiện duy nhất task chưa hoàn thành, không Deferred tiếp theo.

Chỉ thực hiện task đó. Không chuyển sang task tiếp theo.

Finalization mode: Commit + push + create/update Pull Request vào `main`.
Không merge Pull Request.
```

Dùng `Finalization mode: Implementation only.` nếu chỉ muốn Agent triển khai local, không commit/push.

---

## 2. Resume task dang dở

```text
Tuân thủ `docs/agent/AGENTS.md`.

Đọc `docs/agent/tasks/task.md` và tiếp tục duy nhất task đang dang dở.

Xác định phần đã hoàn thành và phần còn thiếu từ implementation, tests, docs và working tree hiện tại.
Không làm lại phần đã đúng và không chuyển sang task khác.

Finalization mode: Commit + push + create/update Pull Request vào `main`.
Không merge Pull Request.
```

---

## 3. Finalize current changes

Dùng khi các thay đổi hiện tại cần được review, hoàn thiện, commit và push mà không bắt đầu task mới.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Review và hoàn tất các thay đổi hiện tại trong working tree.

Không thực hiện task mới và không mở rộng phạm vi ngoài các thay đổi hiện có.
Chỉ sửa thêm những gì thực sự cần để các thay đổi hiện tại hoàn chỉnh và hợp lệ.

Finalization mode: Commit + push + create/update Pull Request vào `main`.
Không merge Pull Request.
```

---

## 4. Task riêng

```text
Tuân thủ `docs/agent/AGENTS.md`.

Yêu cầu:
<MÔ TẢ YÊU CẦU>

Finalization mode: Commit + push task branch.
```

Nếu muốn Agent commit/push sau task riêng:

```text
Finalization mode: Commit + push task branch.
```

Nếu muốn Agent tạo/update PR để bạn tự review:

```text
Finalization mode: Commit + push + create/update Pull Request vào `main`.
Không merge Pull Request.
```

Theo `AGENTS.md`, Agent dừng sau khi push/tạo PR thành công và không chờ CI trừ khi prompt yêu cầu khác.

---

## 5. Create/Update PR

Dùng khi branch đã sẵn sàng và chỉ muốn đưa thay đổi lên Pull Request để review thủ công.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Review công việc hiện tại và hoàn tất các bước cần thiết để tạo hoặc cập nhật Pull Request vào `main`.

Finalization mode: Commit + push + create/update Pull Request vào `main`.

Không merge Pull Request.
Không chờ hoặc poll CI sau khi Pull Request được tạo/cập nhật thành công.
```

---

## 6. PR + Auto-merge

Chỉ dùng khi muốn Agent chịu trách nhiệm đến tận bước merge.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Review công việc hiện tại và hoàn tất các bước cần thiết để sẵn sàng merge.

Finalization mode: Commit + push + Pull Request + auto-merge vào `main`.

Chỉ merge sau khi repository requirements và required CI/status checks cho phép.

Nếu xảy ra conflict hoặc required CI fail, kiểm tra nguyên nhân và chỉ sửa khi thuộc phạm vi công việc hiện tại.
Nếu lỗi nằm ngoài phạm vi hoặc resolution materially ambiguous, dừng và báo thay vì tự mở rộng scope.

Báo cáo PR, CI và merge status cuối cùng.
```

---

## 7. Create Task

Dùng để tạo chu kỳ task mới sau khi plan hiện tại đã hoàn tất.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Kiểm tra `docs/agent/tasks/task.md`.

Nếu vẫn còn task chưa hoàn thành và không Deferred:
- không tạo plan mới;
- không xoá hoặc ghi đè `idea.md` / `task.md`;
- dừng và báo task còn lại.

Nếu plan hiện tại đã hoàn thành hoặc Deferred toàn bộ:

1. Thay toàn bộ nội dung `docs/agent/tasks/idea.md` bằng 8 idea mới phù hợp với trạng thái thực tế của dự án.
   - Ưu tiên giá trị thực tế, khả thi và phù hợp kiến trúc hiện tại.
   - Không tạo idea chỉ để mở rộng tech stack.
   - Mỗi idea tối đa 45 dòng.

2. Chọn 4 idea tốt nhất.

3. Thay toàn bộ nội dung `docs/agent/tasks/task.md` bằng 4-6 task để hiện thực hóa các idea đã chọn.
   - Task phải rõ phạm vi, outcome và checklist.
   - Mỗi task tối đa 80 dòng.
   - Sắp xếp theo dependency và mức ưu tiên hợp lý.

Không triển khai các task mới trong cùng lượt này.

Finalization mode: Implementation only.
```

---

# Recommended Default

Với công việc phát triển thông thường, ưu tiên:

```text
Finalization mode: Commit + push task branch.
```

Flow mặc định:

```text
Implementation
→ targeted local validation
→ commit
→ push task branch
→ verify push succeeded
→ stop
```

Remote CI tiếp tục chạy bất đồng bộ; Agent không cần chờ.

Khi muốn review qua GitHub:

```text
Finalization mode: Commit + push + create/update Pull Request vào `main`.
```

Agent tạo/update PR thành công rồi dừng; CI tiếp tục chạy độc lập.

Chỉ dùng `PR + Auto-merge` khi thực sự muốn Agent theo dõi required checks và chịu trách nhiệm đến bước merge.

Đối với thay đổi quan trọng, security-sensitive, database, authentication, payment, deployment hoặc CI/CD,
ưu tiên **Create/Update PR, không merge** để review thủ công trước.
