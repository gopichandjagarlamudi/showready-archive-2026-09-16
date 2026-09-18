# ShowReady hibernation status — September 18, 2026

## Completed

- **App Store:** ShowReady Mobile (`6762884175`) removed from sale on September 18. App Store Connect's Apps page confirms **Removed from App Store**. Apple allows up to 24 hours for storefront propagation. App record retained for relaunch; not deleted. No auto-renewable or non-renewing subscription products were configured. This was the only app shown in the account.
- **Apple Developer:** automatic membership renewal disabled and verified by reopening the control, which now offers Enable auto-renew. Current membership renewal/expiry date shown: **April 21, 2027**. Prevents the next **C$119 annual fee**, unless auto-renew is enabled again or membership is renewed manually.
- **Supabase:** organization `dqmnrkczgwjewhavyrbw` downgraded from Pro to **Free**. ShowReady project `tpzrcuakggeshednyrap` paused; Management API confirmed **INACTIVE**. Projects and data retained. Cancellation dialog stated that unused plan time is credited to the organization and project add-ons are removed.
- **Vercel:** team `jagarlamudigopichand99-4818s-projects` downgraded from Pro to **Hobby**, confirmed in dashboard and API. Downgrade quoted **$8.75 refund** for unused time; settlement not separately verified.
- These four Vercel projects were paused; API confirmed `paused: true`: `showready-mobile-admin-web`, `showready-intake-web`, `showready`, `show-ready-web`.
- Two generic Vercel projects (`web`, `intake-web`) each had only a failed deployment and were not changed.
- **Expo:** `gopi_chand` billing confirmed **Free, $0/month, $0 upcoming estimate**. No change needed.
- Private GitHub source and encrypted backups preserved. No project, app record, database or source workspace was deleted.

## Remaining cost limits

The identified Vercel and Supabase paid subscriptions are canceled; Expo is already free; Apple Developer auto-renew is off. Previously incurred usage may still generate final invoices. External domain registrar renewals and any unrelated third-party subscriptions have not been checked or changed. No ShowReady domain appeared in the Vercel team's domain inventory.

## Reactivation

1. Resume the existing Supabase project. Its pause dialog permits in-platform resumption for up to one year; retain the separate encrypted backup for longer-term recovery.
2. Restore/validate settings and integrations. Resume the Vercel projects in Project Settings → General. Upgrade hosting only as required for commercial use.
3. Test login, data access, lead flows, and account deletion before restoring app availability.
4. Renew Apple Developer membership if expired, review current Apple requirements, and re-enable the intended countries/regions under Pricing and Availability.
5. Apple currently shows an updated program agreement requiring review by October 1, 2026 to retain some account features. No agreement was accepted during hibernation.

See RECOVERY.md for encrypted archive/key details and known backup gaps. The September 16 backup remains a point-in-time backup; the original paused Supabase project is retained.
