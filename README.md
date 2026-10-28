# Abel Digital Store — setup guide

Stack: React + TypeScript (Vite) on Vercel, Supabase for database, auth and file storage.

## 1. Run on your laptop
Install Node.js 20+ from nodejs.org, then in this folder:
`npm install`, copy `.env.example` to `.env` (fill it in after step 2/3), then `npm run dev` and open http://localhost:5173.

## 2. Create database and storage
1. Make a free account at supabase.com, create a project (pick the region closest to you; save the DB password).
2. Open SQL Editor, paste all of `supabase/schema.sql`, click Run. This creates tables, security rules, the download counter, the `apks`, `images`, and `downloads` buckets, and a draft DLBC Bible Puzzle listing.
   - If you already set up the project using the old schema, run `supabase/migrations/20261028000000_add_digital_downloads.sql` in SQL Editor instead. Existing apps and APK versions are preserved.
3. Project Settings > API: copy the Project URL and the `anon` public key into `.env`. Never use or share the `service_role` key.

## 3. Create the admin account securely
1. Authentication > Users > Add user: your email and a long unique password (tick auto-confirm).
2. Authentication > Providers > Email: turn OFF "Allow new users to sign up".
3. SQL Editor: `insert into admins (user_id) select id from auth.users where email = 'you@example.com';`
Only users in the `admins` table can write anything, even if someone else obtained an account.

## 4. Publish apps and downloads
Go to `/admin` and sign in. The dashboard lets you create items as Android apps, music, ebooks, documents, videos, or other supported files. Add a title, description, category, optional artwork, and a file, then Save and click Publish. Music items include an in-page audio player.

Uploads are limited to 50 MB per file and checked against the selected content type. Supported formats include APK, MP3/M4A/WAV/OGG/AAC/FLAC, PDF/EPUB, common Office documents, MP4/WebM/MOV, and ZIP. Supabase Free has a 50 MB per-file cap; larger media requires a storage plan or hosting provider that supports larger uploads.

For Android apps, provide a version (e.g. `1.0.0`) with each APK. Previous versions remain in the changelog.

## 5. Deploy
Push the folder to a GitHub repo (`.env` is git-ignored). At vercel.com: Add New > Project > import the repo. Add the three variables from `.env.example` under Environment Variables, then Deploy. Vercel gives HTTPS automatically.
In Supabase, Authentication > URL Configuration: set Site URL to your Vercel address.

## 6. AdSense
Apply for AdSense and complete Google's site review first. After approval, set `VITE_ADSENSE_CLIENT` to your publisher ID (`ca-pub-...`) and `VITE_ADSENSE_SLOT` to the responsive ad-unit ID in Vercel Environment Variables, then redeploy. The ad slot stays hidden until both values are present. Complete any AdSense site-verification and `ads.txt` steps shown in your AdSense account.

## 7. Custom domain
Vercel project > Settings > Domains > add your domain and set the DNS records Vercel shows at your registrar. HTTPS is issued automatically.

## 8. Updating catalog items
Admin > Edit / new version > replace the item file or update its details > Save. APK versions stay in the app changelog. Site code changes: push to GitHub and Vercel redeploys.

## 9. Backups
- Database: Supabase > Database > Backups (daily backups are on paid plans; on free, run Table Editor > export CSV for `apps` and `versions` regularly, or `pg_dump` with the connection string).
- Files: keep the original APKs and images on your laptop; Supabase Storage has no one-click export on the free plan.

## Costs and limits (verify current numbers on supabase.com/pricing and vercel.com/pricing)
- Supabase free: roughly 500 MB database, 1 GB file storage, 50 MB max file size, limited monthly bandwidth, and projects pause after about a week of inactivity. Pro is about $25/month with much more storage and bandwidth and larger files.
- Vercel Hobby: free for personal, non-commercial use; Pro is about $20/month.
- Domain: about $10–15/year.
- If an upload is over 50 MB, you need a paid Supabase plan (raise the bucket limit in the SQL file and Storage settings) or another storage host.

## Security notes
Uploads are limited by type and size on the server (bucket rules) and only admins can write (row-level security). The site never claims apps are safe; it shows risk notices. Consider scanning APKs (e.g. VirusTotal) yourself before publishing.
