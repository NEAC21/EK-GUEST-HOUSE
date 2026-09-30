# EK Pension: booking + Chapa setup

1. Create a free Postgres database (Neon or Supabase) and copy its connection string.
2. Push this folder to GitHub and import it in Vercel (no build settings needed).
3. In Vercel > Settings > Environment Variables add everything from `.env.example`.
   Use your Chapa LIVE secret key when going live (test key while testing).
4. Redeploy. Open `/admin.html`, log in, set each room's price and quantity, and the check-in/out times.
   Rooms with price 0 cannot be booked online.
5. In Chapa dashboard > Settings > Webhooks, set the webhook URL to `https://YOUR-SITE/api/chapa-webhook`.
6. Test with Chapa test mode: book, pay, check you get the email and the booking shows "paid" in admin.
