# Cac lenh Docker chinh cho du an

Chay lenh build local tu thu muc goc repository. Chay lenh tren server tai
`/opt/line-smart-queue`, noi dang chua `docker-compose.yml` va `.env`.

## 1. Lenh dung thuong xuyen nhat

### Build va push API tu local

```powershell
docker build --no-cache `
  -t trungnghia2703/line-smart-queue-api:latest `
  -f .\docker\api\Dockerfile .

docker push trungnghia2703/line-smart-queue-api:latest
```

### Build va push Web tu local

Image production dung chung cho moi organization. QR cua tung organization tu
tao route `/liff/qr/<publicQrToken>`, vi vay khong duoc dong cung token demo vao
image Web. `Dockerfile` da co cac mac dinh production an toan: API cung origin,
LIFF endpoint `/liff`, LIFF mock tat va payment demo. Lenh build thong thuong chi
can truyen LIFF ID cong khai:

```powershell
docker build --no-cache `
  --build-arg "VITE_LIFF_ID=YOUR_LINE_LOGIN_LIFF_ID" `
  -t trungnghia2703/line-smart-queue-web:latest `
  -f .\docker\web\Dockerfile .

docker push trungnghia2703/line-smart-queue-web:latest
```

### Tren server: pull va deploy lai API + Web

```bash
cd /opt/line-smart-queue
docker compose pull api web
docker compose run --rm api npm run db:migrate
docker compose up -d --force-recreate api web
docker compose ps
```

### Tren server: pull va deploy lai toan bo stack

Dung khi ban muon keo ca `postgres`, `api`, `web` theo dung file compose hien
tai.

```bash
cd /opt/line-smart-queue
docker compose pull
docker compose run --rm api npm run db:migrate
docker compose up -d --force-recreate
docker compose ps
```

## 2. Cac lenh deploy theo tung truong hop

### Chi cap nhat API

Dung khi chi co thay doi backend hoac migration.

```bash
docker compose pull api
docker compose run --rm api npm run db:migrate
docker compose up -d --force-recreate --no-deps api
docker compose ps api
docker compose logs --tail=100 api
```

### Chi cap nhat Web

Dung khi chi thay doi frontend. Khong can chay migration.

```bash
docker compose pull web
docker compose up -d --force-recreate --no-deps web
docker compose ps web
docker compose logs --tail=100 web
```

### Cap nhat API + Web

```bash
docker compose pull api web
docker compose run --rm api npm run db:migrate
docker compose up -d --force-recreate --no-deps api web
docker compose ps
```

### Chi thay doi file `.env`

`docker compose restart` khong nap lai bien moi truong. Neu sua `.env`, can
recreate service bi anh huong:

```bash
docker compose up -d --force-recreate --no-deps api
docker compose up -d --force-recreate --no-deps web
```

Luu y: neu thay doi bien `VITE_*`, phai build va push lai image Web tu local,
vi Vite da nhung cac gia tri nay vao image trong luc build.

## 3. Kiem tra va van hanh tren server

### Kiem tra trang thai container

```bash
docker compose ps
docker compose top
docker stats --no-stream
```

### Xem log

```bash
docker compose logs --tail=100 api
docker compose logs --tail=100 web
docker compose logs -f --tail=100 api web
```

### Khoi dong lai service

```bash
docker compose restart api
docker compose restart web
```

### Up lai stack

```bash
docker compose up -d
```

### Dung stack

```bash
docker compose down
```

Tuyet doi khong them `--volumes` tren server production, neu ban khong muon xoa
du lieu database va media.

## 4. Kiem tra health

### Kiem tra ben trong container

```bash
docker compose exec -T api wget -qO- http://127.0.0.1:4000/health
docker compose exec -T api wget -qO- http://127.0.0.1:4000/ready
docker compose exec -T web wget -qO- http://127.0.0.1/health
```

### Kiem tra public endpoint

```bash
curl -fsS https://playmcjava21.io.vn/health
curl -I https://playmcjava21.io.vn/
```

## 5. Kiem tra image dang chay

```bash
docker compose images
docker inspect "$(docker compose ps -q api)" --format '{{.Config.Image}} {{.Image}}'
docker inspect "$(docker compose ps -q web)" --format '{{.Config.Image}} {{.Image}}'
```

## 6. Mo hinh image cua production

Production stack hien tai gom:

- `postgres:16-alpine`
- `trungnghia2703/line-smart-queue-api:latest`
- `trungnghia2703/line-smart-queue-web:latest`

Khong co migration image rieng. Migration nam trong API image, nen moi lan
deploy backend can chay:

```bash
docker compose run --rm api npm run db:migrate
```

## 7. Kiem tra nhanh file server hien tai

File `docker-compose.yml` tren server dang dung topology hop ly:

- PostgreSQL va media duoc luu qua volume.
- API khong public port `4000` ra ngoai.
- Chi Web public port `8081`.
- Da co `healthcheck` va `depends_on`.

File `.env` tren server can luu y cac diem sau:

1. `LINE_QUEUE_API_IMAGE` va `LINE_QUEUE_WEB_IMAGE` neu ban chon cach deploy
   bang `latest` thi giu:

```env
LINE_QUEUE_API_IMAGE=trungnghia2703/line-smart-queue-api:latest
LINE_QUEUE_WEB_IMAGE=trungnghia2703/line-smart-queue-web:latest
```

2. `LINE_LIFF_ENDPOINT_PATH=/liff` la dung, nen giu nguyen.
3. `LINE_RICH_MENU_IMAGE_PATH=` de rong la hop le neu chua dong bo rich menu
   image bang script rieng.
4. Nen su dung rieng:

```env
LINE_MESSAGING_CHANNEL_SECRET=...
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=...
LINE_LOGIN_CHANNEL_ID=...
LINE_LOGIN_LIFF_ID=...
```

5. Nen bo bien cu `LINE_CHANNEL_SECRET` neu trong code khong con dung nua, de
   tranh nham voi secret cua LINE Login va Messaging API.
6. Ban da quyet dinh dung `DEMO_PAYMENT_WEBHOOK_SECRET`, vay nen dien mot chuoi
   random rieng, khong dung chung voi `JWT_SECRET`.
7. Neu chua cau hinh SMTP va `EMAIL_TOKEN_ENCRYPTION_KEY`, thi email kich hoat
   tai khoan, moi nhan su va quen mat khau se chua hoat dong.

## 8. Mau quy trinh deploy nhanh de dung hang ngay

### Tai local

```powershell
docker build --no-cache `
  -t trungnghia2703/line-smart-queue-api:latest `
  -f .\docker\api\Dockerfile .

docker push trungnghia2703/line-smart-queue-api:latest

docker build --no-cache `
  --build-arg "VITE_LIFF_ID=YOUR_LINE_LOGIN_LIFF_ID" `
  -t trungnghia2703/line-smart-queue-web:latest `
  -f .\docker\web\Dockerfile .

docker push trungnghia2703/line-smart-queue-web:latest
```

### Tren server

```bash
cd /opt/line-smart-queue
docker compose pull api web
docker compose run --rm api npm run db:migrate
docker compose up -d --force-recreate api web
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 web
```
