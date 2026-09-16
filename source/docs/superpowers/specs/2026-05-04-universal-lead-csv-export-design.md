# Universal Lead CSV Export Design

- Date: 2026-05-04
- Product: ShowReady mobile app and intake web app
- Status: Approved for spec drafting
- Scope: Settings-based export of submitted lead data to one universal CRM-friendly CSV format

## Summary

ShowReady should let a realtor export submitted lead data from mobile Settings as a universal CSV that can be imported into common CRMs with their normal field-mapping flows. The selected approach is a server-generated CSV endpoint guarded by the existing mobile authentication boundary, with the mobile Settings screen providing a date-range picker and file share/save flow.

The export should use one universal format in v1. It should not add CRM-specific presets for Follow Up Boss, Lofty, MoxiEngage, kvCORE/BoldTrail, Wise Agent, Real Geeks, HubSpot, Salesforce, or other systems. Most CRM importers accept flexible CSV mapping, but some require exact proprietary templates. A universal export gives realtors useful portability now without creating a maintenance burden around many vendor-specific templates.

## Goals

- Add a lead export option to the mobile Settings screen.
- Export only leads with `status = submitted`.
- Let the realtor select an inclusive `from` and `to` submitted-date range with calendar date pickers.
- Generate one universal CRM-friendly CSV with stable headers.
- Include contact identity, source/stage/tags, ShowReady scoring, and key questionnaire context.
- Preserve rich ShowReady context in a `Notes` column so CRMs without matching custom fields still retain useful lead detail.
- Keep authorization and CSV generation on the backend so the mobile app does not pull a large raw lead dataset into memory.
- Record an audit event for export requests.

## Non-Goals

- CRM-specific export presets in v1.
- Direct API push into any CRM.
- Exporting pending or incomplete invite drafts.
- Exporting archived private system data unrelated to lead import.
- Building a background export queue or emailed export delivery.
- Creating a desktop admin export surface.
- Importing CSV files back into ShowReady.

## Research Notes

The universal format is based on current import behavior documented by common CRMs:

- Follow Up Boss imports contact CSVs with name, phone, email, source, assigned agent, stage, tags, background, notes, and custom fields. It merges by email or phone plus name.
- Lofty imports CSV/XLS/XLSX and supports full name, email, phone, pipeline, agent, lead type, source, tag, buyer timeframe, pre-qualified, custom fields, and notes.
- Real Geeks imports CSV/XLSX through a mapping flow and supports source/agent assignment. Duplicate emails are rejected.
- Wise Agent imports CSV files, lets users choose source/category on import, and supports notes.
- HubSpot requires a header row and at least one of first name, last name, or email for contact creation; it uses email as a common unique identifier for contacts.
- MoxiEngage is a notable exception because its direct CSV import requires an exact vendor template and unchanged header row. It can still receive data manually through its template, but ShowReady v1 should not target that exact format.

References:

- https://help.followupboss.com/hc/en-us/articles/4402323033751-Importing-Contacts-Overview
- https://help.lofty.com/hc/en-us/articles/360001710831-Lead-Import-via-CSV-Spreadsheet
- https://help.lofty.com/hc/en-us/article_attachments/360047582072
- https://support.realgeeks.com/import-leads-in-bulk
- https://wise-agent-crm.instantdocsbase.com/help/importing-contacts
- https://knowledge.hubspot.com/import-and-export/set-up-your-import-file
- https://support.moxiworks.com/hc/en-us/articles/115005567646-Importing-Contacts-Directly-via-CSV-File

## Selected Approach

Add a `GET /api/mobile/leads/export.csv` route in `apps/intake-web`. The endpoint will authenticate the caller with the existing mobile bearer-token flow, validate the date range, load submitted leads for the signed-in agent, and stream or return a CSV file.

The mobile Settings screen will add a `Lead Data Export` card. Tapping it opens a bottom sheet that contains:

- From date field with a calendar picker.
- To date field with a calendar picker.
- Export CSV action.
- Inline success/error states.

The app will request the CSV from the backend, write it to a temporary local file, and open the platform share sheet so the realtor can save it to Files, Drive, email, AirDrop, or another installed destination.

This keeps the sensitive data export policy centralized on the backend and fits the existing mobile UI pattern. The app already uses native calendar date pickers in appointment and pipeline flows, so the export sheet should reuse the same interaction model.

## User Experience

### Settings Entry Point

The Settings screen should add a `Lead Data Export` card below profile settings and above feedback, or directly above feedback if profile save state should remain visually grouped.

The card should contain:

- Title: `Lead Data Export`
- Primary action: `Export lead data`
- Concise body copy can be avoided if the title and button make the action clear. If helper text is needed, keep it operational rather than promotional.

### Export Sheet

The bottom sheet should show:

- `From date`
- `To date`
- `Export CSV`

Each date field should be a pressable control with a calendar icon. Pressing it opens the native date picker. On iOS, the sheet should include a `Done` action for the active picker if needed, matching the appointment screen pattern.

Default range:

- `From date`: 30 calendar days before today.
- `To date`: today.

The app should prevent export when:

- either date is missing
- `from` is after `to`
- an export request is already running

Empty results should show a clear inline message:

`No submitted leads found for that date range.`

### File Naming

The exported file name should be:

```text
showready-leads-YYYY-MM-DD-to-YYYY-MM-DD.csv
```

Example:

```text
showready-leads-2026-05-01-to-2026-05-04.csv
```

## Date Range Semantics

The date range is based on `submitted_at`, not `created_at`.

The range is inclusive in the realtor's selected calendar dates:

```text
submitted_at >= fromDate 00:00:00
submitted_at <= toDate 23:59:59.999
```

The mobile app should send date-only values plus the device IANA time zone when available:

```text
GET /api/mobile/leads/export.csv?from=2026-05-01&to=2026-05-04&timeZone=America%2FToronto
```

The backend should convert the local day boundaries to UTC before querying Supabase. If the time zone is missing or invalid, the endpoint may fall back to UTC and should still keep the date range inclusive.

## CSV Contract

The v1 header order should be stable:

```csv
First Name,Last Name,Full Name,Email,Phone,Company,Lead Type,Source,Stage,Pipeline,Tags,Assigned Agent,Created Date,Submitted Date,ShowReady Lead ID,ShowReady Stage,ShowReady Score,ShowReady Recommendation,Timeframe,Neighborhoods,Property Type,Bedrooms,Bathrooms,Budget Or Rent Range,Financing Or Readiness,Must Haves,Worked With Another Realtor,Additional Context,Notes
```

### Field Mapping

- `First Name`: derived from `buyerName`.
- `Last Name`: derived from `buyerName`.
- `Full Name`: `buyerName`.
- `Email`: `buyerEmail`.
- `Phone`: `buyerPhone`, normalized as safely as possible without inventing country data.
- `Company`: `Residential Client`.
- `Lead Type`: `Buyer` for sale intake, `Renter` for rental intake.
- `Source`: `ShowReady`.
- `Stage`: human-readable ShowReady pipeline stage, such as `Ready to Show`.
- `Pipeline`: same as `Stage` in v1, because some CRMs distinguish stage and pipeline while others only need one mapped field.
- `Tags`: semicolon-separated tags, for example `ShowReady; Buyer; Ready to Show; Score 9`.
- `Assigned Agent`: signed-in agent full name when available.
- `Created Date`: lead `createdAt`, formatted as `MM/DD/YYYY`.
- `Submitted Date`: lead `submittedAt`, formatted as `MM/DD/YYYY`.
- `ShowReady Lead ID`: internal lead id for traceability.
- `ShowReady Stage`: raw pipeline stage key, such as `ready_to_show`.
- `ShowReady Score`: numeric score.
- `ShowReady Recommendation`: `show`, `nurture`, or `hold`.
- `Timeframe`: buyer timeline or rental move timeline.
- `Neighborhoods`: buyer or rental neighborhoods answer.
- `Property Type`: buyer property types or rental place types, joined with semicolons.
- `Bedrooms`: buyer or rental bedrooms.
- `Bathrooms`: buyer bathrooms; blank for rental if not collected.
- `Budget Or Rent Range`: buyer budget knowledge if no exact budget exists, or rental rent range.
- `Financing Or Readiness`: buyer mortgage status or rental income proof / rented-in-Canada readiness summary.
- `Must Haves`: selected must-haves, joined with semicolons.
- `Worked With Another Realtor`: buyer-specific answer when present.
- `Additional Context`: buyer or rental additional context.
- `Notes`: compact multiline or sentence-style summary of important ShowReady details.

### Notes Column

The `Notes` column should preserve useful context that may not map cleanly into the destination CRM:

- ShowReady score and recommendation.
- ShowReady summary and next action when available.
- Buyer/rental intent.
- Important questionnaire answers.
- Custom question answers.
- Latest contact interaction summary when available.

The value must still be one valid CSV field. Embedded line breaks are allowed by CSV if quoted, but v1 should prefer readable sentence blocks separated by ` | ` to reduce importer quirks.

### CSV Formatting

- UTF-8 encoded.
- First row is always the header.
- Quote fields when needed.
- Escape quotes by doubling them.
- Preserve blank cells for missing values.
- Do not use literal placeholder values such as `N/A`, `Unknown`, or `TBD`.
- Use semicolons inside multi-value fields to avoid conflicts with CSV commas.

## Backend Design

### Route

Add:

```text
apps/intake-web/app/api/mobile/leads/export.csv/route.ts
```

Route signature:

```text
GET /api/mobile/leads/export.csv?from=YYYY-MM-DD&to=YYYY-MM-DD&timeZone=America%2FToronto
```

Responsibilities:

1. Authenticate with `requireMobileAgent`.
2. Validate `from` and `to` as date-only strings.
3. Validate `from <= to`.
4. Convert local inclusive day range to UTC bounds.
5. Query only the authenticated agent's submitted leads.
6. Include answer rows and latest score metadata needed for export fields.
7. Generate CSV with the stable universal header.
8. Return `text/csv; charset=utf-8`.
9. Set `Content-Disposition` with the generated file name.
10. Record an audit event with action `privacy.export_requested`.

### Data Access

Add a data-layer helper in `apps/intake-web/lib/supabase/data.ts`, for example:

```ts
exportSubmittedLeadsForCsv(client, agentId, range)
```

The helper should not accept arbitrary agent IDs from client input. It should only use the authenticated `agentId`.

The query should include:

- lead core columns
- answer rows from `lead_answers`
- latest score row from `lead_scores` if needed for breakdown or override data
- latest contact interaction if included in notes

If export volume becomes large later, the helper can page through results. V1 can use a conservative maximum and return a clear error if exceeded.

### Validation and Limits

Initial limits:

- Maximum date range: 366 days.
- Maximum exported rows: 10,000.

If a request exceeds the range limit, return `400`.

If the result exceeds the row limit, return `413` or `400` with an actionable error:

```json
{ "error": "Export contains too many leads. Choose a shorter date range." }
```

## Mobile Design

### API Client

Add a mobile API method in `packages/infrastructure/src/mobile-api.ts`:

```ts
exportLeadsCsv(input: {
  fromDate: string
  toDate: string
  timeZone?: string
}): Promise<{
  fileName: string
  csv: string
}>
```

The method should:

- build the export URL with query parameters
- include the current bearer token through existing request infrastructure
- handle non-2xx responses with the same `MobileApiError` pattern as other methods
- parse the file name from `Content-Disposition` when available

### Settings Screen

Update:

- `apps/agent-mobile/app/(app)/settings.tsx`

Add state for:

- export sheet visibility
- from date
- to date
- active picker
- export loading state
- export notice

The screen should use the existing `BottomSheet`, `ActionButton`, `InlineMessage`, and native `DateTimePicker` patterns.

### File Save or Share

The mobile app should write the CSV string to a temporary cache file and invoke the native share sheet. The exact library should follow existing Expo dependencies if one is already available. If no file-sharing dependency exists, the implementation plan should add the smallest standard Expo dependency needed for a save/share flow.

## Security and Privacy

- Export is authenticated.
- Export is scoped to the signed-in realtor's `agent_id`.
- The client does not pass or control `agent_id`.
- Submitted leads are personal data; the export action should be auditable.
- The endpoint should avoid logging CSV contents or raw lead answer payloads.
- Error messages should not include lead names, emails, phone numbers, or notes.
- The generated file exists on the user's device after export. The app should not retain extra copies beyond the temporary file needed for sharing.

## Error Handling

Backend:

- `401` when authentication fails.
- `400` for invalid date input, missing date input, reversed date range, or range above max.
- `413` or `400` for too many rows.
- `500` for unexpected export failures.

Mobile:

- Show inline validation before calling the backend where possible.
- Show backend error messages in a compact inline message.
- Re-enable the export button after failure.
- Keep selected dates intact after failure so the realtor can adjust and retry.

## Testing

### Unit Tests

Add tests for CSV formatting:

- stable header order
- escaping commas, quotes, and line breaks
- blank missing values
- buyer lead field mapping
- rental lead field mapping
- custom answers included in notes
- tags generated consistently

Add route/data tests:

- rejects missing dates
- rejects invalid dates
- rejects reversed date ranges
- only returns submitted leads
- scopes results to authenticated agent
- filters by inclusive submitted date range
- records audit event for export request

Add mobile tests:

- Settings shows export entry point.
- Export sheet opens from Settings.
- Date picker controls update from/to dates.
- Export is disabled for invalid ranges.
- Successful export calls API with date range and time zone.
- Empty result or backend failure shows inline feedback.

## Acceptance Criteria

- A realtor can open Settings and start a lead CSV export.
- The realtor can choose from/to dates with calendar pickers.
- The export includes only submitted leads in the selected submitted-date range.
- The CSV uses the universal stable header.
- The CSV can be shared/saved from the mobile device.
- The backend enforces authenticated agent scoping.
- Invalid ranges and empty exports produce understandable UI states.
- Export requests are audited.
