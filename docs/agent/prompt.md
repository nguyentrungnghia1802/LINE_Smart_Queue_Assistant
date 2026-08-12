# Quick Prompts

Các prompt dưới đây dùng cùng `docs/agent/AGENTS.md`.

`AGENTS.md` chứa các quy tắc ổn định của repository. `prompt.md` chỉ xác định mục tiêu của lượt làm việc và mức
finalization được phép.

Workflow mặc định là task branch → targeted validation → commit → push. Pull Request không thuộc workflow mặc định.
Khi được yêu cầu tích hợp vào `main`, Agent merge local rồi push `main`. Remote CI/CD chạy bất đồng bộ; production
deployment vẫn tuân thủ approval gate của repository.

---

## 1. One Task

Dùng nhiều nhất: thực hiện duy nhất task tiếp theo trong `task.md`.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Đọc `docs/agent/tasks/task.md` và thực hiện duy nhất task chưa hoàn thành, không Deferred tiếp theo.

Không chuyển sang task tiếp theo.

Finalization mode: Commit + integrate task branch into local `main` + push `main`.
```

---

## 2. Multiple Tasks

Dùng khi muốn Agent làm liên tục nhiều task.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Đọc `docs/agent/tasks/task.md` và lần lượt thực hiện tất cả task chưa hoàn thành, không Deferred.

Hoàn thành đầy đủ từng task trước khi chuyển sang task tiếp theo.
Mỗi task dùng branch phù hợp theo dependency workflow trong AGENTS.md.

Finalization mode: Commit + integrate task branch into local main + push main.
```

---

## 3. Resume Task

Dùng khi task đang làm bị ngắt giữa chừng.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Đọc `docs/agent/tasks/task.md` và tiếp tục duy nhất task đang dang dở.

Xác định phần đã hoàn thành và phần còn thiếu từ trạng thái repository và implementation hiện tại.
Không làm lại phần đã đúng và không chuyển sang task khác.

Finalization mode: Commit + integrate task branch into local main + push main.
```

---

## 4. Custom Task

Dùng cho yêu cầu riêng không thuộc `task.md`.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Yêu cầu:

<MÔ TẢ YÊU CẦU>

Finalization mode: Commit + integrate task branch into local main + push main.
```

Nếu chỉ muốn implementation local:

```text
Finalization mode: Implementation only.
```

---

## 5. Quick Commit + Push

Dùng cho các thay đổi do tôi tự sửa hoặc không thuộc `task.md`.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Review và hoàn tất các thay đổi hiện tại trong working tree.

Không thực hiện task mới hoặc mở rộng phạm vi ngoài các thay đổi hiện có.

Finalization mode: Commit + integrate task branch into local main + push main.
```

---

## 6. Integrate Current Task Into Main

Dùng khi task branch đã hoàn thành và muốn tích hợp thẳng vào `main` mà không dùng Pull Request.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Review task branch hiện tại và xác minh công việc đã hoàn thành, validation phù hợp đã pass và working tree an toàn để tích hợp.

Finalization mode: Commit + integrate task branch into local `main` + push `main`.

Không chờ hoặc poll remote CI/CD sau khi push thành công.
Không deploy production.
```

---

## 7. Integrate All Completed Branches Into Main

Dùng khi có nhiều task branch đã hoàn thành và muốn tích hợp lần lượt vào `main`.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Audit các local/remote task branch chưa được tích hợp vào `main`.

Xác định branch đã hoàn thành, dependency/ancestry và thứ tự integration an toàn.

Lần lượt tích hợp chỉ các branch đã hoàn thành vào local `main`, validate theo impact surface và push `main`.

Không tích hợp branch đang phát triển, còn unique work chưa hoàn thành hoặc có dependency chưa được giải quyết.
Nếu conflict materially ambiguous, dừng branch đó và không tự mở rộng scope để xử lý.

Sau khi push `main` thành công, không chờ hoặc poll remote CI/CD.
Không deploy production.

Báo cáo branch đã tích hợp, branch được giữ lại và blocker nếu có.
```

---

## 8. Branch Status Audit

Dùng để kiểm tra trạng thái repository trước integration hoặc cleanup.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Audit toàn bộ local/remote branches hiện tại.

Phân loại rõ:
- branch đã được tích hợp hoàn toàn vào `main`;
- branch remote đã xoá nhưng local vẫn còn;
- branch local chưa push;
- branch có uncommitted work;
- branch ahead/behind remote;
- branch phụ thuộc branch khác;
- branch obsolete/superseded nếu có bằng chứng rõ ràng;
- branch đang phát triển hoặc chưa hoàn thành;
- branch còn unique work chưa có trong `main`.

Xác định dependency và thứ tự integration an toàn cho các branch chưa được tích hợp.

Không sửa, commit, push, merge hoặc xoá gì.

Chỉ báo cáo trạng thái và đề xuất hành động.
```

---

## 9. Cleanup Integrated Branches

Dùng sau khi các task branch đã được tích hợp vào `main`.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Audit local/remote branches.

Xoá các task branch đã được xác minh tích hợp hoàn toàn vào `main` và không còn unique work.

Xoá local branch; xoá remote branch nếu vẫn còn và an toàn.

Không xoá `main`, branch chưa được tích hợp, branch đang phát triển hoặc branch còn unique work.

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

Chỉ dùng khi thực sự muốn deploy một release đã được publish.

```text
Tuân thủ `docs/agent/AGENTS.md`.

Deploy production bằng canonical deployment tooling hiện tại với release tag sau:

<RELEASE_TAG>

Tuân thủ production approval/protection hiện tại của repository.

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

Finalization mode: Commit + integrate task branch into local main + push main.
```

---

# Recommended Usage

Workflow phát triển thông thường:

```text
One Task / Multiple Tasks
        ↓
targeted validation
        ↓
commit + push task branch
        ↓
Integrate Current Task Into Main
        ↓
local main → push main
        ↓
CI/release automation chạy async
        ↓
production approval khi thực sự muốn deploy
```

Khi có nhiều branch đã hoàn thành:

```text
Branch Status Audit
        ↓
Integrate All Completed Branches Into Main
        ↓
Cleanup Integrated Branches
```

Không dùng Pull Request trong workflow mặc định. Chỉ sử dụng Pull Request khi một prompt đặc biệt yêu cầu review/integration qua PR.

Việc push `main` không đồng nghĩa với quyền deploy production. CI/CD và production approval tiếp tục tuân thủ
`AGENTS.md` và repository configuration.
