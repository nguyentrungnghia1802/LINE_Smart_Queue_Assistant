# Task: Production CI/CD với Immutable Docker Releases

**Status:** Repository implementation and validation complete (2026-08-12); external activation
pending repository secret and first merged-main production run.

**Implemented evidence:**

- PR/main CI and same-repository successful-main `workflow_run` CD are versioned and statically
  validated by `npm run release:workflows:verify` plus `actionlint`.
- Full-SHA API/Web publication, production approval ordering, serialized deployment, backup gate,
  exact image persistence, migration/recreate/health, and metadata-driven automatic application
  rollback are implemented. The isolated Docker rehearsal passed, including a forced
  post-mutation failure and proof that database/media were not restored.
- Canonical architecture, development, deployment, operations, implementation-map, ADR, README,
  guide, and changelog references now describe the automatic validated-main path; manual local
  publication is emergency-only.
- GitHub `Protect_main` is active with PR, linear-history, deletion/non-fast-forward, up-to-date,
  and required status-check rules. The `production` environment is restricted to `main` and has a
  required reviewer. Repository variables `DOCKERHUB_USERNAME` and `VITE_LIFF_ID` are configured.

**External acceptance still required:**

- Add repository Actions secret `DOCKERHUB_TOKEN`; GitHub never exposes an existing environment
  secret value, so it cannot be migrated safely through repository tooling.
- Merge the task PR only after required CI passes. Retain evidence from the resulting main CI,
  image publication, production approval, verified backup ID, VPS health checks, and any rollback.
  Until that first real run succeeds, production CI/CD is not claimed complete end-to-end.

## Mục tiêu

Chuẩn hóa CI/CD của LINE Smart Queue Assistant để quy trình production trở thành:

Feature/Task Branch
→ Pull Request
→ CI Validation
→ Merge `main`
→ Build immutable Docker images
→ Push Docker registry
→ Production approval
→ Backup + Verify
→ Deploy chính xác release vừa build
→ Health check
→ Rollback application release khi cần

Mục tiêu cuối cùng là developer không còn phải:

- build/push production image thủ công từ local;
- sử dụng `:latest` làm production release identity;
- nhớ hoặc nhập Docker tag;
- sửa image tag thủ công trong `.env`;
- SSH vào VPS và chạy từng lệnh deploy bằng tay.

Không thay đổi business logic/UI ngoài những gì thực sự cần cho production build/deployment.

---

## 1. Audit CI/CD hiện tại

Trước khi implementation, audit:

- `.github/workflows/`;
- Dockerfiles API/Web;
- `deploy/docker-compose.yml`;
- `deploy/.env.example`;
- `deploy/backup/`;
- deployment scripts/workflows hiện tại;
- canonical deployment/operations docs;
- Git workflow hiện tại, bao gồm vai trò của `chore/dev` nếu có.

Reuse implementation hiện có. Không tạo workflow hoặc logic trùng lặp nếu repository đã có thành phần tương đương.

---

## 2. PR-based CI workflow

Chuẩn hóa development flow thành:

Feature/Task Branch
→ Pull Request
→ CI
→ Merge `main`

PR vào `main` phải chạy các quality gates phù hợp với repository và `AGENTS.md`, bao gồm các validation hiện có như:

- lint;
- typecheck;
- tests;
- production build;
- formatting;
- OpenAPI validation;
- dependency/security audit;
- Compose validation;
- các repository-specific checks hiện có.

Không deploy production từ Pull Request.

Chuẩn bị repository để `main` có thể được bảo vệ bằng GitHub Ruleset/Branch Protection.

Nếu workflow hiện tại còn phụ thuộc vào local merge trực tiếp vào `main`, cập nhật workflow/docs liên quan để tương thích với PR-based flow.

Audit vai trò của `chore/dev`. Không xóa chỉ vì preference; chỉ simplify thành:

Feature Branch → PR → main

nếu branch trung gian thực sự không còn giá trị.

---

## 3. Immutable Docker images

Production không được sử dụng `:latest` làm release identity.

Khi code đã merge vào `main`, CI/CD phải tự động build:

- API image;
- Web image.

Tag immutable phải được derive tự động từ Git commit SHA, ví dụ:

`trungnghia2703/line-smart-queue-api:<git-sha>`

`trungnghia2703/line-smart-queue-web:<git-sha>`

Có thể publish thêm `:latest` như convenience tag nếu có lý do, nhưng production deployment và rollback không được phụ thuộc vào `latest`.

Cùng một release identifier phải được sử dụng xuyên suốt:

Git commit
→ Docker build
→ Registry
→ VPS deployment
→ Backup metadata
→ Rollback identification

Web build phải tiếp tục nhận đúng production build configuration hiện tại, bao gồm LIFF public configuration nếu cần.

Không hard-code secret vào workflow hoặc Docker image.

---

## 4. Release configuration

Tách application/runtime configuration khỏi release identity nếu hợp lý.

`deploy/.env` tiếp tục dành chủ yếu cho:

- production secrets;
- runtime configuration;
- infrastructure/application configuration.

Không yêu cầu operator sửa image tag thủ công trong `.env` cho mỗi release.

Nếu phù hợp với architecture hiện tại, sử dụng một release-state mechanism riêng, ví dụ:

`deploy/release.env`

với:

`LINE_QUEUE_API_IMAGE=<immutable-api-image>`

`LINE_QUEUE_WEB_IMAGE=<immutable-web-image>`

Hoặc chọn mechanism khác tốt hơn nếu audit repository cho thấy phù hợp hơn.

Docker Compose phải resolve chính xác immutable images của release đang deploy.

Compose project identity tiếp tục là:

`line-smart-queue`

Canonical VPS layout tiếp tục là:

`/opt/line-smart-queue/deploy/`

Runtime backup tiếp tục nằm ngoài repository:

`/var/backups/line-smart-queue/`

---

## 5. Production deployment script

Tạo hoặc hoàn thiện version-controlled production release tooling, ưu tiên structure rõ ràng như:

`deploy/release/`

Deployment logic chính phải nằm trong repository thay vì nhét toàn bộ logic thành ad-hoc SSH commands trong GitHub Actions.

Production deployment phải thực hiện theo thứ tự an toàn:

1. Nhận release identifier/image references từ CI/CD.
2. Xác minh input hợp lệ.
3. Xác định current/previous release.
4. Chạy production backup bằng backup tooling hiện có.
5. Verify backup.
6. Abort ngay nếu backup/verification fail.
7. Pull chính xác immutable API/Web images.
8. Chạy migration theo strategy hiện tại.
9. Deploy/recreate đúng services cần thiết.
10. Chờ và kiểm tra health/readiness.
11. Ghi nhận successful release.

Không duplicate backup logic đã có trong `deploy/backup/`.

Không sử dụng destructive Docker operations đối với persistent volumes.

---

## 6. Rollback

Application rollback và data restore phải tiếp tục là hai operation riêng biệt.

Nếu application deployment mới fail:

- rollback về previous immutable API/Web images;
- không tự động restore PostgreSQL/media;
- không phá persistent volumes;
- verify health sau rollback.

Data restore chỉ được thực hiện bằng restore tooling hiện có khi operator chủ động yêu cầu.

Backup metadata/release state phải đủ để xác định release trước đó một cách deterministic.

---

## 7. GitHub Actions CD

Sau khi merge `main`:

1. Build production API/Web images.
2. Tag bằng Git SHA.
3. Push immutable images lên Docker registry.
4. Chuẩn bị production deployment.
5. Production deployment phải đi qua GitHub Environment `production` nếu phù hợp.
6. Deployment chỉ chạy sau production approval khi repository/plan hỗ trợ protection rule đó.
7. Sau approval, GitHub Actions SSH vào VPS và gọi version-controlled deployment tooling với release identifier tương ứng.

Không yêu cầu developer SSH vào VPS cho normal deployment.

Không yêu cầu developer nhập tag.

Không rebuild image trên VPS.

Image được deploy phải chính xác là artifact đã build/push từ commit tương ứng.

---

## 8. Concurrency

Production deployment phải có concurrency protection.

Không cho phép hai production deployments chạy đồng thời hoặc race nhau.

Nếu một release đang deploy, release khác không được làm production state trở nên không xác định.

---

## 9. Secrets

Không commit:

- production `.env`;
- Docker registry credentials;
- VPS SSH private key;
- production secrets;
- backup data;
- runtime release state không phù hợp để version-control.

Sử dụng GitHub Secrets / Environment Secrets phù hợp.

Audit và document chính xác các secret/config cần thiết, ví dụ:

- Docker registry username/token;
- VPS host;
- VPS user;
- VPS SSH private key;
- public Web build configuration nếu cần.

Không để secret xuất hiện trong Actions logs.

---

## 10. GitHub main protection

Repository phải được chuẩn bị cho `main` ruleset với tối thiểu:

- Require pull request before merging;
- Require required status checks to pass;
- Block force pushes;
- Block branch deletion.

Nếu repository chủ yếu có một developer thì không bắt buộc artificial self-review chỉ để đủ số approval.

Production environment nên có manual approval nếu GitHub repository/plan hỗ trợ.

Nếu repository settings không thể cấu hình từ code/tooling hiện tại, không giả vờ chúng đã được bật.

Document chính xác những bước operator phải cấu hình thủ công trên GitHub UI.

---

## 11. Documentation

Cập nhật canonical documentation để normal production workflow trở thành:

Developer
→ Feature branch
→ Pull Request
→ CI PASS
→ Merge main

System
→ Build immutable API/Web images
→ Push registry
→ Production approval
→ Backup + Verify
→ Deploy exact Git SHA release
→ Health check

Các hướng dẫn production cũ kiểu:

`docker build ...:latest`

`docker push ...:latest`

`docker compose pull`

`docker compose up ...`

không được tiếp tục mô tả là normal production deployment flow.

Có thể giữ manual commands dưới emergency/manual recovery section nếu chúng vẫn có giá trị.

Document:

- CI flow;
- CD flow;
- Docker tagging strategy;
- production approval;
- required GitHub Secrets;
- GitHub Environment setup;
- main branch protection/ruleset;
- VPS requirements;
- backup gate;
- rollback strategy;
- emergency/manual deployment procedure.

---

## 12. Validation / Acceptance Criteria

Task chỉ được coi là hoàn thành khi chứng minh được:

- PR CI trigger đúng và không deploy production;
- merge `main` trigger đúng release workflow;
- Docker image tags được derive từ Git SHA;
- production không reference `:latest`;
- API/Web của cùng release có deterministic release identity;
- Compose resolve đúng immutable images;
- Compose project vẫn là `line-smart-queue`;
- backup chạy trước production mutation;
- invalid/failed backup chặn deployment;
- migration chạy đúng strategy hiện tại;
- health checks được thực hiện sau deployment;
- failed application release có thể rollback về previous immutable release;
- rollback không tự restore database/media;
- production deployments có concurrency guard;
- GitHub Actions/workflow syntax hợp lệ;
- Compose validation pass;
- existing backup/restore rehearsal không regress;
- không leak secrets;
- toàn bộ quality gates bắt buộc của repository pass.

Không cần thực hiện destructive production restore để chứng minh task.

---

## 13. Out of Scope

Không mở rộng task sang:

- Kubernetes;
- ArgoCD;
- Flux;
- Terraform;
- multi-node orchestration;
- cloud migration;
- redesign business/UI;
- thay đổi database architecture không liên quan.

Giữ giải pháp phù hợp với kiến trúc hiện tại:

GitHub Actions + Docker Registry + Docker Compose + single VPS.

---

## Definition of Done

Normal production release phải đạt flow:

Feature Branch
→ PR
→ CI PASS
→ Merge `main`
→ Build immutable images
→ Push registry
→ Production approval
→ Backup VALID
→ Deploy exact release
→ Health PASS

Developer không phải nhớ Docker tag, sửa tag thủ công, build production image local hoặc SSH vào VPS để deploy từng bước.

Nếu còn bước cấu hình GitHub/VPS bắt buộc phải thực hiện thủ công ngoài repository, task phải ghi rõ trạng thái đó và hướng dẫn chính xác; không được tuyên bố production CI/CD hoàn tất end-to-end khi các external acceptance steps đó chưa được xác minh.
