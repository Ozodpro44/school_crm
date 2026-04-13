# Resend Email Integration Setup Guide

## Overview
This guide walks through migrating your backend from SMTP to **Resend** for reliable email delivery.

## Step 1: Sign up for Resend
1. Go to [resend.com](https://resend.com) and create a free account
2. Navigate to **API Keys** section in your dashboard
3. Create a new API key with "Full Access" or "Send" permissions
4. Save this key securely (you'll need it in Step 3)

## Step 2: Verify Your Domain
Resend requires domain verification. You cannot use @gmail.com addresses on the free tier.

1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `yourdomain.com`)
3. Resend provides DNS records (TXT, CNAME) to add to your domain registrar
4. Add these records at your registrar (GoDaddy, Namecheap, etc.)
5. Resend will verify automatically (usually takes a few minutes)
6. Once verified, you can send from `onboarding@yourdomain.com` or similar

## Step 3: Update Railway Environment Variables

1. Go to your Railway project dashboard
2. Navigate to **Variables** tab
3. Remove the old SMTP variables:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM`

4. Add the new Resend variables:
   ```
   RESEND_API_KEY: <your-api-key-from-step-1>
   RESEND_FROM: <your-verified-domain-email> (e.g., onboarding@yourdomain.com)
   ```

## Step 4: Deploy
1. Commit your code changes
2. Push to your repository
3. Railway automatically re-deploys with the new environment variables

## Code Changes Made
- **email.go**: Replaced SMTP logic with Resend API client
- **config.go**: Updated to use `ResendAPIKey` and `ResendFrom` instead of SMTP variables
- **main.go**: Updated initialization to use Resend credentials
- **go.mod**: Added `github.com/resend/resend-go/v2` dependency

## Testing
Once deployed, test by triggering a password reset:
1. Use the forgot-password endpoint with a valid email
2. Check logs for successful Resend API calls
3. Verify email arrives in recipient's inbox

## Troubleshooting

**"RESEND_API_KEY environment variable not set"**
- Verify you added `RESEND_API_KEY` to Railway environment variables
- Wait for deployment to complete

**"Email not being sent"**
- Check that `RESEND_FROM` is a verified domain address
- Verify the API key has "Send" permissions
- Check Railway logs for API errors

**"Invalid From address"**
- Ensure `RESEND_FROM` uses a verified domain
- Format: `name@yourdomain.com` or just `onboarding@yourdomain.com`
