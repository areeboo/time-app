# Auto Clock-out Cron Job Setup

This document explains how to set up automatic daily auto clock-out for your time tracking application.

## Environment Variables

First, add the following environment variable to your `.env.local` file:

```bash
CRON_SECRET=your-secure-random-secret-key-here
```

Generate a secure random key for production use.

## Option 1: Vercel Cron (Recommended for Vercel deployment)

Create a `vercel.json` file in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-clockout",
      "schedule": "0 18,20 * * *"
    }
  ]
}
```

This will run at 6 PM and 8 PM every day (UTC). Adjust timezone as needed.

## Option 2: External Cron Service (GitHub Actions)

Create `.github/workflows/auto-clockout.yml`:

```yaml
name: Auto Clock-out
on:
  schedule:
    # Run at 6 PM and 8 PM EST (23:00 and 01:00 UTC next day)
    - cron: '0 23 * * *'
    - cron: '0 1 * * *'

jobs:
  auto-clockout:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Auto Clock-out
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/cron/auto-clockout \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

Add these secrets to your GitHub repository:
- `APP_URL`: Your application URL (e.g., `https://your-app.vercel.app`)
- `CRON_SECRET`: The same secret from your environment variables

## Option 3: External Cron Service (cron-job.org or similar)

1. Sign up for a cron job service like cron-job.org
2. Create a new cron job with:
   - URL: `https://your-app-domain.com/api/cron/auto-clockout`
   - Method: POST
   - Headers: `Authorization: Bearer your-cron-secret-here`
   - Schedule: `0 18,20 * * *` (6 PM and 8 PM daily)

## Option 4: Server Cron (if self-hosting)

Add to your server's crontab:

```bash
# Auto clock-out at 6 PM and 8 PM daily
0 18,20 * * * curl -X POST https://your-app-domain.com/api/cron/auto-clockout -H "Authorization: Bearer your-cron-secret-here"
```

## Testing

Test your cron job setup:

```bash
# Test the endpoint manually
curl -X POST http://localhost:3000/api/cron/auto-clockout \
  -H "Authorization: Bearer your-cron-secret-here" \
  -H "Content-Type: application/json"
```

## Monitoring

The cron endpoint returns detailed logs and status. Monitor your cron job service logs to ensure it's running successfully.

## Timezone Considerations

- All times in the application are handled in local time
- Adjust cron schedules based on your server's timezone
- Consider daylight saving time changes

## Business Hours Configuration

Current settings in `/src/lib/auto-clockout.ts`:
- Monday-Saturday: 8:00 PM (20:00)
- Sunday: 6:00 PM (18:00)

To modify these times, update the `BUSINESS_HOURS` configuration in the auto-clockout.ts file.