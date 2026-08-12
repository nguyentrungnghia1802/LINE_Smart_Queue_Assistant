# Quick Prompts

Các prompt dưới đây được thiết kế để dùng cùng `docs/agent/AGENTS.md`.

`AGENTS.md` chịu trách nhiệm về các rule ổn định của repository: scope, architecture, security, validation,
documentation, branch safety và giới hạn Git/remote operations.

Mỗi prompt chỉ mô tả **mục tiêu hiện tại** và **mức finalization được phép**. Không lặp lại các rule đã có trong
`AGENTS.md`.

---

## 1. Task tiếp theo

```text
Tuân thủ `docs/agent/AGENTS.md`.

Đọc `docs/agent/tasks/task.md` và thực hiện duy nhất task chưa hoàn thành, không Deferred tiếp theo.

Chỉ thực hiện task đó. Không chuyển sang task tiếp theo.

Finalization mode: Implementation only.
```

Có thể thay dòng cuối bằng `Finalization mode: Commit + push task branch.` nếu muốn Agent
commit/push sau khi hoàn tất task.

## 2. Resume task dang dở

```text
Tuân thủ `docs/agent/AGENTS.md`.

Đọc `docs/agent/tasks/task.md` và tiếp tục duy nhất task đang dang dở.

Xác định phần đã hoàn thành và phần còn thiếu từ implementation, tests, docs và working tree hiện tại.
Không làm lại phần đã đúng và không chuyển sang task khác.

Finalization mode: Commit + push task branch.
```

---

## 3. Finalize current changes

Dùng khi các thay đổi hiện tại do tôi tự sửa hoặc không thuộc task trong `task.md`.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Review và hoàn tất các thay đổi hiện tại trong working tree.

Không thực hiện task mới và không mở rộng phạm vi ngoài các thay đổi hiện có.
Chỉ sửa thêm những gì thực sự cần để các thay đổi hiện tại hoàn chỉnh và hợp lệ.

Finalization mode: Commit + push task branch.
```

---

## 4. Commit + Push

Dùng khi implementation đã xong và chỉ muốn lưu thay đổi lên remote branch.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Review trạng thái hiện tại và hoàn tất validation phù hợp nếu còn thiếu.

Finalization mode: Commit + push task branch.
```

---

## 5. Create PR, không merge

Dùng khi muốn tạo Pull Request để review thủ công.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Review công việc hiện tại và hoàn tất các bước cần thiết để sẵn sàng review.

Finalization mode: Commit + push + create/update Pull Request vào `main`.

Không merge Pull Request và không bật auto-merge.

Báo cáo PR và trạng thái CI hiện tại.
```

---

## 6. PR + Auto-merge

Dùng cho thay đổi đã được phép tự động merge sau khi CI/ruleset đạt yêu cầu.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Review công việc hiện tại và hoàn tất các bước cần thiết để sẵn sàng merge.

Finalization mode: Commit + push + Pull Request + auto-merge vào `main`.

Chỉ merge sau khi repository requirements cho phép.

Báo cáo PR, CI và merge status cuối cùng.

Nếu xảy ra Conflict hoặc CI fail, tự động kiểm tra lỗi, sửa và retry merge. Không bỏ qua lỗi.
```

---

## 7. Build + Push Docker

Dùng để publish release image nhưng chưa deploy production.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Build và push các production Docker image cần thiết bằng canonical release tooling hiện tại của repository.

Dùng cùng một immutable release tag cho các image thuộc cùng release và xác minh push thành công.

Không deploy hoặc restart production.

Cuối cùng, in rõ:
- release tag;
- full API image reference;
- full Web image reference;
- command/tag cần dùng cho bước deploy trên VPS.
```

---

## 8. Deploy production

Dùng sau khi release image đã được publish và có release tag cụ thể.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Deploy production bằng canonical deployment tooling hiện tại với release tag sau:

<RELEASE_TAG>

Không build hoặc publish image mới.
Không thay đổi release tag.

Thực hiện đúng các safety gate, backup/verification, health check và rollback behavior đã được repository quy định.

Báo cáo release đã deploy và trạng thái production cuối cùng.
```

---

## 9. Task riêng

```text
Tuân thủ `docs/agent/AGENTS.md`.

Yêu cầu:
<MÔ TẢ YÊU CẦU>

Finalization mode: Implementation only.
```

Nếu muốn Agent commit/push sau task riêng, thay dòng cuối bằng:

```text
Finalization mode: Commit + push task branch.
```

Nếu muốn tạo PR nhưng tự review:

```text
Finalization mode: Commit + push + create/update Pull Request vào `main`.
Không merge Pull Request.
```

---

## 10. Create Task

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

Chỉ dùng PR/merge prompt khi thực sự muốn Agent thực hiện bước remote tương ứng.

Đối với thay đổi quan trọng, security-sensitive, database, authentication, payment, deployment hoặc CI/CD,
ưu tiên **Create PR, không merge** để review thủ công trước.
