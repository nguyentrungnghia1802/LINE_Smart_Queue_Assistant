# Docker Build and Server Deployment Commands

Run local build commands from the repository root. Run server commands from
`/opt/line-smart-queue`, where `docker-compose.yml` and `.env` are stored.

## 1. Image and migration model

The production stack has three images:

- `postgres:16-alpine`;
- `trungnghia2703/line-smart-queue-api:<release-tag>`;
- `trungnghia2703/line-smart-queue-web:<release-tag>`.

There is no separate migration image or migration service. Migration files and
`node-pg-migrate` are included in the API image. Run migrations with a temporary
container created from the exact API release being deployed.

Use immutable Git tags in production, for example
`git-5c54ed482de7`. `latest` may also be published for convenience, but the
server `.env` should reference the immutable tag so a pull cannot silently
select a different release.

## 2. Build and push from local PowerShell

Create one release tag from the Git commit being built:

```powershell
$ReleaseTag = "git-$((git rev-parse --short=12 HEAD).Trim())"
$ApiImage = "trungnghia2703/line-smart-queue-api:$ReleaseTag"
$WebImage = "trungnghia2703/line-smart-queue-web:$ReleaseTag"
$LiffId = "YOUR_LINE_LOGIN_LIFF_ID"
```

Build API:

```powershell
docker build --no-cache `
  -t $ApiImage `
  -t trungnghia2703/line-smart-queue-api:latest `
  -f .\docker\api\Dockerfile .
```

Build Web. Production must keep `VITE_API_URL` empty because frontend request
paths already contain `/api/v1` and nginx preserves `/api`:

```powershell
docker build --no-cache `
  --build-arg VITE_API_URL= `
  --build-arg "VITE_APP_NAME=LINE Smart Queue Assistant" `
  --build-arg "VITE_LIFF_ID=$LiffId" `
  --build-arg VITE_LIFF_DEFAULT_BOOKING_PATH=/liff/qr/demo-queue-lab-2026 `
  --build-arg VITE_LIFF_ENDPOINT_PATH=/liff `
  --build-arg VITE_LIFF_MOCK=false `
  --build-arg VITE_PAYMENT_MODE=demo `
  --build-arg VITE_PAYMENT_REDIRECT_BASE_URL= `
  -t $WebImage `
  -t trungnghia2703/line-smart-queue-web:latest `
  -f .\docker\web\Dockerfile .
```

Push the immutable release tags:

```powershell
docker push $ApiImage
docker push $WebImage
```

Optionally update the convenience tags:

```powershell
docker push trungnghia2703/line-smart-queue-api:latest
docker push trungnghia2703/line-smart-queue-web:latest
```

Before deploying, put the exact same immutable tag in the server `.env`:

```env
LINE_QUEUE_API_IMAGE=trungnghia2703/line-smart-queue-api:git-<commit>
LINE_QUEUE_WEB_IMAGE=trungnghia2703/line-smart-queue-web:git-<commit>
```

Confirm what the server will pull:

```bash
docker compose config --images
```

## 3. Full server deployment

Validate Compose and list the resolved images:

```bash
cd /opt/line-smart-queue
docker compose config --quiet
docker compose config --images
```

Pull every image declared by Compose: PostgreSQL, API, and Web:

```bash
docker compose pull
```

Back up PostgreSQL before applying migrations:

```bash
mkdir -p backups
docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "backups/line_queue_$(date +%Y%m%d_%H%M%S).sql"
```

Ensure PostgreSQL is running and healthy:

```bash
docker compose up -d postgres
docker compose ps postgres
```

Apply migrations with the newly selected API image:

```bash
docker compose run --rm api npm run db:migrate
```

Start or recreate API and Web:

```bash
docker compose up -d --force-recreate api web
docker compose ps
```

Do not run seed or reset commands on production.

## 4. Deploy only what changed

### API changed

Pull the API image, run its migrations, then recreate only API:

```bash
docker compose pull api
docker compose run --rm api npm run db:migrate
docker compose up -d --force-recreate --no-deps api
docker compose ps api
docker compose logs --tail=100 api
```

Running the forward migration command on every API release is safe when there
are no new migrations; already-applied migrations are skipped.

### Web changed

Pull and recreate only Web. No database migration is needed:

```bash
docker compose pull web
docker compose up -d --force-recreate --no-deps web
docker compose ps web
docker compose logs --tail=100 web
```

### API and Web changed

```bash
docker compose pull api web
docker compose run --rm api npm run db:migrate
docker compose up -d --force-recreate --no-deps api web
docker compose ps
```

### Only `.env` changed

`docker compose restart` does not reload environment variables. Recreate the
affected service:

```bash
docker compose up -d --force-recreate --no-deps api
```

Rebuild and repush the Web image when a `VITE_*` value changes because Vite
configuration is compiled into the image and cannot be changed by server
`.env`.

### PostgreSQL image changed

Do not upgrade PostgreSQL casually. Back up first, read the PostgreSQL upgrade
notes, and then:

```bash
docker compose pull postgres
docker compose up -d postgres
docker compose ps postgres
docker compose logs --tail=100 postgres
```

## 5. Container operations

Show status:

```bash
docker compose ps
docker compose top
docker stats --no-stream
```

Start all stopped services:

```bash
docker compose up -d
```

Restart a process without changing its image or environment:

```bash
docker compose restart api
docker compose restart web
```

Stop the stack without deleting persistent volumes:

```bash
docker compose down
```

Never add `--volumes` on a production server unless permanent database and
media deletion is explicitly intended and a verified backup exists.

View logs:

```bash
docker compose logs --tail=100 api
docker compose logs --tail=100 web
docker compose logs -f --tail=100 api web
```

Check health from inside the containers:

```bash
docker compose exec -T api wget -qO- http://127.0.0.1:4000/health
docker compose exec -T api wget -qO- http://127.0.0.1:4000/ready
docker compose exec -T web wget -qO- http://127.0.0.1/health
```

Check the public endpoint:

```bash
curl -fsS https://playmcjava21.io.vn/health
curl -I https://playmcjava21.io.vn/
```

Inspect the exact running images:

```bash
docker compose images
docker inspect "$(docker compose ps -q api)" \
  --format '{{.Config.Image}} {{.Image}}'
docker inspect "$(docker compose ps -q web)" \
  --format '{{.Config.Image}} {{.Image}}'
```

## 6. Roll back application images

Set both image variables in `.env` to a previously verified immutable tag:

```env
LINE_QUEUE_API_IMAGE=trungnghia2703/line-smart-queue-api:git-<previous-commit>
LINE_QUEUE_WEB_IMAGE=trungnghia2703/line-smart-queue-web:git-<previous-commit>
```

Then:

```bash
docker compose pull api web
docker compose up -d --force-recreate --no-deps api web
docker compose ps
```

Do not automatically migrate the database down during an application rollback.
Confirm migration compatibility before selecting an older API image.

## 7. Audit of the provided server files

The supplied `docker-compose.yml` has the correct runtime topology:

- PostgreSQL and media use persistent volumes;
- API port `4000` is not published;
- only Web port `8081` is published;
- health checks and dependencies are present.

Fix its opening comment: production Web must be built with
`VITE_API_URL=` (empty), not `/api`. This comment does not alter the existing
container behavior, but it can cause the next Web image to be built incorrectly
as `/api/api/v1/...`.

The supplied `.env` needs these corrections:

1. Replace stale `v1` image references with one exact immutable tag that exists
   in both Docker Hub repositories. The currently published application release
   is `git-5c54ed482de7`.
2. Remove legacy `LINE_CHANNEL_SECRET`. Keep only
   `LINE_MESSAGING_CHANNEL_SECRET` from the same Messaging API channel used for
   webhook verification.
3. Ensure `LINE_ID_TOKEN_VERIFICATION_MODE=line`. The redacted output hides this
   value because its variable name contains `TOKEN`.
4. Reissue the Messaging API token and put it in
   `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`; the previously configured token was
   rejected by LINE with HTTP `401`.
5. Keeping `LINE_LIFF_ENDPOINT_PATH=/liff` and an empty
   `LINE_RICH_MENU_IMAGE_PATH` is valid.
6. Add a dedicated `DEMO_PAYMENT_WEBHOOK_SECRET`; otherwise demo payment falls
   back to another application secret.
7. Account invitation and password-reset email will remain disabled until the
   production `EMAIL_TRANSPORT`, SMTP variables, and
   `EMAIL_TOKEN_ENCRYPTION_KEY` from `deploy/.env.example` are configured.

Recommended image values for the currently published release:

```env
LINE_QUEUE_API_IMAGE=trungnghia2703/line-smart-queue-api:git-5c54ed482de7
LINE_QUEUE_WEB_IMAGE=trungnghia2703/line-smart-queue-web:git-5c54ed482de7
```

After correcting `.env`, use:

```bash
docker compose config --quiet
docker compose config --images
docker compose pull api web
docker compose run --rm api npm run db:migrate
docker compose up -d --force-recreate --no-deps api web
docker compose ps
docker compose logs --tail=100 api
```
