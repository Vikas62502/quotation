# EC2 Deployment Guide

This guide explains how to configure the CI/CD pipeline to deploy to your EC2 instance.

## Required GitHub Secrets

You need to add the following secrets to your GitHub repository:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add the following:

### Required Secrets

| Secret Name | Description | Your Value |
|------------|-------------|------------|
| `EC2_HOST` | Your EC2 instance domain name | `ec2-43-204-133-228.ap-south-1.compute.amazonaws.com` |
| `EC2_USER` | SSH username for your EC2 instance | `ubuntu` |
| `EC2_SSH_KEY` | Private SSH key for accessing EC2 | Contents of `cbpl-nodeV2.pem` file |
| `DOCKER_USERNAME` | Docker Hub username | `vikasyadav30` |
| `DOCKER_PASSWORD` | Docker Hub password or access token | Your Docker Hub password/token |
| `NEXT_PUBLIC_API_URL` | (Optional) API URL override | `http://api.inventory.chairbordsolar.com/api` |

## Setting Up EC2 Instance

### 1. Install Docker on EC2

SSH into your EC2 instance and install Docker:

```bash
# For Amazon Linux 2
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# For Ubuntu
sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
```

**Important:** Log out and log back in after adding user to docker group.

### 2. Configure Security Group

Ensure your EC2 security group allows:
- **Inbound:** Port 3000 (or your chosen port) from your IP or 0.0.0.0/0
- **Inbound:** Port 22 (SSH) from GitHub Actions IPs (you can use 0.0.0.0/0 for testing, but restrict it later)

**Your EC2 Instance:**
- Host: `ec2-43-204-133-228.ap-south-1.compute.amazonaws.com`
- User: `ubuntu`
- Region: `ap-south-1` (Mumbai)

### 3. Get SSH Key

You already have your SSH key: `cbpl-nodeV2.pem`

**To add it to GitHub Secrets:**
1. Open `C:\Users\vikas\Downloads\cbpl-nodeV2.pem` in a text editor
2. Copy the **entire contents** (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)
3. Paste it as the `EC2_SSH_KEY` secret in GitHub

**Important:** Make sure to copy the entire file content, including the header and footer lines.

## How Deployment Works

When you push to the `main` branch, the workflow will:

1. **Lint and test** your code
2. **Build Docker image** and push to Docker Hub
3. **Deploy to EC2** by:
   - SSH into your EC2 instance
   - Pulling the latest Docker image
   - Stopping the old container
   - Starting the new container with the latest image
   - Cleaning up old Docker images

## Manual Deployment

You can also manually deploy to EC2:

```bash
# SSH into EC2 (from Windows)
ssh -i "C:\Users\vikas\Downloads\cbpl-nodeV2.pem" ubuntu@ec2-43-204-133-228.ap-south-1.compute.amazonaws.com

# Once connected to EC2, run:
# Login to Docker Hub
docker login -u vikasyadav30

# Pull latest image
docker pull vikasyadav30/cbpl-solar-quotation:latest

# Stop old container
docker stop cbpl-solar-quotation
docker rm cbpl-solar-quotation

# Run new container
docker run -d \
  --name cbpl-solar-quotation \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://api.inventory.chairbordsolar.com/api \
  -e NODE_ENV=production \
  vikasyadav30/cbpl-solar-quotation:latest
```

## Troubleshooting

### SSH Connection Fails
- Verify `EC2_HOST` and `EC2_USER` are correct
- Check security group allows SSH from GitHub Actions
- Ensure SSH key is correctly formatted (no extra spaces/newlines)

### Docker Pull Fails
- Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` are correct
- Check Docker Hub image exists and is public/accessible

### Container Won't Start
- Check EC2 instance has enough resources
- Verify port 3000 is available
- Check Docker logs: `docker logs cbpl-solar-quotation`

### Application Not Accessible
- Verify security group allows inbound traffic on port 3000
- Check if application is running: `docker ps`
- Check application logs: `docker logs cbpl-solar-quotation`

## Customization

You can customize the deployment by modifying `.github/workflows/ci-cd.yml`:

- **Change port:** Update `-p 3000:3000` to your desired port
- **Add environment variables:** Add more `-e KEY=value` flags
- **Add volumes:** Add `-v /host/path:/container/path` for persistent data
- **Use docker-compose:** Replace docker run with docker-compose up

