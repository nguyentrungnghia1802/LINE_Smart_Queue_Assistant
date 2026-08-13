# Automatic release workflow validation

The normal production path is `.github/workflows/deploy.yml`: a successful `CI Quality Gates` run
for the merged `main` revision waits for GitHub `production` environment approval, then builds,
publishes, and deploys that exact revision in one protected job.

`tests/workflows.test.ps1` statically verifies the validated-main trigger, exact source SHA,
immutable deployment tag, single protected-job approval boundary, and serialized rollout contract.
It also verifies archive integrity and safe normalization of a production path configured as either
the project root or its `deploy` directory. The canonical Windows emergency/manual publisher and its
matching VPS wrapper live together under `deploy/scripts`; see `deploy/scripts/README.md`.
