# Abel Apps Store — setup guide

Stack: React + TypeScript (Vite) on Vercel, Supabase for database, auth and file storage.

## 1. Run on your laptop
Install Node.js 20+ from nodejs.org, then in this folder:
`npm install`, copy `.env.example` to `.env` (fill it in after step 2/3), then `npm run dev` and open http://localhost:5173.

## 2. Create database and storage
1. Make a free account at supabase.com, create a project (pick the region closest to you; save the DB password).
2. Open SQL Editor, paste all of `supabase/schema.sql`, click Run. This creates tables, security rules, the download counter, the `apks` and `images` buckets (50 MB / 5 MB per-file limits enforced by the server) and a draft DLBC Bible Puzzle listing.
3. Project Settings > API: copy the Project URL and the `anon` public key into `.env`. Never use or share the `service_role` key.

## 3. Create the admin account securely
1. Authentication > Users > Add user: your email and a long unique password (tick auto-confirm).
2. Authentication > Providers > Email: turn OFF "Allow new users to sign up".
3. SQL Editor: `insert into admins (user_id) select id from auth.users where email = 'you@example.com';`
Only users in the `admins` table can write anything, even if someone else obtained an account.

## 4. Upload your first APK
Go to /admin, sign in. Under Edit on DLBC Bible Puzzle: add icon, screenshots, version (e.g. 1.0.0), the APK, release notes, Save. Then click Publish. Works from a phone browser too.

## 5. Deploy
Push the folder to a GitHub repo (`.env` is git-ignored). At vercel.com: Add New > Project > import the repo. Add the three variables from `.env.example` under Environment Variables, then Deploy. Vercel gives HTTPS automatically.
In Supabase, Authentication > URL Configuration: set Site URL to your Vercel address.

## 6. Custom domain
Vercel project > Settings > Domains > add your domain and set the DNS records Vercel shows at your registrar. HTTPS is issued automatically.

## 7. Updating apps
Admin > Edit / new version > choose the new APK, enter the new version and notes > Save. Old versions stay in the changelog. Site code changes: push to GitHub and Vercel redeploys.

## 8. Backups
- Database: Supabase > Database > Backups (daily backups are on paid plans; on free, run Table Editor > export CSV for `apps` and `versions` regularly, or `pg_dump` with the connection string).
- Files: keep the original APKs and images on your laptop; Supabase Storage has no one-click export on the free plan.

## Costs and limits (verify current numbers on supabase.com/pricing and vercel.com/pricing)
- Supabase free: roughly 500 MB database, 1 GB file storage, 50 MB max file size, limited monthly bandwidth, and projects pause after about a week of inactivity. Pro is about $25/month with much more storage and bandwidth and larger files.
- Vercel Hobby: free for personal, non-commercial use; Pro is about $20/month.
- Domain: about $10–15/year.
- If an APK is over 50 MB, you need a paid Supabase plan (raise the bucket limit in the SQL file and Storage settings) or another storage host.

## Security notes
Uploads are limited by type and size on the server (bucket rules) and only admins can write (row-level security). The site never claims apps are safe; it shows risk notices. Consider scanning APKs (e.g. VirusTotal) yourself before publishing.
