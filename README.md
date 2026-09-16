# ShowReady recovery archive — 2026-09-16

Private archive of ShowReady's local source and accessible service configuration. This repository is not connected to deployment automation. No services were paused, deleted, or downgraded.

## Contents

- `source/`: 384-file snapshot of the ShowReady Mobile workspace, including uncommitted changes, mobile/web/admin code, SQL migrations, App Store artwork, package lockfile, and Expo/EAS configuration.
- `source-manifest.json`: original repository, branch, and commit.
- Release `backup-2026-09-16`: authenticated encrypted archive `showready-private-backup.fernet` containing the live Supabase database, auth configuration, available API keys, local environment files, all local Git history (including stash), related ShowReady web and landing-page snapshots/history, native project sources, Vercel settings/domains/deployment metadata, and readable Expo environment values/build metadata.
- `RECOVERY.md`: restore procedure and remaining gaps.
- `decrypt_backup.py`: local authenticated decryption helper; the encryption key is deliberately not in GitHub.

Keep the recovery key in a password manager or a separate secure offline location. Losing the key makes the encrypted archive unrecoverable. Checksums are in `SHA256SUMS`.

This is a point-in-time backup. The live service remains active and can receive changes after export.
