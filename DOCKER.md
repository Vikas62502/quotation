# Docker Setup Guide
This project includes Docker configuration for containerized deployment.

## Prerequisites

- Docker installed on your system
- Docker Compose (optional, for easier local development)

## Building the Docker Image

### Using Docker directly:

```bash
# Build the image
docker build -t quotation-app:latest .

# Run the container
docker run -p 3000:3000 quotation-app:latest
```

### Using Docker Compose:

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

## Environment Variables

The application uses the following environment variable:

- `NEXT_PUBLIC_API_URL`: API endpoint URL (default: `http://api.inventory.chairbordsolar.com/api`)

### Using with Docker Compose

The `docker-compose.yml` file is pre-configured with the API URL. You can override it by:

1. Creating a `.env` file in the project root:
   ```env
   NEXT_PUBLIC_API_URL=http://api.inventory.chairbordsolar.com/api
   ```

2. Or pass it directly when running:
   ```bash
   NEXT_PUBLIC_API_URL=http://api.inventory.chairbordsolar.com/api docker-compose up
   ```

### Using with Docker directly

```bash
# Build with custom API URL
docker build --build-arg NEXT_PUBLIC_API_URL=http://api.inventory.chairbordsolar.com/api -t quotation-app:latest .

# Run with environment variable
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://api.inventory.chairbordsolar.com/api quotation-app:latest
```

**Note:** `NEXT_PUBLIC_*` variables are embedded at build time in Next.js, so they must be passed as build arguments when building the image.

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) automatically:

1. **Lints and tests** the code on every push to main
2. **Builds the Docker image** and pushes it to GitHub Container Registry
3. **Deploys** the application (configure deployment steps as needed)

### Setting up Docker Hub

The workflow automatically pushes images to Docker Hub. To use the image:

```bash
# Pull the image
docker pull vikasyadav30/cbpl-solar-quotation:latest

# Run the image
docker run -p 3000:3000 vikasyadav30/cbpl-solar-quotation:latest
```

**Important:** You need to add the following secrets to your GitHub repository:
- `DOCKER_USERNAME`: Your Docker Hub username (vikasyadav30)
- `DOCKER_PASSWORD`: Your Docker Hub access token or password

To add secrets:
1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add `DOCKER_USERNAME` and `DOCKER_PASSWORD`

### Customizing Deployment

Edit `.github/workflows/ci-cd.yml` and uncomment/configure the deployment section based on your hosting provider (Vercel, AWS, Azure, etc.).

### Environment Variables in CI/CD

The workflow uses the API URL from GitHub secrets. To customize it:

1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Add a secret named `NEXT_PUBLIC_API_URL` with your API URL
3. If not set, it defaults to `http://api.inventory.chairbordsolar.com/api`

## Troubleshooting

- **Build fails**: Make sure `next.config.mjs` has `output: 'standalone'` enabled
- **Port conflicts**: Change the port mapping in `docker-compose.yml` or use `-p 3001:3000` when running docker
- **Environment variables**: Ensure production environment variables are set correctly

