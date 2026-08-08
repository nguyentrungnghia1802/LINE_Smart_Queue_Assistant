# 1. Quick Prompts

## Task tiếp theo

```text
Tuân thủ AGENTS.md. Tôi có các yêu cầu sau:

Đọc `docs/agent/tasks/task.md` và thực hiện duy nhất 1 task chưa đánh dấu hoàn thành, không Deferred tiếp theo.

Kiểm tra implementation/dependency trước khi sửa, hoàn thiện tests + canonical docs + trạng thái task, chạy validation theo AGENTS.md.

Không làm task tiếp theo.
Không commit/merge/push.
```

## Resume task dang dở

```text
Tuân thủ AGENTS.md. Tôi có các yêu cầu sau:

Đọc `docs/agent/tasks/task.md` và tiếp tục task đang dang dở.

Trước tiên kiểm tra branch, git status, các thay đổi hiện tại và xác định phần đã làm/phần còn thiếu.

Không làm lại phần đã đúng và không chuyển sang task tiếp theo.

Hoàn thành task, tests, canonical docs, task status và validation.

Không commit/merge/push.
```

## Finalize Git

```text
Tuân thủ workflow Git/Remote Finalization trong AGENTS.md.

Validate công việc hiện tại, commit, merge an toàn vào `chore/dev`, push `chore/dev`, merge vào `main`, push `main`, xác minh remote, sau đó xoá các branch task đã hoàn thành và đã merge an toàn ở cả local/remote.

Không xoá `main` hoặc `chore/dev`.
Không force push.
Không xoá branch còn work chưa merge.

Báo cáo trạng thái Git cuối cùng.
```

## Build + push Docker

```text
Tuân thủ AGENTS.md. Tôi có các yêu cầu sau:

Kiểm tra Docker/Compose/CI/deployment configuration và revision hiện tại.

Build toàn bộ production Docker image cần thiết, tag theo convention hiện tại, push lên Docker Hub và xác minh push thành công.

Không deploy/restart production.

Báo cáo đầy đủ image và tag đã push.
```

## Task riêng

```text
Tuân thủ AGENTS.md. Tôi có các yêu cầu sau:

<MÔ TẢ YÊU CẦU>

```
