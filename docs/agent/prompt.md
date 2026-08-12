# Quick Prompts

Các prompt dưới đây dùng cùng `docs/agent/AGENTS.md`.

`AGENTS.md` chịu trách nhiệm cho các quy tắc ổn định của repository.
`prompt.md` chỉ xác định mục tiêu của lượt làm việc và mức finalization
được phép.

Theo mặc định, remote CI chạy bất đồng bộ. Với finalization chỉ đến push hoặc tạo/update Pull Request, Agent
không chờ hoặc poll CI sau khi remote operation thành công. Chỉ chờ CI khi prompt yêu cầu rõ hoặc khi cần merge.

---

## 1. One Task

Dùng nhiều nhất: thực hiện duy nhất một task tiếp theo trong `task.md`.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Đọc `docs/agent/tasks/task.md` và thực hiện duy nhất task chưa hoàn thành, không Deferred tiếp theo.

Không chuyển sang task tiếp theo.

Finalization mode: Commit + push task branch.
```

---

## 2. Multiple Tasks

Dùng khi muốn Agent làm liên tục nhiều task.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Đọc `docs/agent/tasks/task.md` và lần lượt thực hiện tất cả task chưa hoàn thành, không Deferred.

Hoàn thành đầy đủ từng task trước khi chuyển sang task tiếp theo.

Mỗi task phải có branch phù hợp theo dependency workflow trong AGENTS.md.

Finalization mode cho mỗi task: Commit + push task branch.

Không tạo Pull Request và không merge.
```

---

## 3. Resume Task

Dùng khi task đang làm bị ngắt giữa chừng.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Đọc `docs/agent/tasks/task.md` và tiếp tục duy nhất task đang dang dở.

Xác định phần đã hoàn thành và phần còn thiếu từ trạng thái repository và implementation hiện tại.

Không làm lại phần đã đúng và không chuyển sang task khác.

Finalization mode: Commit + push task branch.
```

---

## 4. Custom Task

Dùng cho yêu cầu riêng không thuộc `task.md`.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Yêu cầu:

<MÔ TẢ YÊU CẦU>

Finalization mode: Commit + push task branch.
```

Nếu chỉ muốn implementation mà chưa commit/push, đổi dòng cuối thành:

```text
Finalization mode: Implementation only.
```

---

## 5. Quick Commit + Push

Dùng cho các thay đổi do tôi tự sửa hoặc không thuộc task trong
`task.md`.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Review và finalization các thay đổi nhỏ hiện tại.
Chạy validation tối thiểu phù hợp với impact surface, commit và push branch hiện tại.
Sau khi push thành công, không cần chờ remote CI hoàn tất.
Không tạo Pull Request hoặc merge.
```

---

## 6. Branch Status Audit

Dùng để kiểm tra toàn bộ trạng thái branch trước khi tạo PR, merge hoặc
cleanup.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Audit toàn bộ local/remote branches và Pull Requests hiện tại.

Phân loại rõ:
- branch đã merge vào `main` và có thể xoá local an toàn;
- branch đã bị xoá remote nhưng local vẫn còn;
- branch đã push nhưng chưa có Pull Request;
- branch đang có Pull Request;
- branch có Pull Request đã merge;
- branch chưa push;
- branch có uncommitted work;
- branch ahead/behind remote;
- branch phụ thuộc branch khác;
- branch obsolete/superseded nếu có bằng chứng rõ ràng;
- branch đang phát triển hoặc chưa hoàn thành.

Xác định dependency và thứ tự Pull Request/merge an toàn cho các branch chưa merge.

Không sửa, commit, push, merge hoặc xoá gì.

Chỉ báo cáo trạng thái và đề xuất hành động.
```

---

## 7. PR + Merge All

Dùng khi muốn Agent tự xử lý toàn bộ các branch hợp lệ vào `main`.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Audit toàn bộ task branches chưa merge vào `main`, xác định dependency/ancestry và thứ tự merge an toàn.

Tạo hoặc cập nhật Pull Request cho tất cả branch hợp lệ và lần lượt merge theo đúng dependency order khi CI/repository rules cho phép.

Nếu một PR gặp conflict hoặc CI failure:
- chẩn đoán nguyên nhân;
- tự sửa nếu lỗi trực tiếp thuộc branch/PR đang xử lý;
- validate và retry tối đa 1 lần;
- nếu vẫn fail hoặc lỗi nằm ngoài phạm vi, dừng PR đó, báo blocker và tiếp tục chỉ với các PR độc lập không phụ thuộc vào nó.

Không bypass CI hoặc repository protection.

Finalization mode: Commit + push + Pull Request + merge.

Cuối cùng báo cáo toàn bộ PR, merge order, branch đã merge và blocker còn lại.
```

---

## 8. PR All, No Merge

Dùng khi muốn tạo toàn bộ PR nhưng tự review/merge sau.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Audit tất cả task branches chưa merge vào `main`, xác định dependency và tạo/cập nhật Pull Request cho tất cả branch hợp lệ theo đúng dependency order.

Không merge và không bật auto-merge.

Báo cáo các Pull Request và thứ tự merge đề xuất.

Finalization mode: Commit + push + create/update Pull Request.
```

---

## 9. Cleanup Merged Branches

Dùng sau khi các PR đã merge xong.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Audit local/remote branches.

Xoá các task branch đã được xác minh merge hoàn toàn vào `main` và không còn unique work.

Xoá local branch; xoá remote branch nếu vẫn còn và an toàn.

Không xoá `main`, branch chưa merge, branch đang phát triển hoặc branch còn unique work.

Báo cáo các branch đã xoá và branch được giữ lại.
```

---

## 10. Build + Push Docker

Dùng để publish production images nhưng chưa deploy VPS.

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

## 11. Deploy Production

Dùng sau khi production images đã được publish.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Deploy production bằng canonical deployment tooling hiện tại với release tag sau:

<RELEASE_TAG>

Không build hoặc publish image mới.
Không thay đổi release tag.

Báo cáo release đã deploy và trạng thái production cuối cùng.
```

---

## 12. Create New Task Plan

Dùng khi muốn tạo chu kỳ task mới.

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

# Recommended Usage

Workflow thông thường:

```text
One Task / Multiple Tasks
        ↓
Commit + push task branch
        ↓
Branch Status Audit (khi cần)
        ↓
PR All, No Merge
        ↓
Review / CI
        ↓
Merge
        ↓
Cleanup Merged Branches
```

Khi muốn tự động hóa toàn bộ giai đoạn integration, dùng
`PR + Merge All` thay cho `PR All, No Merge`.

Với thay đổi quan trọng hoặc có rủi ro cao, ưu tiên tạo PR nhưng không
tự merge để có bước review thủ công.
