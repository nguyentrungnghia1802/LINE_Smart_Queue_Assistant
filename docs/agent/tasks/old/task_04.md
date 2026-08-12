## Task — Manual Docker Build & Deploy Scripts

**Status:** [x] Completed (2026-08-12)

- [x] Tạo folder `deploy/scripts/` chứa các script hỗ trợ build/push và deploy Docker production thủ công.
- [x] Tạo `build-push.sh <tag>` để build và push API + Web với cùng một immutable tag (ưu tiên Git SHA), không phụ thuộc `latest`.
- [x] Tạo `deploy.sh <tag>` để deploy đúng API/Web image theo tag trên VPS mà không cần sửa `.env` thủ công.
- [x] `deploy.sh` phải reuse `deploy/backup/deploy-safe.sh`; không viết lại logic backup, verify hoặc rollback đã có.
- [x] Đảm bảo API, Worker và Web sau deploy sử dụng đúng release tag.
- [x] Sửa vấn đề Web Nginx giữ stale IP của API sau khi API restart/recreate, tránh `/api/*` bị `502 Bad Gateway` sau backup/deploy.
- [x] Đảm bảo các script backup/restore/rollback hiện tại tương thích với immutable image tag `<git-sha>`.
- [x] Không hard-code hoặc log secrets.
- [x] Thêm tests/rehearsal cần thiết và chạy validation theo `docs/agent/AGENTS.md`.
- [x] Cập nhật canonical docs/runbook liên quan.

### Kết quả mong muốn

Manual workflow chỉ còn:

```bash
# Local
./deploy/scripts/build-push.sh <tag>

# VPS
./scripts/deploy.sh <tag>
```

### Verification evidence

- `deploy/scripts/build-push.sh` requires the checked-out full SHA and emits only one API/Web
  immutable tag; it does not publish `latest`.
- `deploy/scripts/deploy.sh` is a thin delegation to `deploy/backup/deploy-safe.sh`, so the
  existing backup, verification, migration, health, and image-metadata rollback safeguards remain
  authoritative.
- `docker/nginx/default.conf` resolves `api` through Docker's embedded DNS at request time for
  API, realtime, and media proxy paths, preventing stale container-IP references after recreate.
- `deploy/scripts/tests/rehearsal.sh` and CI exercise tag parity, no-`latest`, delegation, and
  runtime-DNS invariants without changing production state.
