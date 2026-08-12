## Task — Auto-generate Manual Release Tag

**Status:** [x] Completed (2026-08-12)

- [x] Sửa `deploy/scripts/build-push.sh` để không yêu cầu operator nhập tag.
- [x] Script tự lấy Git HEAD và sinh release tag dạng `git-<short-sha>`, ưu tiên 12 ký tự.
- [x] Build và push API + Web với cùng release tag.
- [x] Giữ OCI revision label bằng full Git SHA.
- [x] Sau khi push thành công, in rõ:
  - `DEPLOY_TAG=<tag>`
  - full API image reference
  - full Web image reference
  - command VPS cần chạy: `./scripts/deploy.sh <tag>`
- [x] `deploy/scripts/deploy.sh` phải chấp nhận đúng tag tự sinh này.
- [x] Không thay đổi logic backup/verify/rollback hiện có.
- [x] Update tests/docs và chạy validation theo `AGENTS.md`.

### Verification evidence

- Manual release rehearsal verifies the generated 12-character tag, full-SHA OCI revision,
  shared API/Web tag, printed VPS handoff, and strict deploy-wrapper contract.
- Backup rehearsal verifies short-tag deploy, backup/restore, application rollback, and retained
  full-SHA compatibility for PowerShell/GitHub CD.
- Shell syntax, ShellCheck, affected Web tests/lint/typecheck/build, formatting, and spelling pass.

### Kết quả mong muốn

Local chỉ cần:

```bash
bash ./deploy/scripts/build-push.sh
```
