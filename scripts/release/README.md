# Automatic release workflow validation

The normal production path is `.github/workflows/deploy.yml`: a successful `CI Quality Gates` run
for the merged `main` revision automatically builds and publishes both images, then waits for the
GitHub `production` environment approval before deploying that exact revision.

`tests/workflows.test.ps1` statically verifies the validated-main trigger, exact source SHA,
immutable deployment tag, approval ordering, and serialized rollout contract. The canonical
Windows emergency/manual publisher and its matching VPS wrapper live together under
`deploy/scripts`; see `deploy/scripts/README.md`.
