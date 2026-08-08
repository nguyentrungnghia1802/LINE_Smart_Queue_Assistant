# Local Docker Development

Run these commands from the repository root.

```powershell
# Build and start the local development stack.
docker compose -f docker-compose.dev.yml up -d --build

# Check container status and follow application logs.
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs -f api web

# Rebuild only API and Web after Dockerfile or dependency changes.
docker compose -f docker-compose.dev.yml build --no-cache api web
docker compose -f docker-compose.dev.yml up -d --force-recreate api web

# Stop the stack without deleting database volumes.
docker compose -f docker-compose.dev.yml down
```

Open `http://localhost:5173`. Local customer authentication uses the paired LIFF mock configuration
from the development Compose stack unless real LINE settings are explicitly enabled.
