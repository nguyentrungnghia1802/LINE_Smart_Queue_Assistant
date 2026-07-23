# Docker Command Reference

If you build and push both API and Web from local, use these commands.

Run from the repository root.

## 1. Build API

```powershell
docker build --no-cache `
  -t trungnghia2703/line-smart-queue-api:v1 `
  -f .\docker\api\Dockerfile .
```

## 2. Push API

```powershell
docker push trungnghia2703/line-smart-queue-api:v1
```

## 3. Build Web

Production must use `VITE_API_URL=` as empty, not `/api`. Replace
`YOUR_LIFF_ID` with the same public LIFF ID configured as `LINE_LIFF_ID` in the
server's `deploy/.env`. This value is required for the printed QR to open LINE
Login and the LIFF booking flow.

```powershell
docker build --no-cache `
  --build-arg VITE_API_URL= `
  --build-arg VITE_LIFF_ID=YOUR_LIFF_ID `
  --build-arg VITE_ENABLE_LEGACY_CUSTOMER_AUTH=false `
  --build-arg VITE_LIFF_MOCK=false `
  -t trungnghia2703/line-smart-queue-web:v1 `
  -f .\docker\web\Dockerfile .
```

## 4. Push Web

```powershell
docker push trungnghia2703/line-smart-queue-web:v1
```

## 5. On the server

```powershell
docker compose pull
docker compose up -d --force-recreate
```

Or, if you only update the two services:

```powershell
docker compose pull api web
docker compose up -d --force-recreate api web
```
