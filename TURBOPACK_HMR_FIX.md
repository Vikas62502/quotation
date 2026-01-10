# Turbopack HMR Error Fix

## Error
```
Failed to load chunk /_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_c8c997ce._.js
```

## Solution

This is a common Next.js Turbopack Hot Module Replacement (HMR) error. Follow these steps:

### Step 1: Stop the Development Server
- Press `Ctrl+C` in the terminal where `npm run dev` is running
- Make sure the server is completely stopped

### Step 2: Clear Next.js Cache
```bash
# Clear .next directory
rm -rf .next

# Clear Turbopack cache (if exists)
rm -rf .turbo

# Clear node_modules cache (if exists)
rm -rf node_modules/.cache
```

### Step 3: Restart the Development Server
```bash
npm run dev
```

### Alternative Solution: Use Standard Webpack Mode

If the error persists, you can temporarily disable Turbopack by modifying the dev script:

**In `package.json`:**
```json
{
  "scripts": {
    "dev": "next dev --turbo=false"
  }
}
```

Or use standard mode:
```bash
next dev --turbo=false
```

### Permanent Fix: Update Next.js

If the issue continues, consider updating Next.js:
```bash
npm install next@latest
```

### If Still Not Working

1. **Clear all caches:**
   ```bash
   rm -rf .next .turbo node_modules/.cache
   ```

2. **Restart with clean state:**
   ```bash
   npm run dev
   ```

3. **Check for port conflicts:**
   - Make sure port 3000 (or your configured port) is not in use
   - Kill any existing Node processes: `killall node`

4. **Hard refresh browser:**
   - Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache

## Prevention

- Always stop the dev server properly (Ctrl+C) before restarting
- Clear `.next` directory if you notice build issues
- Keep Next.js updated to the latest stable version
