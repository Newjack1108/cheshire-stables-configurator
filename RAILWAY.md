# Railway Deployment Guide

## Quick Deploy

### Method 1: GitHub Integration (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy on Railway**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will auto-detect Next.js and deploy

### Method 2: Railway CLI

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login and Deploy**
   ```bash
   railway login
   railway init
   railway up
   ```

3. **Generate Domain**
   ```bash
   railway domain
   ```

## Configuration

Railway will automatically:
- Detect Next.js from `package.json`
- Use `npm run build` for building
- Use `npm start` for starting the server
- Set `PORT` environment variable automatically

## Environment Variables

No environment variables are required for basic functionality. If you need to add any:

1. Go to your Railway project dashboard
2. Click on your service
3. Go to "Variables" tab
4. Add your environment variables

## Build Settings

The project is configured with:
- **Node Version**: 18+ (specified in `.nvmrc`)
- **Build Command**: `npm run build` (auto-detected)
- **Start Command**: `npm start` (auto-detected)
- **Output**: Standalone mode (configured in `next.config.js`)

## Troubleshooting

### Build Fails

- Check that all dependencies are in `package.json`
- Ensure Node.js version is 18+
- Check build logs in Railway dashboard

### App Won't Start

- Verify `npm start` works locally
- Check that port is set correctly (Railway sets `PORT` automatically)
- Review logs in Railway dashboard

### Domain Issues

- Railway provides a default `.railway.app` domain
- For custom domain, use `railway domain` command or dashboard

## Monitoring

- View logs: Railway dashboard → Your service → Logs
- View metrics: Railway dashboard → Your service → Metrics
- View deployments: Railway dashboard → Your service → Deployments


