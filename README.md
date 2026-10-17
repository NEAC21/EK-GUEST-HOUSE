# EK Guest House – online booking

Next.js 14 + Supabase (database and photo storage) + Chapa payments.
One app, three parts:

| Part | Address | Who |
|---|---|---|
| Public website, 3 languages (English, አማርኛ, Afaan Oromo) | `/` | Guests |
| Reception desk | `/reception` | Receptionist and admin |
| Admin | `/admin` | Admin only |
| Staff sign-in | `/staff/login` | Staff |

## 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → New query → paste `supabase/schema.sql` → Run. This creates the tables, the double-booking protection and the public `rooms` photo bucket.
3. Project settings → API: copy the project URL and the **service_role** key.

## 2. Run locally
```bash
npm install
cp .env.example .env.local      # fill in the values
npm run create-admin            # creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev
```
Open http://localhost:3000/staff/login, sign in, then in **Admin**:
1. Settings → name, phone, address, colors, check-in/out times, refund rules, home photo.
2. Room types → name (3 languages), price, guests, amenities, photos.
3. Rooms → add each physical room number and choose its type.

## 3. Chapa
- Put your secret key in `CHAPA_SECRET_KEY`.
- In the Chapa dashboard (Settings → Webhooks) set the webhook URL to `https://YOUR-SITE/api/chapa/webhook`.
- The site never trusts the webhook body: it asks Chapa to verify the transaction before confirming a booking.

## 4. Deploy
- Push to GitHub → import in **Vercel** → add every variable from `.env.example` (set `NEXT_PUBLIC_SITE_URL` to your real address).
- The backend runs inside the same Vercel app (API routes), so a separate Render server is not needed.

## How it works
- Guest picks dates → system finds a free room of that type → booking is held for 10 minutes (admin can change) → Chapa checkout → on payment Chapa verified → confirmed + email.
- Unpaid holds expire automatically. If a guest pays after the hold ended and the room is gone, the booking is cancelled and a full refund is flagged for the admin.
- Cancel: 80% refund if at least 48 hours before check-in (admin can change). Refunds are paid by the guest house outside Chapa; the admin marks them paid in **Admin → Bookings**.
- Reception payments: cash, Telebirr, bank transfer, POS or pay at check-in, with a receipt number.
- Emails are sent with Resend (`RESEND_API_KEY`, `EMAIL_FROM`). Without a key, bookings still work and no email is sent.
