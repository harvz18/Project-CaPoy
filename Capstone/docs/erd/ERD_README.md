# Multivent ERD Documentation

## Database

- Platform: Supabase PostgreSQL
- Schema documented: `public`
- External system reference shown: `auth.users`
- Generation date: 2026-10-08

## Verified schema totals

- Total public tables: **51**
- Total public-table columns: **569**
- Total foreign keys: **116**
  - Public-to-public foreign keys: **115**
- Public-to-external foreign keys: **1** (`profiles.id -> auth.users.id`)
- Total relationships drawn across the six detailed pages: **116**

## Generated files

- `Multivent_Complete_ERD.drawio`
- `Multivent_Complete_ERD.xml`
- `Multivent_Manuscript_ERD.drawio`
- `Multivent_Manuscript_ERD.pdf`
- `MANUSCRIPT_ERD_REPORT.md`
- `Multivent_ERD_Users.drawio`
- `Multivent_ERD_Services.drawio`
- `Multivent_ERD_Events_Bookings.drawio`
- `Multivent_ERD_Coordinators.drawio`
- `Multivent_ERD_Payments.drawio`
- `Multivent_ERD_Reviews_Messaging.drawio`
- `ERD_README.md`

## Focused diagrams

- `Multivent_ERD_Users.drawio` — Users and Access Control (8 primary tables, 1 context tables).
- `Multivent_ERD_Services.drawio` — Providers, Services, and Availability (8 primary tables, 2 context tables).
- `Multivent_ERD_Events_Bookings.drawio` — Events, Selection, Scheduling, and Bookings (10 primary tables, 5 context tables).
- `Multivent_ERD_Coordinators.drawio` — Coordinators and Curated Packages (7 primary tables, 4 context tables).
- `Multivent_ERD_Payments.drawio` — Payments, Ledger, Remittance, and Payouts (6 primary tables, 4 context tables).
- `Multivent_ERD_Reviews_Messaging.drawio` — Reviews, Messaging, Support, and Administration (12 primary tables, 5 context tables).

The complete `.drawio` file contains an overview page followed by all six detailed module pages. The `.xml` file is an identical native diagrams.net document. Each focused `.drawio` file contains its corresponding detailed page.

## Manuscript ERD package

- `Multivent_Manuscript_ERD.drawio` contains **29** named, editable pages designed for an A4 landscape manuscript layout.
- `Multivent_Manuscript_ERD.pdf` is the matching **29-page** vector PDF export.
- `manuscript/` contains one editable `.drawio` file and one print-ready `.pdf` file per figure.
- `MANUSCRIPT_ERD_REPORT.md` documents table coverage, repeated reference entities, selective attribute omissions, and relationships omitted from each focused figure.

The manuscript figures intentionally display all primary-key and foreign-key columns plus selected business attributes. Routine timestamps, metadata, snapshots, and other nonessential attributes may be omitted from an individual figure. The Complete Technical ERD remains the authoritative all-column and all-relationship documentation.

## Schema source and verification

The source of truth was the connected Supabase PostgreSQL project. On 2026-10-08, a read-only catalog check reported **51 tables**, **569 columns**, and **116 foreign keys**. The column fingerprint returned by the live catalog was `ec3f02f326b0eb43576e86b043f13d0c`.

The detailed table and column metadata was taken from `docs/erd_exports/live_public_schema.json`, which matches the live table and column totals. That snapshot contains 115 public-to-public foreign keys. The live catalog additionally reports the external Supabase Auth relationship `profiles.id -> auth.users.id`; it is represented explicitly using a visually distinguished `auth.users` context table.

No credentials, secrets, row data, policies, functions, triggers, or database contents are embedded in these files.

## Diagram conventions

- Table headers use 18px type. Key markers, column names, and PostgreSQL data types use 15px type. Relationship labels use 13px type.
- Every table header, column marker, column name, and data type is a separate editable draw.io cell.
- Column cells are children of their table group, so they move with the table.
- Every relationship is an editable `mxCell` connector attached to invisible exterior anchors whose vertical centers are calculated from the relevant source and target column rows. These anchors are children of the table group and move with it.
- PK = primary key; FK = foreign key; UQ = single-column unique constraint; `?` = nullable.
- Matching numbered markers such as `UQ1` identify columns participating in the same composite unique constraint.
- Composite primary keys mark every participating column.
- Crow's Foot maximum cardinality is derived from FK uniqueness.
- Parent optionality is derived from FK nullability.
- Junction tables are shown as real tables; no direct many-to-many shortcut relationships were added.
- Colored headers identify the page's primary module tables. Gray headers are repeated context tables. `auth.users` is an external system table.
- Table headers contain only entity names; RLS labels are intentionally excluded from the diagram surface.
- Relationship edges use explicit orthogonal waypoints, distinct parallel lanes, and native `jumpStyle=arc; jumpSize=10` properties for unavoidable crossings.

## Automated geometry validation

- Table-to-table overlaps: **0**
- Relationship routes intersecting unrelated table interiors: **0**
- Broken connector source/target references: **0**
- Connectors attached to the wrong FK or referenced-key row anchor: **0**
- Duplicate explicit relationship routes: **0**
- Row anchors failing exterior-boundary clearance: **0**
- Relationship routes leaving the page or title-safe routing area: **0**
- Header, marker, column, or data-type text overflow detected by conservative width estimates: **0**
- Relationship routes checked: **116**

### Connector intersection report

Crossings below are intersections between unrelated connector segments, not table-body intersections. They are rendered with native draw.io arc jumps. Collinear overlaps are reported separately; residual cases occur where several constraints must converge on the same exact key-row anchor. Routes are split between left and right anchors and offset into separate lanes where geometry permits.

| Module | Relationships | Crossings | Shared collinear spans | Shared spans over 50px | Longest shared span (px) |
|---|---:|---:|---:|---:|---:|
| Users and Access Control | 11 | 28 | 8 | 6 | 84 |
| Providers, Services, and Availability | 13 | 33 | 3 | 0 | 46 |
| Events, Selection, Scheduling, and Bookings | 33 | 217 | 23 | 16 | 112 |
| Coordinators and Curated Packages | 14 | 52 | 6 | 2 | 56 |
| Payments, Ledger, Remittance, and Payouts | 20 | 72 | 12 | 6 | 88 |
| Reviews, Messaging, Support, and Administration | 25 | 172 | 28 | 21 | 102 |

## Tables with no foreign-key relationships

`provider_profile_merge_archive`

## External references

- `profiles.id -> auth.users.id` is the only external foreign-key reference. Only `auth.users.id` is displayed because the external Auth schema is not application-owned.

## Ambiguities and limitations

- PostgreSQL foreign keys define child-to-parent validity, nullability, and uniqueness, but they do not require a parent row to have at least one child. Therefore child multiplicities are rendered as zero-to-one or zero-to-many, while the parent endpoint is zero-or-one for nullable FKs and exactly one for non-nullable FKs.
- Unique indicators were reconciled against live `pg_constraint` rows. Composite primary keys mark every participating column, and composite unique constraints use matching numbered `UQn` markers rather than incorrectly implying that each member column is independently unique.
- No relationships were omitted. The six module pages partition relationship ownership by source table, so every one of the 116 live constraints is drawn exactly once in the complete file.
- A diagrams.net desktop/CLI renderer was not installed in the workspace. For privacy, the schema was not uploaded to the external diagrams.net viewer. Local-only previews of the complete overview and all six technical module pages were inspected. The 29-page manuscript PDF was rendered at its actual A4 landscape dimensions and every page was inspected for text legibility, clipping, table spacing, Crow's Foot clearance, connector placement, and visible bridge arcs. The deliverables were also validated as well-formed native draw.io XML with valid connector endpoints, complete declared coverage, and non-overlapping table geometry. They are not claimed as having been opened by the official diagrams.net renderer.

## Live database versus local migrations

The live database was treated as authoritative. A full replay-and-diff of every historical migration was not performed because that could misrepresent deployment history and was unnecessary for a documentation-only task. The material discrepancy found in the earlier local ERD metadata was the intentionally omitted external Auth FK: the local snapshot listed 115 internal relationships, while the live catalog listed 116 total relationships. This generated package includes all 116.

## Security observation

The live Supabase inspection reported that `public.service_categories` currently has Row Level Security disabled. This security observation is documented here, but RLS labels were removed from table headers as requested. No remediation was applied because this task is read-only and enabling RLS without suitable policies could block application access.

## Opening and editing

1. Open <https://app.diagrams.net/>.
2. Choose **File -> Open From -> Device**.
3. Select `Multivent_Complete_ERD.drawio`.
4. Use the page tabs for the overview and module diagrams.
5. Move a table by selecting its grouped table structure; its rows move with it.
6. Double-click a header, key marker, column name, data type, or connector label to edit it.
