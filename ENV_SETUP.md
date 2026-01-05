# Environment Variables Setup

## Required Environment Variable

The application requires the following environment variable:

```env
NEXT_PUBLIC_API_URL=http://api.inventory.chairbordsolar.com/api
```

## Local Development

1. Create a `.env` file in the project root:
   ```env
   NEXT_PUBLIC_API_URL=http://api.inventory.chairbordsolar.com/api
   ```

2. The `.env` file is already in `.gitignore`, so it won't be committed to the repository.

3. Restart your development server after creating/updating the `.env` file:
   ```bash
   npm run dev
   ```

## Docker Setup

### Using Docker Compose

The `docker-compose.yml` file is pre-configured with the default API URL. It will:
- Use the value from your `.env` file if it exists
- Fall back to `http://api.inventory.chairbordsolar.com/api` if not set

```bash
# Create .env file (optional, uses default if not present)
echo "NEXT_PUBLIC_API_URL=http://api.inventory.chairbordsolar.com/api" > .env

# Build and run
docker-compose up -d
```

### Using Docker directly

```bash
# Build with API URL
docker build --build-arg NEXT_PUBLIC_API_URL=http://api.inventory.chairbordsolar.com/api -t quotation-app:latest .

# Run
docker run -p 3000:3000 quotation-app:latest
```

## CI/CD (GitHub Actions)

The CI/CD workflow automatically uses the API URL. You can customize it:

1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Add a secret named `NEXT_PUBLIC_API_URL` with your API URL
3. If not set, it defaults to `http://api.inventory.chairbordsolar.com/api`

## Important Notes

- `NEXT_PUBLIC_*` variables are embedded at **build time** in Next.js
- For Docker builds, you must pass them as build arguments (`--build-arg`)
- The variable is available in both server and client-side code
- Changes to environment variables require a rebuild of the Docker image


