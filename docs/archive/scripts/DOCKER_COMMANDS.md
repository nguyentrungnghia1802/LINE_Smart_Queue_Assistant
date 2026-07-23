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

Production must use `VITE_API_URL=` as empty, not `/api`.

```powershell
docker build --no-cache `
  --build-arg VITE_API_URL= `
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
