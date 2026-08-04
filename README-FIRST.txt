WRITEWISE CLOUD PWA — QUICK SETUP (ABOUT 10 MINUTES)
====================================================

This version stores customer images and reports centrally, so different users and the admin can use different phones/computers. No Google login and no payment gateway.

ONE-TIME SETUP
1. Create a free project at Supabase.
2. In Supabase, open SQL Editor → New Query.
3. Open setup.sql from this folder in Notepad.
4. Replace every occurrence of CHANGE-THIS-ADMIN-SECRET-1604 with one long private secret, for example:
   Moazzam-WW-Admin-2026-Strong-Secret
5. Paste the full SQL into Supabase and click Run.
6. Open Supabase → Project Settings → API.
7. Copy Project URL and anon/public key.
8. Open config.js and paste those two values.
9. Put the SAME private admin secret in config.js as adminKey.
10. Upload all files in this folder to GitHub Pages or any static hosting.

CUSTOMER USE
- Customer enters name.
- Customer generates or enters a private access code.
- Customer uploads handwriting.
- The same access code is needed later to see the report.

ADMIN USE
- Open Admin Panel.
- Enter the private admin key from config.js.
- Review images and publish reports.

CAPACITY
This build compresses images before upload and is suitable for a small pilot of around 100 users, subject to your Supabase plan limits and actual image sizes.

SECURITY NOTE
This is a practical pilot build without user accounts. Access codes protect normal customer navigation, but it is not intended for highly sensitive medical, legal, employment, or identity documents. Keep the admin key private. For a commercial launch, add real authentication and private signed image URLs.

IMPORTANT
Do not double-click index.html for final use. Host the files through GitHub Pages, Supabase hosting, Netlify, Cloudflare Pages, Firebase Hosting, or another HTTPS host.
