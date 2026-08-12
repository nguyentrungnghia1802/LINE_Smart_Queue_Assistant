# 1. Quick Prompts

## Task tiếp theo

```text
Tuân thủ docs\agent\AGENTS.md. Tôi có các yêu cầu sau:

Đọc `docs/agent/tasks/task.md` và thực hiện duy nhất 1 task chưa đánh dấu hoàn thành, không Deferred tiếp theo.

Trước tiên kiểm tra branch, git status, implementation/dependency liên quan và xác định chính xác phạm vi task trước khi sửa.

Không làm lại phần đã đúng và không chuyển sang task tiếp theo.

Hoàn thiện implementation, tests, canonical docs và trạng thái task; chạy đầy đủ validation theo AGENTS.md.

Sau khi hoàn thành, thực hiện Git/Remote Finalization theo AGENTS.md: commit trên task branch, push task branch và tạo/cập nhật Pull Request vào `main` khi tooling/quyền cho phép. Không merge trực tiếp hoặc push trực tiếp vào `main`, không bypass required CI/ruleset.

Nếu còn bước GitHub bắt buộc chưa thể thực hiện, dừng ở trạng thái an toàn và báo rõ bước thủ công còn lại.
```

## Resume task dang dở

```text
Tuân thủ docs\agent\AGENTS.md. Tôi có các yêu cầu sau:

Đọc `docs/agent/tasks/task.md` và tiếp tục duy nhất task đang dang dở.

Trước tiên kiểm tra branch, git status, các thay đổi hiện tại, implementation/dependency liên quan và xác định phần đã làm đúng/phần còn thiếu.

Không làm lại phần đã đúng và không chuyển sang task tiếp theo.

Hoàn thành task, tests, canonical docs, task status và toàn bộ validation theo AGENTS.md.

Sau khi hoàn thành, thực hiện Git/Remote Finalization theo AGENTS.md: commit trên task branch, push task branch và tạo/cập nhật Pull Request vào `main` khi tooling/quyền cho phép. Không merge trực tiếp hoặc push trực tiếp vào `main`, không bypass required CI/ruleset.

Nếu còn bước GitHub bắt buộc chưa thể thực hiện, dừng ở trạng thái an toàn và báo rõ bước thủ công còn lại.
```

## Finalize Current Changes

```text
Tuân thủ docs\agent\AGENTS.md. Tôi có các yêu cầu sau:

Review và hoàn tất các thay đổi hiện tại trong working tree do tôi tự sửa hoặc không thuộc task trong `docs/agent/tasks/task.md`.

Kiểm tra branch, git status, toàn bộ diff và remote state. Không thực hiện task mới và không mở rộng phạm vi.

Chỉ sửa tối thiểu nếu cần để các thay đổi hiện tại hợp lệ. Loại trừ secret, runtime `.env`, backup data, temporary/debug/generated artifacts và các file không nên commit.

Chạy validation phù hợp theo AGENTS.md.

Nếu hợp lệ, thực hiện Git/Remote Finalization theo AGENTS.md: tạo branch phù hợp nếu đang ở `main`, commit các thay đổi hiện tại, push branch, tạo/cập nhật PR vào `main`, chờ required CI và merge qua protected PR workflow khi được phép.

Không local merge/push trực tiếp vào `main`, không bypass ruleset, không force push và không sử dụng `chore/dev` làm branch trung gian nếu không có yêu cầu riêng.

Nếu có thay đổi không xác định được mục đích hoặc không thể hoàn tất PR/merge an toàn, giữ nguyên và báo rõ thay vì tự xử lý.

Báo cáo trạng thái Git/PR/CI cuối cùng.
```

## Finalize Git

```text
Tuân thủ Git/Remote Finalization workflow trong docs\agent\AGENTS.md.

Kiểm tra branch, git status, diff, validation và remote state của công việc hiện tại.

Nếu công việc đã hoàn thành và validation đạt yêu cầu:
- commit các thay đổi thuộc đúng task trên task branch;
- push task branch lên remote;
- tạo hoặc cập nhật Pull Request vào `main` khi tooling/quyền cho phép;
- để required CI/status checks và repository rules quyết định merge eligibility;
- chỉ merge thông qua protected Pull Request workflow khi AGENTS.md, quyền hiện tại và repository rules cho phép;
- sau merge, xác minh remote `main` chứa công việc đã hoàn thành;
- chỉ xoá task branch đã merge an toàn khi phù hợp.

Không local merge task branch vào `main`.
Không push trực tiếp task changes vào `main`.
Không sử dụng `chore/dev` như branch trung gian trừ khi repository hiện tại có yêu cầu riêng rõ ràng.
Không bypass branch protection.
Không force push.
Không xoá branch còn work chưa merge.
Không xoá `main`.

Nếu không thể hoàn tất PR/merge vì CI, quyền, approval hoặc GitHub settings, giữ task branch an toàn và báo chính xác bước còn lại.

Báo cáo trạng thái Git/PR/CI cuối cùng và phân biệt rõ repository finalization với production deployment.
```

## Release / Build + Push Docker

> Tôi khuyên **đổi tên prompt cũ** từ `Build + push Docker` thành `Release / Build + Push Docker`, vì normal production image bây giờ phải thuộc CI/CD.

```text
Tuân thủ docs\agent\AGENTS.md và production release workflow hiện tại.

Kiểm tra Git revision, Docker/Compose configuration, GitHub Actions và trạng thái release hiện tại.

Nếu CI/CD đã là canonical production release mechanism, không build/push production image thủ công từ local và không thay thế CI/CD bằng ad-hoc Docker commands.

Thay vào đó:
- xác định release/CI workflow tương ứng với revision cần phát hành;
- kiểm tra immutable Docker tag phải derive từ Git commit SHA theo convention hiện tại;
- kiểm tra API/Web production artifacts phải thuộc cùng release;
- sử dụng canonical CI/CD workflow để build và push production images khi tooling/quyền hiện tại cho phép;
- xác minh kết quả build/push từ workflow.

Không sử dụng `latest` làm production release identity.
Không sửa production image tag thủ công.
Không deploy/restart production trừ khi tôi yêu cầu deployment rõ ràng.
Không bypass PR, CI, production approval hoặc repository protection.

Nếu canonical CI/CD chưa thể được trigger/thực hiện từ môi trường hiện tại, không tự chuyển sang manual production build; báo rõ bước thủ công cần thực hiện.

Báo cáo revision, immutable image tags/artifacts, workflow status và những bước còn lại.
```

## Deploy Production

Tôi khuyên **thêm prompt này** vì sau khi có CI/CD, `build release` và `deploy production` là hai việc khác nhau.

```text
Tuân thủ docs\agent\AGENTS.md và canonical production deployment workflow hiện tại.

Kiểm tra release hiện tại, CI/CD status, immutable image references, production deployment configuration và các prerequisite trước khi thực hiện.

Chỉ deploy production artifact đã được build/push bởi canonical CI/CD workflow và xác định chính xác bằng immutable release identity.

Tuân thủ đầy đủ production safety flow hiện tại, bao gồm:
- production approval nếu được cấu hình;
- concurrency protection;
- backup;
- backup verification;
- migration;
- deploy đúng immutable release;
- health/readiness verification;
- rollback application release khi cần.

Không rebuild production image trên VPS.
Không sử dụng `latest` làm release identity.
Không tự restore database/media khi application deployment fail.
Không bypass backup gate, approval hoặc required protection.
Không thực hiện ad-hoc deployment nếu canonical CD workflow đang chịu trách nhiệm deployment.

Sau khi hoàn thành, báo cáo release đã deploy, backup ID, migration/deployment result, health status và rollback state nếu có.
```

## Task riêng

Prompt này vốn đã tốt. Tôi chỉ thêm finalization để hành vi nhất quán:

```text
Tuân thủ docs\agent\AGENTS.md. Tôi có các yêu cầu sau:

<MÔ TẢ YÊU CẦU>

Trước khi sửa, kiểm tra branch, git status, implementation/dependency và tài liệu liên quan để xác định trạng thái thực tế.

Chỉ thực hiện đúng phạm vi yêu cầu, không tự mở rộng sang task khác.

Hoàn thiện implementation, tests, canonical docs và validation cần thiết theo AGENTS.md.

Nếu yêu cầu này bao gồm Git/Remote Finalization, thực hiện theo canonical Pull Request workflow trong AGENTS.md; không merge/push trực tiếp vào `main` và không bypass repository protection.
```

## Create Task

Phần này tôi sẽ sửa một điểm quan trọng: **Create Task chỉ tạo kế hoạch**, không nên vô tình implementation thêm 4–6 task vừa tạo.

```text
Tuân thủ docs\agent\AGENTS.md. Tôi có các yêu cầu sau:

Trước tiên đọc `docs/agent/tasks/task.md` và kiểm tra trạng thái thực tế của task plan hiện tại.

Nếu vẫn còn task chưa hoàn thành và không Deferred:
- không tạo task plan mới;
- không xoá task plan hiện tại;
- báo rõ task nào còn phải hoàn thành.

Chỉ khi toàn bộ task hiện tại đã hoàn thành hoặc Deferred hợp lệ, thực hiện các bước sau:

1. Viết 8 idea mới phù hợp với trạng thái hiện tại của dự án vào `docs/agent/tasks/idea.md`, thay thế nội dung idea cũ.

2. Mỗi idea:
- mô tả chức năng/mục tiêu rõ ràng;
- phù hợp architecture và product scope hiện tại;
- ưu tiên giá trị thực tế, khả thi và tránh over-engineering;
- xem xét implementation/dependency hiện có để tránh đề xuất chức năng đã tồn tại;
- không quá 45 dòng.

3. Đánh giá 8 idea và chọn 4 idea tốt nhất dựa trên:
- giá trị thực tế;
- mức độ phù hợp với dự án;
- feasibility;
- dependency/risk;
- chi phí vận hành;
- tránh duplicate chức năng hiện có.

4. Từ 4 idea được chọn, xây dựng khoảng 4–6 task implementation chi tiết trong `docs/agent/tasks/task.md`, thay thế task plan cũ đã hoàn thành.

5. Mỗi task:
- không quá 80 dòng;
- có mục tiêu và phạm vi rõ ràng;
- có checklist theo dõi trạng thái;
- nêu dependency quan trọng;
- có acceptance/validation criteria đủ để Agent biết khi nào task hoàn thành;
- được sắp xếp theo dependency order hợp lý;
- không đánh dấu hoàn thành trước khi implementation thực sự tồn tại và được validation.

Không implementation các task mới vừa tạo trong cùng lượt này.
Không chuyển sang task đầu tiên sau khi hoàn thành việc lập kế hoạch.

Sau khi cập nhật idea/task plan, thực hiện documentation validation phù hợp theo AGENTS.md.

Nếu yêu cầu bao gồm Git/Remote Finalization, commit trên task branch, push task branch và tạo/cập nhật Pull Request vào `main` theo AGENTS.md; không merge/push trực tiếp vào `main` và không bypass repository protection.

Báo cáo ngắn gọn 8 idea, 4 idea được chọn, task plan mới và trạng thái Git/PR.
```

## Một thay đổi tôi đặc biệt khuyên giữ

Từ giờ tránh viết trong Quick Prompts:

```text
commit/merge/push
```

vì câu này hơi mơ hồ và Agent có thể hiểu là:

```text
git checkout main
git merge ...
git push origin main
```

Thay vào đó dùng một cụm thống nhất:

```text
thực hiện Git/Remote Finalization theo AGENTS.md
```

hoặc nếu muốn explicit:

```text
commit trên task branch, push task branch và tạo/cập nhật Pull Request vào `main` theo AGENTS.md
```

Như vậy **AGENTS.md là single source of truth cho Git workflow**. Sau này bạn đổi ruleset, merge strategy hay CI/CD thì không phải đi sửa hàng loạt prompt nữa.
