# TASK — Migrate Container Registry from Docker Hub to GHCR

## Objective

Migrate the LINE Smart Queue Assistant container publication and deployment flow from Docker Hub to **GitHub Container Registry (GHCR)** while preserving the current release safety model.

The migration is complete only when:

- GitHub Actions publishes API/Web images to `ghcr.io`.
- The VPS can pull the selected GHCR images and deploy them through the existing backup-gated flow.
- Automatic deployment still uses the validated `main` SHA and immutable image tags.
- Manual/emergency publication also targets GHCR.
- Existing rollback semantics remain valid, including rollback across the Docker Hub → GHCR cutover boundary.
- Release validation/rehearsal scripts pass.
- Docker Hub-specific CI credentials/configuration are removed only after the GHCR cutover is proven.
- Canonical documentation and ADRs describe GHCR as the current registry.

## Execution status (2026-08-27)

**Status:** `BLOCKED_EXTERNAL` — repository implementation and local validation are complete for
the registry migration, but the first protected GHCR publication has not run yet. GitHub currently
has no API/Web GHCR packages to inspect, and the production VPS has not been changed or used for a
GHCR pull. The remaining checks require the protected `production` approval and an operator with
access to the VPS; no credential or runtime secret is recorded here.

### TASK-GHCR-01 audit inventory

| Classification                     | Current occurrences and decision                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automatic production CD            | `.github/workflows/deploy.yml`; migrated to lowercase GHCR refs, job-scoped `packages: write`, and `GITHUB_TOKEN`.                                                                                                                                                                                                      |
| Manual/emergency publication       | `deploy/scripts/build-push.ps1`, its PowerShell test, and `deploy/scripts/README.md`; migrated to GHCR-only immutable 12-character tags.                                                                                                                                                                                |
| VPS deployment/rollback tooling    | `deploy/scripts`, `deploy/backup`, and `deploy/docker-compose.yml`; Compose remains registry-agnostic, while transition aliases explicitly retain old Docker Hub refs for rollback.                                                                                                                                     |
| Release verification/rehearsal     | `scripts/release/tests`, `deploy/scripts/tests`, and `deploy/backup/tests`; GHCR-qualified refs and cross-registry rollback are covered by the updated fixtures.                                                                                                                                                        |
| Environment examples/configuration | `deploy/.env.example` now names the canonical public GHCR packages. The populated local/server `.env` files are ignored and were not modified or committed.                                                                                                                                                             |
| Canonical documentation            | Project docs, readiness checklist, guides, script READMEs, root README, and ADR-044 now describe GHCR as current truth and Docker Hub only as transition/history.                                                                                                                                                       |
| Historical/archive material        | `docs/archive/**`, prior ADR text, and the migration plan's Docker Hub references remain unchanged where they document historical commands or rollback context. Official upstream base/service images (`node`, `nginx`, `postgres`, `redis`) remain out-of-scope runtime dependencies, not release publication targets. |

No code-level task is intentionally skipped. External package creation/visibility, VPS pull and
migration evidence, protected workflow approval, and post-migration Docker Hub credential cleanup are
blocked until the corresponding owner-controlled release actions are performed safely.

## Required constraints

Before making changes, read and follow `docs/agent/AGENTS.md` and the canonical project documentation.

Do **not** weaken or redesign these existing invariants:

- `PostgreSQL` and production media backup must complete and verify before deployment mutation.
- Production CD starts only from a successful same-repository `CI Quality Gates` run on `main`.
- The release job remains protected by the GitHub `production` environment approval boundary.
- Automatic deployment uses the exact validated Git SHA.
- Automatic CD uses immutable `git-<full SHA>` tags for deployment.
- `latest` remains discovery-only and must never become a deployment or rollback source.
- Manual publication keeps the existing Git-derived immutable tag behavior; no operator-defined mutable tag.
- `deploy-safe.sh` remains the authority for backup-gated deployment.
- `LINE_QUEUE_API_IMAGE` and `LINE_QUEUE_WEB_IMAGE` remain exact persisted image references.
- Application rollback restores exact image references from verified snapshot metadata.
- Database/media restore remains separate and must never become automatic.
- Server-owned `deploy/.env` remains authoritative; the workflow must not regenerate or overwrite runtime secrets.
- Do not log registry credentials, PATs, SSH secrets, LINE credentials, or runtime secrets.

Relevant canonical references include:

- `docs/project/07_DEVELOPMENT_AND_TESTING.md`
- `docs/project/08_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/project/09_ROADMAP_AND_DECISIONS.md`
- `docs/project/10_IMPLEMENTATION_MAP.md`
- `.github/workflows/deploy.yml`
- `deploy/docker-compose.yml`
- `deploy/scripts/`
- `deploy/backup/`
- `scripts/release/`

---

## TASK-GHCR-01 — Audit every Docker Hub dependency before changing behavior

### Goal

Produce a complete inventory of code, workflows, scripts, tests, configuration, and documentation that currently assumes Docker Hub.

### Work

Search the repository for at least:

- `Docker Hub`
- `docker.io`
- `DOCKERHUB_`
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `trungnghia2703/line-smart-queue-api`
- `trungnghia2703/line-smart-queue-web`
- `LINE_QUEUE_API_REPOSITORY`
- `LINE_QUEUE_WEB_REPOSITORY`
- `LINE_QUEUE_API_IMAGE`
- `LINE_QUEUE_WEB_IMAGE`
- `docker login`
- `docker push`
- `docker pull`

Classify each result as one of:

1. automatic production CD;
2. manual/emergency publication;
3. VPS deployment/rollback tooling;
4. release verification/rehearsal;
5. environment examples/configuration;
6. canonical documentation;
7. historical/archive material that should not be rewritten as current truth.

Inspect actual repository code rather than assuming the canonical docs list every occurrence.

### Acceptance criteria

- No active Docker Hub dependency is missed.
- Historical files are not accidentally treated as current runtime configuration.
- Any registry-specific parser/regex/validation is explicitly identified before implementation begins.

---

## TASK-GHCR-02 — Define the GHCR naming, visibility, and access model

### Goal

Establish one deterministic target namespace and access policy before editing the workflow.

### Work

Define the two canonical image repositories:

- `ghcr.io/<github-owner>/line-smart-queue-api`
- `ghcr.io/<github-owner>/line-smart-queue-web`

Requirements:

- Use a lowercase GHCR namespace/image path.
- Preserve current tag semantics:
  - automatic: `git-<full 40-character SHA>`;
  - automatic discovery tag: `latest`;
  - manual/emergency: preserve the current Git-derived short immutable tag contract unless repository implementation/docs prove otherwise.
- Keep API and Web as separate images.
- Preserve OCI revision/release metadata containing the full source SHA.

Choose package visibility explicitly.

### Option A — Public GHCR packages

- VPS may pull anonymously.
- Do not create a server registry token only for convention.
- Verify anonymous `docker pull` from the VPS before cutover.

### Option B — Private GHCR packages

- GitHub Actions publishes with repository `GITHUB_TOKEN`.
- VPS uses a dedicated GitHub credential with only the minimum package-read capability required by GHCR.
- Current GitHub documentation requires a Personal Access Token (classic) with `read:packages` for external CLI/private-package pull.
- Store the credential only in Docker's credential context for the deployment user; never commit it and never place it in `deploy/.env`.
- Verify the account/token can read the two packages and cannot publish/delete packages.

For either option:

- Ensure the GHCR packages are linked to the correct GitHub repository.
- Ensure the repository has appropriate Actions access to the packages.
- Prefer/retain the OCI source label (`org.opencontainers.image.source`) so source/package linkage remains clear, especially for manual publication.

### Acceptance criteria

- Exact GHCR repository names are agreed and documented.
- Public/private behavior is explicit.
- There is no ambiguous dependency on a developer's broad personal credential.
- Package ownership/access is verified before production cutover.

---

## TASK-GHCR-03 — Migrate automatic GitHub Actions publication to GHCR

### Goal

Make `.github/workflows/deploy.yml` publish API and Web images to GHCR without Docker Hub credentials.

### Work

Update the protected production release job to:

- grant only required `GITHUB_TOKEN` permissions, including:
  - `contents: read`;
  - `packages: write`.
- authenticate `docker/login-action` against `ghcr.io`;
- use `${{ github.actor }}` as the workflow login identity;
- use `${{ secrets.GITHUB_TOKEN }}` as the registry credential;
- stop requiring `DOCKERHUB_USERNAME`;
- stop requiring `DOCKERHUB_TOKEN`;
- derive the GHCR namespace from an explicit, deterministic source rather than accepting arbitrary browser/operator input;
- build both existing `runner` targets exactly as before;
- publish:
  - `ghcr.io/<owner>/line-smart-queue-api:git-<full SHA>`;
  - `ghcr.io/<owner>/line-smart-queue-web:git-<full SHA>`;
  - matching `latest` tags for discovery only;
- preserve all current OCI revision/release labels;
- preserve the existing `LINE_LOGIN_LIFF_ID` Web build argument;
- preserve the production approval boundary before registry publication and VPS access;
- preserve release serialization/non-canceling concurrency behavior;
- continue checking out `workflow_run.head_sha`, not the moving branch head.

Review workflow validation that currently requires Docker Hub environment values and replace those requirements with GHCR-compatible checks.

Do not introduce a long-lived GHCR write PAT into GitHub Actions when `GITHUB_TOKEN` can publish the packages associated with this repository.

### Acceptance criteria

- Automatic workflow contains no Docker Hub login/push step.
- No `DOCKERHUB_*` secret/variable is required by the release job.
- `packages: write` is explicit and scoped to the protected job.
- A test/dry-run inspection proves the generated image refs are GHCR refs with the exact validated SHA.
- `latest` is never passed to `deploy-safe.sh`.

---

## TASK-GHCR-04 — Make release repository validation correctly support GHCR

### Goal

Ensure all deployment/release scripts accept valid GHCR repository references without weakening immutable-reference validation.

### Work

Audit parsers and guards in:

- `deploy/scripts/`
- `deploy/backup/`
- `scripts/release/`
- any shell/PowerShell helpers used by release verification.

Update any Docker Hub-specific assumptions such as:

- repository names limited to `namespace/name`;
- implicit `docker.io`;
- regexes that reject a registry hostname containing `.` or multiple path components;
- code that prepends Docker Hub namespace automatically;
- error messages that mention Docker Hub as the only supported registry.

The valid untagged repository form must support:

- `ghcr.io/<owner>/line-smart-queue-api`
- `ghcr.io/<owner>/line-smart-queue-web`

Continue rejecting:

- missing repository;
- repository containing a mutable tag where an untagged repository is required;
- malformed image/repository references;
- unexpected whitespace/newline injection;
- mixed API/Web release identities;
- operator-supplied arbitrary deployment tags;
- `latest` as a deployment/rollback selection.

Do not weaken existing safe `.env` parsing. Release tooling must continue reading only the expected unique keys without sourcing arbitrary server shell content.

### Acceptance criteria

- GHCR refs pass all repository validators.
- Existing invalid/mutable cases still fail closed.
- Tests explicitly cover a registry-qualified repository such as `ghcr.io/...`.
- No general-purpose `eval`/`source` behavior is introduced.

---

## TASK-GHCR-05 — Update manual/emergency image publication

### Goal

Keep the emergency/manual release path functional after Docker Hub is removed from the active publication flow.

### Work

Update `deploy/scripts/build-push.ps1` and related README/rehearsal logic so that it:

- targets the canonical GHCR API/Web repositories;
- requires an authenticated GHCR CLI session when publishing;
- derives the tag from checked-out clean `HEAD` exactly as before;
- does not accept an operator-defined deployment tag;
- builds the same API/Web `runner` targets;
- preserves full Git SHA OCI revision metadata;
- pushes only the immutable manual tag;
- does **not** push `latest`;
- prints exact GHCR image references and the existing VPS handoff command only after both pushes succeed.

For manual authentication:

- do not hard-code a PAT into the script;
- do not accept a PAT as a command-line argument that will appear in shell history/process listings;
- document secure `docker login ghcr.io` preparation separately.

### Acceptance criteria

- `npm run release:images:verify` or its underlying tests prove the manual publisher plans GHCR pushes.
- `npm run ops:manual-release:rehearse` still proves immutable tag derivation, full revision metadata, no `latest`, and correct VPS handoff.
- Manual publishing no longer references Docker Hub as the current registry.

---

## TASK-GHCR-06 — Prepare GHCR access on the VPS

### Goal

Prove the production deployment user can pull GHCR images before changing the live repository references.

### Work

Identify the exact Linux user/context that runs Docker Compose during deployment.

If GHCR packages are private:

1. create/use the dedicated package-read credential decided in TASK-GHCR-02;
2. authenticate that deployment user to `ghcr.io` using `docker login --password-stdin`;
3. ensure Docker stores the credential only in that user's expected Docker credential/config context;
4. confirm `docker compose` executed by the deployment tooling uses the same credential context;
5. do not copy the token into the repository, `deploy/.env`, GitHub workflow logs, or backup metadata.

If GHCR packages are public:

- test an unauthenticated pull from the VPS and document that no registry credential is required.

Before cutover, manually verify from the VPS:

- API immutable GHCR image can be pulled;
- Web immutable GHCR image can be pulled;
- image architecture matches the VPS;
- image labels/revision identify the expected commit;
- images can be inspected without exposing credentials.

### Acceptance criteria

- The VPS can pull both exact immutable GHCR images.
- Authentication behavior matches the chosen visibility model.
- No runtime application secret changes are required.

---

## TASK-GHCR-07 — Change server repository configuration without bypassing the backup gate

### Goal

Move future deployments to GHCR while keeping exact image refs and rollback metadata authoritative.

### Work

Update the server's untagged repository keys at the controlled cutover point:

- `LINE_QUEUE_API_REPOSITORY=ghcr.io/<owner>/line-smart-queue-api`
- `LINE_QUEUE_WEB_REPOSITORY=ghcr.io/<owner>/line-smart-queue-web`

Do not manually invent or pre-write new `LINE_QUEUE_API_IMAGE` / `LINE_QUEUE_WEB_IMAGE` refs around the safe deploy process.

Update `deploy/.env.example` to use GHCR examples.

Verify `deploy/docker-compose.yml` remains registry-agnostic and still requires exact prebuilt image refs.

Confirm the safe deployment flow still:

1. validates current server configuration;
2. creates and verifies the PostgreSQL/media snapshot;
3. records previous exact API/Web image refs;
4. atomically persists the selected new refs;
5. pulls images;
6. runs canonical migrations;
7. recreates API/worker/Web;
8. checks health/readiness;
9. automatically performs application-only rollback on a post-mutation failure.

### Acceptance criteria

- New release refs resolve to `ghcr.io/...`.
- Compose still consumes only exact `LINE_QUEUE_*_IMAGE` values.
- No fallback to `latest` is introduced.
- Backup and rollback metadata contain complete registry-qualified image refs.

---

## TASK-GHCR-08 — Preserve rollback across the Docker Hub → GHCR transition

### Goal

Guarantee that the first GHCR deployment can still roll back to the immediately previous Docker Hub release.

### Work

Treat the first GHCR release as a cross-registry migration.

Before cutover:

- retain the currently deployed Docker Hub image refs;
- retain the ability to pull those Docker Hub images if they are private;
- do not delete Docker Hub repositories/images/tokens from the VPS yet;
- create the normal verified pre-deployment snapshot.

Test/rehearse that snapshot metadata may contain:

- old API ref from Docker Hub;
- old Web ref from Docker Hub;

while the new selected refs point to GHCR.

Ensure rollback does not assume old and new refs share the same registry hostname.

If the rollback implementation performs `docker pull` for old refs, verify Docker Hub access remains functional during this transition window.

After at least one successful GHCR deployment and one verified rollback rehearsal:

- keep old Docker Hub images long enough to satisfy the chosen rollback window;
- only then remove obsolete Docker Hub server authentication if it is no longer needed.

### Acceptance criteria

- A failed first GHCR deployment can restore the exact previous Docker Hub API/Web refs.
- Rollback uses snapshot refs, not repository defaults and not `latest`.
- Cross-registry refs are covered by automated rehearsal where practical.

---

## TASK-GHCR-09 — Update release verification and failure-injection tests

### Goal

Make the test suite prove the new registry behavior rather than merely making the workflow syntax pass.

### Work

Update/add tests for:

### Automatic workflow contract

`npm run release:workflows:verify` should prove at minimum:

- CD still starts only from successful same-repository `main` CI;
- exact `workflow_run.head_sha` is checked out;
- protected production approval precedes image publication and VPS access;
- `GITHUB_TOKEN` package write permission is explicitly configured;
- registry login targets `ghcr.io`;
- Docker Hub credentials are not required;
- both images publish immutable full-SHA GHCR tags;
- only immutable tag is passed to remote deployment;
- releases remain serialized.

### Manual publisher contract

`npm run release:images:verify` should prove:

- GHCR repository names are used;
- two runner images are built;
- immutable Git-derived tags are pushed;
- full revision metadata is retained;
- `latest` is absent from manual publication;
- malformed/mutable repository values still fail.

### Manual release rehearsal

`npm run ops:manual-release:rehearse` should continue proving:

- generated tag accepted by `deploy.sh`;
- mixed tooling versions fail;
- server `.env` is parsed without sourcing;
- ambient image variables cannot override server configuration;
- GHCR-qualified repository values survive the full dry-run path.

### Backup/rollback rehearsal

`npm run ops:backup:rehearse` should prove:

- exact registry-qualified refs are stored in backup metadata;
- a GHCR deployment persists both refs atomically;
- forced post-mutation failure restores old refs;
- cross-registry Docker Hub → GHCR rollback works or is represented by an equivalent deterministic fixture;
- corrupt/incomplete backup still blocks deployment.

### Acceptance criteria

These commands pass after the migration:

```bash
npm run release:images:verify
npm run release:workflows:verify
npm run ops:manual-release:rehearse
npm run ops:backup:rehearse
```

No assertion is simply deleted to make the suite green; assertions must be updated to the new GHCR contract.

---

## TASK-GHCR-10 — Update GitHub repository/environment configuration

### Goal

Remove Docker Hub-specific GitHub configuration only after the GHCR workflow is proven.

### Work

For the `production` environment:

- retain:
  - required reviewer;
  - `main` deployment policy;
  - `LINE_LOGIN_LIFF_ID`;
  - `PRODUCTION_DEPLOY_PATH`;
  - all `PRODUCTION_SSH_*` secrets;
  - pinned SSH known-hosts configuration.
- remove from workflow requirements:
  - `DOCKERHUB_USERNAME`;
  - `DOCKERHUB_TOKEN`.

After successful GHCR publication/deployment:

- delete obsolete `DOCKERHUB_USERNAME` environment variable if no other workflow uses it;
- delete obsolete `DOCKERHUB_TOKEN` environment secret if no other workflow uses it.

Verify repository/package settings allow the workflow repository to publish/manage the two GHCR packages.

Do not grant broader repository or organization privileges merely to fix a package permission error.

### Acceptance criteria

- Production CD succeeds without Docker Hub GitHub secrets.
- Required environment approval remains intact.
- GHCR package permissions are minimal and documented.

---

## TASK-GHCR-11 — Perform a controlled production cutover

### Goal

Execute one real end-to-end GHCR release and retain evidence that the deployment safety guarantees still work.

### Work

Before release:

- complete TASK-GHCR-01 through TASK-GHCR-10;
- confirm both GHCR packages contain the target immutable SHA images;
- confirm VPS pull access;
- confirm current Docker Hub rollback images remain available;
- confirm server backup storage has sufficient capacity.

Run the normal production flow:

1. merge through the repository's approved `main` process;
2. wait for `CI Quality Gates` to pass on the resulting `main` SHA;
3. approve the protected production deployment;
4. confirm API/Web images publish to GHCR;
5. confirm safe deploy creates and verifies the snapshot;
6. confirm VPS pulls GHCR images;
7. confirm migrations complete;
8. confirm API, worker, and Web recreate successfully;
9. confirm API health/readiness and Web health;
10. confirm local media mount remains intact and writable when local media is active;
11. verify the running containers use exact GHCR refs for the intended SHA.

Capture safe evidence:

- Git SHA;
- GHCR API/Web refs;
- image digests;
- backup ID;
- workflow run ID;
- health/readiness result;
- deployment timestamp.

Do not record credentials or runtime secrets in the evidence.

### Acceptance criteria

- Running API/Web use GHCR images for the validated release SHA.
- Production health checks pass.
- Persistent PostgreSQL/media data remain intact.
- Exact image refs are persisted in `deploy/.env`.
- Verified snapshot metadata can identify the previous release.

---

## TASK-GHCR-12 — Remove obsolete Docker Hub dependencies after cutover validation

### Goal

Finish the migration cleanly without deleting rollback capability too early.

### Work

After the GHCR release is stable and rollback evidence is satisfactory:

- remove active Docker Hub login/push logic from scripts/workflows;
- remove obsolete Docker Hub CI variables/secrets;
- remove obsolete Docker Hub examples/default repository values;
- remove Docker Hub authentication from the VPS only after the cross-registry rollback window no longer requires it;
- keep historical docs/archive unchanged where they intentionally describe historical state;
- decide whether to archive/delete old Docker Hub repositories only after confirming they are no longer referenced by:
  - live `deploy/.env`;
  - verified rollback snapshots still inside the retention window;
  - manual recovery instructions.

Run a final repository search for:

- `DOCKERHUB_`
- `Docker Hub`
- `docker.io`
- old Docker Hub repository names

Every remaining occurrence must be either:

- intentional historical context;
- explicit migration/rollback documentation;
- or removed.

### Acceptance criteria

- No active production path depends on Docker Hub.
- No current documentation tells operators to configure Docker Hub for new releases.
- Old rollback artifacts are not deleted prematurely.

---

## TASK-GHCR-13 — Update canonical documentation and decision records

### Goal

Remove documentation drift and record the registry migration as an explicit architectural/release decision.

### Work

Update at least:

### `docs/project/07_DEVELOPMENT_AND_TESTING.md`

- GHCR publication/rehearsal behavior.
- Manual publisher prerequisites.
- Current release validation expectations.

### `docs/project/08_DEPLOYMENT_AND_OPERATIONS.md`

Replace current Docker Hub-specific sections with:

- GHCR image names;
- automatic `GITHUB_TOKEN` publication;
- GHCR package visibility/access model;
- VPS pull authentication instructions when packages are private;
- production environment variables/secrets after Docker Hub removal;
- emergency/manual GHCR publication;
- Docker Hub → GHCR transition/rollback notes.

### `docs/project/09_ROADMAP_AND_DECISIONS.md`

Do not silently rewrite an accepted Docker Hub-specific ADR.

- Inspect the current highest ADR number in the repository.
- Add the next valid ADR, or formally supersede/amend the existing release ADR according to `AGENTS.md`/project ADR policy.
- Record:
  - why GHCR is selected;
  - automatic publication uses `GITHUB_TOKEN`;
  - VPS pull access model;
  - immutable Git-derived release identity is unchanged;
  - `latest` stays discovery-only;
  - backup/rollback semantics remain registry-independent;
  - transition preserves old Docker Hub refs during the rollback window.

### `docs/project/10_IMPLEMENTATION_MAP.md`

Update registry-sensitive source paths/configuration and validation commands.

### Other documentation

Review and update as applicable:

- `deploy/.env.example`
- `deploy/scripts/README.md`
- production readiness checklist
- root README if it describes Docker Hub as current runtime truth.

### Acceptance criteria

- Canonical docs describe the implemented GHCR flow exactly.
- Accepted historical decisions are superseded/amended explicitly rather than silently contradicted.
- Docker Hub is described only as historical/transition state after cutover.

---

## TASK-GHCR-14 — Run final validation and regression gates

### Goal

Prove the registry migration did not accidentally break application build, deployment tooling, or container runtime behavior.

### Required registry/release checks

```bash
npm run release:images:verify
npm run release:workflows:verify
npm run ops:manual-release:rehearse
npm run ops:backup:rehearse
```

### Run project-required checks affected by the change

Follow `docs/agent/AGENTS.md` for the authoritative validation set. At minimum, run all checks required for changes to workflows, deployment scripts, Compose, documentation, and production image builds.

Where applicable this may include:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run spell:check
npm run media:persistence:verify
```

Also validate GitHub workflow YAML and production Compose configuration through the repository's existing CI gates.

### Manual verification

- Inspect generated image names/tags.
- Inspect OCI labels.
- Confirm no secret appears in logs.
- Confirm `latest` cannot be selected by normal deployment.
- Confirm GHCR-qualified refs survive backup metadata and rollback parsing.
- Confirm local media persistence behavior is unchanged.
- Confirm worker uses the same API image ref as expected by production Compose.

### Acceptance criteria

- All required repository gates pass.
- No tests are skipped/disabled solely because of the registry migration.
- No production safety assertion is weakened.

---

## TASK-GHCR-15 — Completion / definition of done

The migration is **DONE** only when all of the following are true:

- [x] Active automatic publication is GHCR-only.
- [ ] API and Web packages exist under the intended GHCR namespace.
- [x] Automatic workflow publishes `git-<full SHA>` images.
- [x] Automatic workflow may publish `latest`, but deploy/rollback never consume it.
- [x] GitHub Actions uses `GITHUB_TOKEN` rather than a Docker Hub write token.
- [ ] VPS can pull GHCR images under the chosen public/private access model.
- [ ] Server repository keys point to `ghcr.io/...`.
- [x] Safe deploy persists exact GHCR image refs.
- [ ] First GHCR deployment passes backup, migration, recreate, and health gates.
- [x] Rollback to the previous exact release is verified by the isolated rehearsal.
- [x] Cross-registry rollback from GHCR to the immediately previous Docker Hub release is covered during transition by the isolated fixture.
- [x] Manual/emergency publisher targets GHCR and preserves immutable Git-derived identity.
- [x] `release:images:verify` passes.
- [x] `release:workflows:verify` passes.
- [x] `ops:manual-release:rehearse` passes.
- [x] `ops:backup:rehearse` passes.
- [x] Canonical docs and ADRs describe GHCR as current truth.
- [ ] `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are removed from active GitHub configuration after proven cutover.
- [ ] Obsolete Docker Hub access on VPS is removed only after the rollback window permits it.
- [x] No runtime secret or registry credential was committed to the repository or emitted by the updated tooling.
- [x] Final repository search finds no unintended active Docker Hub dependency.
- [x] Final commit/integration follows `docs/agent/AGENTS.md` and the repository's protected-`main` policy.

## Non-goals

This task must **not** be expanded into unrelated deployment redesign.

Do not:

- migrate away from the current VPS architecture;
- replace Docker Compose;
- replace the backup/restore architecture;
- change PostgreSQL/media persistence;
- change application runtime behavior;
- change LINE/payment/provider configuration;
- convert `latest` into a deployment tag;
- introduce Kubernetes;
- introduce a second registry abstraction unless existing code requires one;
- add image signing/attestation/SBOM as a blocker unless `AGENTS.md` or current repository requirements already require them.

Those may be separate future tasks.
