from __future__ import annotations

import html
import itertools
import json
import math
import re
import shutil
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "docs" / "erd_exports" / "live_public_schema.json"
OUTPUT_DIR = ROOT / "docs" / "erd"

COMPLETE_DRAWIO = OUTPUT_DIR / "Multivent_Complete_ERD.drawio"
COMPLETE_XML = OUTPUT_DIR / "Multivent_Complete_ERD.xml"
README_PATH = OUTPUT_DIR / "ERD_README.md"
MANUSCRIPT_DRAWIO = OUTPUT_DIR / "Multivent_Manuscript_ERD.drawio"
MANUSCRIPT_PDF = OUTPUT_DIR / "Multivent_Manuscript_ERD.pdf"
MANUSCRIPT_DIR = OUTPUT_DIR / "manuscript"

TABLE_WIDTH = 700
HEADER_HEIGHT = 44
ROW_HEIGHT = 34
MARKER_WIDTH = 90
NAME_WIDTH = 360
TYPE_WIDTH = TABLE_WIDTH - MARKER_WIDTH - NAME_WIDTH
LEFT = 160
TOP = 500
GAP_X = 220
GAP_Y = 150
ANCHOR_OFFSET = 8
ROUTE_STUB = 42

EXTERNAL_TABLE = {
    "name": "auth.users",
    "comment": "Supabase Auth system table (external reference only).",
    "rls_enabled": True,
    "external": True,
    "columns": [
        {
            "name": "id",
            "type": "uuid",
            "unique": True,
            "nullable": False,
            "primary_key": True,
        }
    ],
}

EXTERNAL_FK = {
    "name": "profiles_id_fkey",
    "on_delete": "CASCADE",
    "on_update": "NO ACTION",
    "source_table": "profiles",
    "target_table": "auth.users",
    "source_unique": True,
    "source_columns": ["id"],
    "target_columns": ["id"],
    "source_nullable": False,
    "external": True,
}

MODULES = {
    "Users": {
        "file": "Multivent_ERD_Users.drawio",
        "title": "Users and Access Control",
        "color": "#1F4E78",
        "stroke": "#17365D",
        "owned": [
            "profiles",
            "roles",
            "permissions",
            "role_permissions",
            "user_roles",
            "user_permissions",
            "provider_profiles",
            "provider_profile_merge_archive",
        ],
    },
    "Services": {
        "file": "Multivent_ERD_Services.drawio",
        "title": "Providers, Services, and Availability",
        "color": "#0F6B6D",
        "stroke": "#0A4F51",
        "owned": [
            "service_categories",
            "services",
            "service_packages",
            "service_package_items",
            "provider_availability",
            "provider_operating_hours",
            "provider_notification_preferences",
            "provider_service_listing_drafts",
        ],
    },
    "Events_Bookings": {
        "file": "Multivent_ERD_Events_Bookings.drawio",
        "title": "Events, Selection, Scheduling, and Bookings",
        "color": "#7030A0",
        "stroke": "#51237A",
        "owned": [
            "events",
            "event_requirements",
            "event_budget_items",
            "event_service_selections",
            "bookings",
            "event_provider_instructions",
            "event_coordinator_instructions",
            "event_schedule_checks",
            "event_schedule_check_results",
            "coordination_tasks",
        ],
    },
    "Coordinators": {
        "file": "Multivent_ERD_Coordinators.drawio",
        "title": "Coordinators and Curated Packages",
        "color": "#3F51B5",
        "stroke": "#2C3B86",
        "owned": [
            "coordinator_service_profiles",
            "coordinator_packages",
            "coordinator_package_items",
            "event_coordinator_package_selections",
            "event_coordinator_package_services",
            "coordinator_availability",
            "coordinator_assignment_attempts",
        ],
    },
    "Payments": {
        "file": "Multivent_ERD_Payments.drawio",
        "title": "Payments, Ledger, Remittance, and Payouts",
        "color": "#2E7D32",
        "stroke": "#205B24",
        "owned": [
            "payments",
            "financial_transactions",
            "cash_remittances",
            "provider_payment_receipts",
            "provider_payout_accounts",
            "provider_payout_requests",
        ],
    },
    "Reviews_Messaging": {
        "file": "Multivent_ERD_Reviews_Messaging.drawio",
        "title": "Reviews, Messaging, Support, and Administration",
        "color": "#C55A11",
        "stroke": "#91420C",
        "owned": [
            "conversations",
            "conversation_participants",
            "messages",
            "notifications",
            "reviews",
            "coordinator_reviews",
            "event_feedback",
            "service_review_summaries",
            "support_tickets",
            "support_messages",
            "audit_logs",
            "system_settings",
        ],
    },
}

ADMIN_TABLES = {"audit_logs", "system_settings"}
ADMIN_COLOR = "#666666"
ADMIN_STROKE = "#444444"
CONTEXT_COLOR = "#6B7280"
CONTEXT_STROKE = "#4B5563"
EXTERNAL_COLOR = "#374151"
EXTERNAL_STROKE = "#111827"

# Verified from live pg_constraint rows on 2026-10-08. Composite groups are
# deliberately kept intact so their member columns are not misrepresented as
# individually unique.
UNIQUE_CONSTRAINTS = {
    "coordinator_package_items": [("package_id", "service_id")],
    "coordinator_reviews": [("event_id", "coordinator_id", "reviewer_id")],
    "event_coordinator_package_selections": [("event_id",)],
    "event_feedback": [("event_id",)],
    "permissions": [("code",)],
    "provider_payout_accounts": [("provider_id",)],
    "roles": [("name",)],
    "service_categories": [("name",)],
    "service_package_items": [("package_id", "service_id")],
    "support_tickets": [("ticket_number",)],
    "system_settings": [("key",)],
}


# Print-oriented manuscript figures. These repeat context entities visually,
# but never duplicate or alter database tables.
MANUSCRIPT_WIDTH = 1400
MANUSCRIPT_HEIGHT = 990
MANUSCRIPT_TABLE_WIDTH = 565
MANUSCRIPT_HEADER_HEIGHT = 44
MANUSCRIPT_ROW_HEIGHT = 30
MANUSCRIPT_MARKER_WIDTH = 70
MANUSCRIPT_NAME_WIDTH = 355
MANUSCRIPT_TYPE_WIDTH = 140
MANUSCRIPT_TOP = 110
MANUSCRIPT_LEFT = 70
MANUSCRIPT_COLUMN_GAP = 130
MANUSCRIPT_ROW_GAP = 100
MANUSCRIPT_COLUMN_COUNT = 2
MANUSCRIPT_OUTER_MARGIN = 70
MANUSCRIPT_LANE_GAP = 15
MANUSCRIPT_ANCHOR_OFFSET = 7

LEGACY_MANUSCRIPT_FIGURES = [
    {
        "key": "01_user_access",
        "title": "User and Access Management",
        "color": "#315A7D",
        "columns": [
            ["auth.users", "profiles"],
            ["user_roles", "user_permissions"],
            ["roles", "role_permissions", "permissions"],
        ],
    },
    {
        "key": "02_provider_services",
        "title": "Provider and Service Management",
        "color": "#2B6F6A",
        "columns": [
            ["profiles", "provider_profiles"],
            ["provider_service_listing_drafts", "provider_notification_preferences"],
            ["service_categories", "services"],
        ],
    },
    {
        "key": "03_packages_availability",
        "title": "Service Packages and Availability",
        "color": "#2B6F6A",
        "columns": [
            ["provider_profiles", "provider_availability"],
            ["services", "service_packages"],
            ["service_package_items", "provider_operating_hours"],
        ],
    },
    {
        "key": "04_event_planning_budget",
        "title": "Event Planning and Budget Allocation",
        "color": "#6A428F",
        "columns": [
            ["profiles", "events"],
            ["event_requirements", "event_budget_items"],
            ["service_categories", "coordination_tasks"],
        ],
    },
    {
        "key": "05_selection_booking",
        "title": "Event Service Selection",
        "color": "#6A428F",
        "columns": [
            ["profiles", "events"],
            ["event_service_selections", "service_categories"],
            ["services", "provider_profiles", "service_packages"],
        ],
    },
    {
        "key": "06_service_booking",
        "title": "Service Booking",
        "color": "#6A428F",
        "columns": [
            ["profiles", "events"],
            ["bookings"],
            ["services", "provider_profiles", "service_packages"],
        ],
    },
    {
        "key": "06_coordinator_profiles_packages",
        "title": "Coordinator Profiles and Packages",
        "color": "#465DB1",
        "columns": [
            ["profiles", "coordinator_service_profiles", "coordinator_availability"],
            ["coordinator_packages", "coordinator_package_items"],
            ["services"],
        ],
    },
    {
        "key": "07_coordinator_selection",
        "title": "Coordinator Package Selection",
        "color": "#465DB1",
        "columns": [
            ["events", "coordinator_assignment_attempts", "event_coordinator_instructions"],
            ["coordinator_packages", "event_coordinator_package_selections"],
            ["event_coordinator_package_services", "event_service_selections"],
        ],
    },
    {
        "key": "08_payments_earnings",
        "title": "Payment Transactions and Provider Earnings",
        "color": "#39743D",
        "columns": [
            ["profiles", "events"],
            ["payments", "financial_transactions"],
            ["bookings", "provider_profiles"],
        ],
    },
    {
        "key": "08b_cash_remittance",
        "title": "Cash Remittance Verification",
        "color": "#39743D",
        "columns": [
            ["profiles", "events"],
            ["cash_remittances", "payments"],
            ["bookings"],
        ],
    },
    {
        "key": "09_payouts_receipts",
        "title": "Provider Payouts and Payment Receipts",
        "color": "#39743D",
        "columns": [
            ["profiles", "provider_profiles"],
            ["provider_payout_accounts", "provider_payout_requests"],
            ["provider_payment_receipts", "bookings", "events"],
        ],
    },
    {
        "key": "10_reviews_sentiment",
        "title": "Reviews and Sentiment Analysis",
        "color": "#B45519",
        "columns": [
            ["profiles", "provider_profiles"],
            ["services", "reviews", "service_review_summaries"],
            ["event_feedback", "coordinator_reviews"],
        ],
    },
    {
        "key": "11_messaging_notifications",
        "title": "Messaging and Notifications",
        "color": "#B45519",
        "columns": [
            ["profiles", "notifications"],
            ["conversations", "conversation_participants", "messages"],
            ["events", "bookings"],
        ],
    },
    {
        "key": "12_event_execution",
        "title": "Event Schedule Coordination",
        "color": "#6A428F",
        "columns": [
            ["events", "event_service_selections"],
            ["event_schedule_checks", "event_schedule_check_results"],
            ["provider_profiles", "services"],
        ],
    },
    {
        "key": "12b_event_instructions",
        "title": "Event Provider and Coordinator Instructions",
        "color": "#6A428F",
        "columns": [
            ["profiles", "events"],
            ["event_service_selections", "event_provider_instructions"],
            ["event_coordinator_instructions", "provider_profiles", "services"],
        ],
    },
    {
        "key": "13_support_administration",
        "title": "Support and Administration",
        "color": "#666666",
        "columns": [
            ["profiles", "provider_profile_merge_archive"],
            ["support_tickets", "support_messages"],
            ["audit_logs", "system_settings"],
        ],
    },
]

# Focused manuscript figures. Every public table is represented, while dense
# processes are split across pages so table typography and routing corridors
# remain legible at A4 landscape print size.
MANUSCRIPT_FIGURES = [
    {
        "key": "01_user_access",
        "title": "User and Access Management",
        "color": "#315A7D",
        "columns": [
            ["auth.users", "profiles", "user_roles", "user_permissions"],
            ["roles", "role_permissions", "permissions"],
        ],
    },
    {
        "key": "02_provider_onboarding",
        "title": "Provider Profiles and Onboarding",
        "color": "#2B6F6A",
        "columns": [
            ["profiles", "provider_profiles"],
            ["provider_service_listing_drafts", "provider_notification_preferences"],
        ],
    },
    {
        "key": "03_service_catalog",
        "title": "Service Catalog Management",
        "color": "#2B6F6A",
        "columns": [
            ["profiles", "provider_profiles"],
            ["service_categories", "services"],
        ],
    },
    {
        "key": "04_provider_availability",
        "title": "Provider Availability and Operating Hours",
        "color": "#2B6F6A",
        "columns": [
            ["provider_profiles", "services"],
            ["provider_availability", "provider_operating_hours"],
        ],
    },
    {
        "key": "05_service_packages",
        "title": "Service Packages",
        "color": "#2B6F6A",
        "columns": [
            ["profiles", "service_packages"],
            ["services", "service_package_items"],
        ],
    },
    {
        "key": "06_event_requirements",
        "title": "Event Planning and Requirements",
        "color": "#6A428F",
        "columns": [
            ["profiles", "events"],
            ["event_requirements", "service_categories"],
        ],
    },
    {
        "key": "07_budget_tasks",
        "title": "Budget Allocation and Coordination Tasks",
        "color": "#6A428F",
        "columns": [
            ["profiles", "events"],
            ["event_budget_items", "coordination_tasks"],
        ],
    },
    {
        "key": "08_service_selection",
        "title": "Event Service Selection",
        "color": "#6A428F",
        "columns": [
            ["events", "event_service_selections"],
            ["services", "service_categories"],
        ],
    },
    {
        "key": "09_service_booking",
        "title": "Service Booking",
        "color": "#6A428F",
        "columns": [
            ["profiles", "events"],
            ["bookings", "services"],
        ],
    },
    {
        "key": "10_coordinator_profiles",
        "title": "Coordinator Profiles and Availability",
        "color": "#465DB1",
        "columns": [
            ["profiles", "coordinator_service_profiles"],
            ["coordinator_availability", "events"],
        ],
    },
    {
        "key": "11_coordinator_assignment",
        "title": "Coordinator Assignment",
        "color": "#465DB1",
        "columns": [
            ["profiles", "events"],
            ["coordinator_assignment_attempts"],
        ],
    },
    {
        "key": "11b_coordinator_instructions",
        "title": "Coordinator Event Instructions",
        "color": "#465DB1",
        "columns": [
            ["profiles", "events"],
            ["event_coordinator_instructions"],
        ],
    },
    {
        "key": "12_coordinator_packages",
        "title": "Coordinator Packages",
        "color": "#465DB1",
        "columns": [
            ["profiles", "coordinator_packages"],
            ["coordinator_package_items", "services"],
        ],
    },
    {
        "key": "13_coordinator_package_selection",
        "title": "Coordinator Package Selection",
        "color": "#465DB1",
        "columns": [
            ["profiles", "events"],
            ["coordinator_packages", "event_coordinator_package_selections"],
        ],
    },
    {
        "key": "14_coordinator_package_services",
        "title": "Coordinator Package Service Selections",
        "color": "#465DB1",
        "columns": [
            ["coordinator_packages", "event_coordinator_package_selections"],
            ["event_coordinator_package_services", "event_service_selections"],
        ],
    },
    {
        "key": "15_payments",
        "title": "Client Payments",
        "color": "#39743D",
        "columns": [
            ["profiles", "events"],
            ["bookings", "payments"],
        ],
    },
    {
        "key": "16_financial_ledger",
        "title": "Payment Transactions and Provider Earnings",
        "color": "#39743D",
        "columns": [
            ["payments", "bookings"],
            ["financial_transactions", "provider_profiles"],
        ],
    },
    {
        "key": "17_cash_remittance",
        "title": "Cash Remittance and Payment Verification",
        "color": "#39743D",
        "columns": [
            ["events", "bookings"],
            ["payments", "cash_remittances"],
        ],
    },
    {
        "key": "18_provider_payouts",
        "title": "Provider Payout Accounts and Requests",
        "color": "#39743D",
        "columns": [
            ["profiles", "provider_profiles"],
            ["provider_payout_accounts", "provider_payout_requests"],
        ],
    },
    {
        "key": "19_provider_receipts",
        "title": "Provider Payment Receipts",
        "color": "#39743D",
        "columns": [
            ["events", "bookings"],
            ["provider_profiles", "provider_payment_receipts"],
        ],
    },
    {
        "key": "20_reviews_sentiment",
        "title": "Service Reviews and Sentiment Summaries",
        "color": "#B45519",
        "columns": [
            ["provider_profiles", "services"],
            ["reviews", "service_review_summaries"],
        ],
    },
    {
        "key": "21_event_feedback",
        "title": "Event Feedback",
        "color": "#B45519",
        "columns": [
            ["profiles", "events"],
            ["event_feedback"],
        ],
    },
    {
        "key": "21b_coordinator_reviews",
        "title": "Coordinator Reviews",
        "color": "#B45519",
        "columns": [
            ["profiles", "events"],
            ["coordinator_reviews"],
        ],
    },
    {
        "key": "22_messaging",
        "title": "Event Messaging",
        "color": "#B45519",
        "columns": [
            ["profiles", "conversation_participants", "messages"],
            ["events", "conversations"],
        ],
    },
    {
        "key": "23_notifications_support",
        "title": "Notifications and Support",
        "color": "#B45519",
        "columns": [
            ["profiles", "notifications"],
            ["support_tickets", "support_messages"],
        ],
    },
    {
        "key": "24_schedule_checks",
        "title": "Event Schedule Checks",
        "color": "#6A428F",
        "columns": [
            ["profiles", "events"],
            ["event_schedule_checks", "event_schedule_check_results"],
        ],
    },
    {
        "key": "25_schedule_resources",
        "title": "Schedule Check Resources",
        "color": "#6A428F",
        "columns": [
            ["event_schedule_check_results", "event_service_selections"],
            ["provider_profiles", "services"],
        ],
    },
    {
        "key": "26_provider_instructions",
        "title": "Event Provider Instructions",
        "color": "#6A428F",
        "columns": [
            ["events", "event_service_selections"],
            ["event_provider_instructions", "services"],
        ],
    },
    {
        "key": "27_administration",
        "title": "Administration and Audit",
        "color": "#666666",
        "columns": [
            ["profiles", "provider_profile_merge_archive"],
            ["audit_logs", "system_settings"],
        ],
    },
]

MANUSCRIPT_EXTRA_COLUMNS = {
    "profiles": ["full_name", "email", "default_role", "account_status"],
    "provider_profiles": ["business_name", "location", "verification_status"],
    "services": ["name", "base_price", "pricing_model", "status"],
    "events": ["name", "event_type", "event_date", "total_budget"],
    "event_service_selections": ["service_name", "estimated_amount", "status"],
    "bookings": ["requested_date", "amount", "status"],
    "payments": ["amount", "currency", "status", "payment_scope"],
    "financial_transactions": ["transaction_type", "gross_amount", "provider_net_amount", "status"],
    "cash_remittances": ["amount_expected", "amount_received", "status"],
    "provider_payment_receipts": ["amount", "source", "reference_number"],
    "provider_payout_accounts": ["account_type", "institution_name", "ownership_confirmed"],
    "provider_payout_requests": ["amount", "status", "notes"],
    "reviews": ["rating", "comment", "analysis_status", "sentiment_label", "sentiment_score"],
    "event_feedback": ["overall_comment", "analysis_status", "sentiment_label", "sentiment_score"],
    "service_review_summaries": ["sentiment_label", "summary", "source_review_count", "provider"],
    "event_provider_instructions": ["title", "instruction_type", "status"],
    "event_coordinator_instructions": ["title", "status"],
    "support_tickets": ["ticket_number", "category", "subject", "status", "priority"],
    "messages": ["body", "read_at"],
    "notifications": ["title", "body", "status"],
}

MANUSCRIPT_ROUTINE_COLUMNS = {
    "created_at", "updated_at", "deleted_at", "reviewed_at", "analyzed_at",
    "generated_at", "checked_at", "resolved_at", "closed_at", "responded_at",
    "processed_at", "paid_at", "verified_at", "received_at", "requested_at",
    "first_responded_at", "last_message_at", "terms_accepted_at", "archived_at",
    "metadata", "profile_data", "payload", "new_state", "previous_state",
    "selected_provider_snapshot", "last_approved_snapshot", "package_snapshot",
    "catering_option_snapshot", "venue_option_snapshot", "coordinator_pricing_snapshot",
}


def safe_id(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_]", "_", value)


def load_schema() -> dict:
    data = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    if len(data["tables"]) != 51:
        raise ValueError("Expected the verified 51-table public schema snapshot.")
    if sum(len(table["columns"]) for table in data["tables"]) != 569:
        raise ValueError("Expected the verified 569-column public schema snapshot.")
    if len(data["foreign_keys"]) != 115:
        raise ValueError("Expected 115 internal public-schema foreign keys.")
    data["foreign_keys"].append(EXTERNAL_FK.copy())
    return data


def table_map(schema: dict) -> dict[str, dict]:
    tables = {table["name"]: table for table in schema["tables"]}
    tables[EXTERNAL_TABLE["name"]] = EXTERNAL_TABLE
    return tables


def column_map(table: dict) -> dict[str, dict]:
    return {column["name"]: column for column in table["columns"]}


def owner_map(schema: dict) -> dict[str, str]:
    owners = {}
    for module_name, module in MODULES.items():
        for table_name in module["owned"]:
            if table_name in owners:
                raise ValueError(f"Table {table_name} belongs to multiple modules.")
            owners[table_name] = module_name
    public_names = {table["name"] for table in schema["tables"]}
    missing = sorted(public_names - set(owners))
    extra = sorted(set(owners) - public_names)
    if missing or extra:
        raise ValueError(f"Module ownership mismatch. Missing={missing}; extra={extra}")
    return owners


def module_relationships(schema: dict, module_name: str) -> list[dict]:
    owned = set(MODULES[module_name]["owned"])
    return [fk for fk in schema["foreign_keys"] if fk["source_table"] in owned]


def module_tables(schema: dict, module_name: str) -> list[str]:
    owned = MODULES[module_name]["owned"]
    relationships = module_relationships(schema, module_name)
    context = []
    for fk in relationships:
        target = fk["target_table"]
        if target not in owned and target not in context:
            context.append(target)
    return owned + context


def table_height(table: dict) -> int:
    return HEADER_HEIGHT + len(table["columns"]) * ROW_HEIGHT


def manuscript_figure_names(figure: dict) -> list[str]:
    return [name for column in figure["columns"] for name in column]


def manuscript_relationships(schema: dict, figure: dict) -> list[dict]:
    names = set(manuscript_figure_names(figure))
    return [
        fk for fk in schema["foreign_keys"]
        if fk["source_table"] in names and fk["target_table"] in names
    ]


def manuscript_columns(schema: dict, table_name: str, table: dict) -> list[dict]:
    fk_columns = {
        column
        for fk in schema["foreign_keys"]
        if fk["source_table"] == table_name
        for column in fk["source_columns"]
    }
    required = {
        column["name"]
        for column in table["columns"]
        if column["primary_key"] or column["name"] in fk_columns
    }
    extras = MANUSCRIPT_EXTRA_COLUMNS.get(table_name)
    if extras is None:
        extras = [
            column["name"]
            for column in table["columns"]
            if column["name"] not in required
            and column["name"] not in MANUSCRIPT_ROUTINE_COLUMNS
        ][:4]
    selected = required | set(extras)
    return [column for column in table["columns"] if column["name"] in selected]


def manuscript_table_height(columns: list[dict]) -> int:
    return MANUSCRIPT_HEADER_HEIGHT + len(columns) * MANUSCRIPT_ROW_HEIGHT


def layout_manuscript_figure(
    schema: dict,
    figure: dict,
    tables: dict[str, dict],
) -> tuple[dict[str, tuple[int, int, int, int]], dict[str, list[dict]]]:
    positions = {}
    displayed_columns = {}
    names = manuscript_figure_names(figure)
    original_order = {name: index for index, name in enumerate(names)}
    for table_name in names:
        displayed_columns[table_name] = manuscript_columns(
            schema, table_name, tables[table_name]
        )
    desired_column = {
        table_name: column_index
        for column_index, column_tables in enumerate(figure["columns"])
        for table_name in column_tables
    }
    relationship_pairs = [
        (fk["source_table"], fk["target_table"])
        for fk in manuscript_relationships(schema, figure)
    ]
    best_assignment = None
    best_score = None
    usable_height = MANUSCRIPT_HEIGHT - 28 - MANUSCRIPT_TOP
    for assignment in itertools.product(range(MANUSCRIPT_COLUMN_COUNT), repeat=len(names)):
        if set(assignment) != set(range(MANUSCRIPT_COLUMN_COUNT)):
            continue
        counts = [assignment.count(column) for column in range(MANUSCRIPT_COLUMN_COUNT)]
        heights = [
            sum(
                manuscript_table_height(displayed_columns[name])
                for name, assigned in zip(names, assignment)
                if assigned == column
            ) + (counts[column] - 1) * MANUSCRIPT_ROW_GAP
            for column in range(MANUSCRIPT_COLUMN_COUNT)
        ]
        assigned_column = dict(zip(names, assignment))
        same_column_relationships = sum(
            assigned_column[source] == assigned_column[target]
            for source, target in relationship_pairs
        )
        preferred_distance = sum(
            abs(assigned_column[name] - desired_column[name]) for name in names
        )
        overflow = max(max(heights) - usable_height, 0)
        score = (
            overflow,
            max(heights),
            same_column_relationships,
            preferred_distance,
            max(heights) - min(heights),
        )
        if best_score is None or score < best_score:
            best_score = score
            best_assignment = assignment
    if best_assignment is None:
        raise ValueError(f"Unable to lay out manuscript figure {figure['key']}.")
    balanced_columns = [[] for _ in range(MANUSCRIPT_COLUMN_COUNT)]
    for table_name, column_index in zip(names, best_assignment):
        balanced_columns[column_index].append(table_name)
    for column_tables in balanced_columns:
        column_tables.sort(key=lambda name: original_order[name])
    final_column_heights = [
        sum(manuscript_table_height(displayed_columns[name]) for name in column_tables)
        + max(len(column_tables) - 1, 0) * MANUSCRIPT_ROW_GAP
        for column_tables in balanced_columns
    ]
    tallest_column = max(final_column_heights)
    base_top = MANUSCRIPT_TOP + max((usable_height - tallest_column) / 2, 0)
    for column_index, column_tables in enumerate(balanced_columns):
        x = MANUSCRIPT_LEFT + column_index * (
            MANUSCRIPT_TABLE_WIDTH + MANUSCRIPT_COLUMN_GAP
        )
        y = base_top + (tallest_column - final_column_heights[column_index]) / 2
        for table_name in column_tables:
            columns = displayed_columns[table_name]
            height = manuscript_table_height(columns)
            positions[table_name] = (x, y, MANUSCRIPT_TABLE_WIDTH, height)
            y += height + MANUSCRIPT_ROW_GAP
    return positions, displayed_columns


def layout_tables(names: list[str], tables: dict[str, dict]) -> tuple[dict, int, int]:
    columns = 4 if len(names) >= 10 else 3
    columns = min(columns, max(1, len(names)))
    heights = [TOP for _ in range(columns)]
    positions = {}
    for index, name in enumerate(names):
        if index < columns:
            column = index
        else:
            column = min(range(columns), key=lambda item: heights[item])
        height = table_height(tables[name])
        x = LEFT + column * (TABLE_WIDTH + GAP_X)
        y = heights[column]
        positions[name] = (x, y, TABLE_WIDTH, height)
        heights[column] = y + height + GAP_Y
    page_width = LEFT * 2 + columns * TABLE_WIDTH + (columns - 1) * GAP_X
    page_height = max(heights) + 80
    return positions, page_width, page_height


def new_mxfile() -> ET.Element:
    return ET.Element(
        "mxfile",
        {
            "host": "app.diagrams.net",
            "modified": f"{date.today().isoformat()}T00:00:00.000Z",
            "agent": "OpenAI Codex",
            "version": "24.7.17",
            "type": "device",
            "compressed": "false",
        },
    )


def new_diagram(mxfile: ET.Element, diagram_id: str, name: str, width: int, height: int):
    diagram = ET.SubElement(mxfile, "diagram", {"id": diagram_id, "name": name})
    model = ET.SubElement(
        diagram,
        "mxGraphModel",
        {
            "dx": "1422",
            "dy": "794",
            "grid": "1",
            "gridSize": "10",
            "guides": "1",
            "tooltips": "1",
            "connect": "1",
            "arrows": "1",
            "fold": "1",
            "page": "1",
            "pageScale": "1",
            "pageWidth": str(width),
            "pageHeight": str(height),
            "math": "0",
            "shadow": "0",
        },
    )
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
    return diagram, root


def geometry(cell: ET.Element, x=0, y=0, width=0, height=0, relative=False):
    attributes = {
        "x": str(x),
        "y": str(y),
        "width": str(width),
        "height": str(height),
        "as": "geometry",
    }
    if relative:
        attributes["relative"] = "1"
    return ET.SubElement(cell, "mxGeometry", attributes)


def add_vertex(
    root: ET.Element,
    cell_id: str,
    value: str,
    style: str,
    parent: str,
    x: int,
    y: int,
    width: int,
    height: int,
    extra: dict | None = None,
) -> ET.Element:
    attributes = {
        "id": cell_id,
        "value": value,
        "style": style,
        "vertex": "1",
        "parent": parent,
    }
    if extra:
        attributes.update(extra)
    cell = ET.SubElement(root, "mxCell", attributes)
    geometry(cell, x, y, width, height)
    return cell


def row_marker(table_name: str, column: dict, fk_columns: set[str]) -> str:
    markers = []
    if column["primary_key"]:
        markers.append("PK")
    if column["name"] in fk_columns:
        markers.append("FK")
    if not column["primary_key"]:
        for group_number, unique_columns in enumerate(
            UNIQUE_CONSTRAINTS.get(table_name, []), start=1
        ):
            if column["name"] in unique_columns:
                markers.append("UQ" if len(unique_columns) == 1 else f"UQ{group_number}")
    return "/".join(markers)


def table_header_colors(table_name: str, module_name: str, owned: set[str], external=False):
    if external:
        return EXTERNAL_COLOR, EXTERNAL_STROKE
    if table_name not in owned:
        return CONTEXT_COLOR, CONTEXT_STROKE
    if table_name in ADMIN_TABLES:
        return ADMIN_COLOR, ADMIN_STROKE
    module = MODULES[module_name]
    return module["color"], module["stroke"]


def column_cell_id(page_id: str, table_name: str, column_name: str) -> str:
    return f"col_{safe_id(page_id)}_{safe_id(table_name)}_{safe_id(column_name)}"


def anchor_cell_id(page_id: str, table_name: str, column_name: str, side: str) -> str:
    return (
        f"anchor_{safe_id(page_id)}_{safe_id(table_name)}_"
        f"{safe_id(column_name)}_{side.lower()}"
    )


def column_center_y(position: tuple[int, int, int, int], table: dict, column_name: str) -> float:
    index = next(
        index for index, column in enumerate(table["columns"])
        if column["name"] == column_name
    )
    return position[1] + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2


def anchor_point(
    position: tuple[int, int, int, int],
    table: dict,
    column_name: str,
    side: str,
) -> tuple[float, float]:
    x, _, width, _ = position
    anchor_x = x - ANCHOR_OFFSET if side == "L" else x + width + ANCHOR_OFFSET
    return anchor_x, column_center_y(position, table, column_name)


def segment_intersects_rect(
    start: tuple[float, float],
    end: tuple[float, float],
    rect: tuple[int, int, int, int],
    padding: int = 5,
) -> bool:
    x, y, width, height = rect
    left, right = x - padding, x + width + padding
    top, bottom = y - padding, y + height + padding
    x1, y1 = start
    x2, y2 = end
    if abs(y1 - y2) < 0.01:
        return top < y1 < bottom and max(min(x1, x2), left) < min(max(x1, x2), right)
    if abs(x1 - x2) < 0.01:
        return left < x1 < right and max(min(y1, y2), top) < min(max(y1, y2), bottom)
    raise ValueError("Relationship routes must be orthogonal.")


def route_is_clear(
    points: list[tuple[float, float]],
    positions: dict[str, tuple[int, int, int, int]],
    ignored_tables: set[str],
) -> bool:
    for start, end in zip(points, points[1:]):
        for table_name, rect in positions.items():
            if table_name in ignored_tables:
                continue
            if segment_intersects_rect(start, end, rect):
                return False
    return True


def plan_relationship_routes(
    relationships: list[dict],
    positions: dict[str, tuple[int, int, int, int]],
    tables: dict[str, dict],
) -> list[dict]:
    corridor_counts = defaultdict(int)
    endpoint_usage = defaultdict(int)
    table_side_usage = defaultdict(int)
    reserved_vertical_lanes = []
    detour_count = 0
    routes = []

    def claim_vertical_lane(candidate: float, direction: int) -> float:
        while any(abs(candidate - used) < 4 for used in reserved_vertical_lanes):
            candidate += direction * 4
        reserved_vertical_lanes.append(candidate)
        return candidate

    for index, fk in enumerate(relationships, start=1):
        source_name = fk["source_table"]
        target_name = fk["target_table"]
        source_position = positions[source_name]
        target_position = positions[target_name]
        source_center = source_position[0] + source_position[2] / 2
        target_center = target_position[0] + target_position[2] / 2
        if source_name == target_name or abs(source_center - target_center) < 1:
            natural_source_side, natural_target_side = "R", "L"
        elif target_center > source_center:
            natural_source_side, natural_target_side = "R", "L"
        else:
            natural_source_side, natural_target_side = "L", "R"

        def least_used_side(table_name: str, column_name: str, preferred: str) -> str:
            alternate = "L" if preferred == "R" else "R"
            preferred_count = endpoint_usage[(table_name, column_name, preferred)]
            alternate_count = endpoint_usage[(table_name, column_name, alternate)]
            return preferred if preferred_count <= alternate_count else alternate

        source_column = fk["source_columns"][0]
        target_column = fk["target_columns"][0]
        source_side = least_used_side(source_name, source_column, natural_source_side)
        endpoint_usage[(source_name, source_column, source_side)] += 1
        target_side = least_used_side(target_name, target_column, natural_target_side)
        endpoint_usage[(target_name, target_column, target_side)] += 1
        source_lane_number = table_side_usage[(source_name, source_side)]
        table_side_usage[(source_name, source_side)] += 1
        target_lane_number = table_side_usage[(target_name, target_side)]
        table_side_usage[(target_name, target_side)] += 1

        source = anchor_point(
            source_position, tables[source_name], source_column, source_side
        )
        target = anchor_point(
            target_position, tables[target_name], target_column, target_side
        )
        ignored = {source_name, target_name}
        force_detour = (
            source_side != natural_source_side
            or target_side != natural_target_side
            or source_name == target_name
        )

        if source_side == target_side:
            direction = 1 if source_side == "R" else -1
            corridor_key = (
                "vertical",
                source_side,
                round(min(source_center, target_center)),
                round(max(source_center, target_center)),
            )
            corridor_number = corridor_counts[corridor_key]
            corridor_counts[corridor_key] += 1
            lane_offset = corridor_number * 14
            lane_x = (
                (max(source[0], target[0]) if direction > 0 else min(source[0], target[0]))
                + direction * (ROUTE_STUB + lane_offset)
            )
        else:
            corridor_key = (
                "horizontal",
                round(min(source[0], target[0])),
                round(max(source[0], target[0])),
            )
            corridor_number = corridor_counts[corridor_key]
            corridor_counts[corridor_key] += 1
            offset_steps = (0, 1, -1, 2, -2, 3, -3, 4, -4)
            lane_offset = offset_steps[corridor_number % len(offset_steps)] * 14
            lane_x = (source[0] + target[0]) / 2
            lane_x += (lane_offset if source[0] < target[0] else -lane_offset)
            direction = 1 if source[0] <= target[0] else -1
        lane_x = claim_vertical_lane(lane_x, direction)
        points = [source, (lane_x, source[1]), (lane_x, target[1]), target]

        if force_detour or not route_is_clear(points, positions, ignored):
            source_direction = -1 if source_side == "L" else 1
            target_direction = -1 if target_side == "L" else 1
            source_stub = claim_vertical_lane(
                source[0] + source_direction * (ROUTE_STUB + source_lane_number * 14),
                source_direction,
            )
            target_stub = claim_vertical_lane(
                target[0] + target_direction * (ROUTE_STUB + target_lane_number * 14),
                target_direction,
            )
            top_lane = TOP - 50 - detour_count * 16
            detour_count += 1
            points = [
                source,
                (source_stub, source[1]),
                (source_stub, top_lane),
                (target_stub, top_lane),
                (target_stub, target[1]),
                target,
            ]
        if not route_is_clear(points, positions, ignored):
            raise ValueError(f"Unable to route {fk['name']} without crossing a table.")
        routes.append(
            {
                "fk": fk,
                "index": index,
                "source_side": source_side,
                "target_side": target_side,
                "points": points,
            }
        )
    return routes


def route_intersection_metrics(routes: list[dict]) -> dict[str, int]:
    crossings = 0
    overlaps = 0
    long_overlaps = 0
    maximum_overlap = 0
    for route_index, route in enumerate(routes):
        for other in routes[route_index + 1 :]:
            for first_start, first_end in zip(route["points"], route["points"][1:]):
                for second_start, second_end in zip(other["points"], other["points"][1:]):
                    first_horizontal = abs(first_start[1] - first_end[1]) < 0.01
                    second_horizontal = abs(second_start[1] - second_end[1]) < 0.01
                    if first_horizontal != second_horizontal:
                        horizontal = (first_start, first_end) if first_horizontal else (second_start, second_end)
                        vertical = (second_start, second_end) if first_horizontal else (first_start, first_end)
                        left, right = sorted((horizontal[0][0], horizontal[1][0]))
                        top, bottom = sorted((vertical[0][1], vertical[1][1]))
                        if left < vertical[0][0] < right and top < horizontal[0][1] < bottom:
                            crossings += 1
                    elif first_horizontal:
                        if abs(first_start[1] - second_start[1]) < 0.01:
                            first_left, first_right = sorted((first_start[0], first_end[0]))
                            second_left, second_right = sorted((second_start[0], second_end[0]))
                            overlap = min(first_right, second_right) - max(first_left, second_left)
                            if overlap > 0.01:
                                overlaps += 1
                                maximum_overlap = max(maximum_overlap, round(overlap))
                                long_overlaps += overlap > 50
                    elif abs(first_start[0] - second_start[0]) < 0.01:
                        first_top, first_bottom = sorted((first_start[1], first_end[1]))
                        second_top, second_bottom = sorted((second_start[1], second_end[1]))
                        overlap = min(first_bottom, second_bottom) - max(first_top, second_top)
                        if overlap > 0.01:
                            overlaps += 1
                            maximum_overlap = max(maximum_overlap, round(overlap))
                            long_overlaps += overlap > 50
    return {
        "crossings": crossings,
        "overlaps": overlaps,
        "long_overlaps": long_overlaps,
        "maximum_overlap": maximum_overlap,
    }


def manuscript_anchor_point(
    position: tuple[int, int, int, int],
    columns: list[dict],
    column_name: str,
    side: str,
) -> tuple[float, float]:
    index = next(
        index for index, column in enumerate(columns)
        if column["name"] == column_name
    )
    x, y, width, _ = position
    anchor_x = x - MANUSCRIPT_ANCHOR_OFFSET if side == "L" else x + width + MANUSCRIPT_ANCHOR_OFFSET
    anchor_y = y + MANUSCRIPT_HEADER_HEIGHT + index * MANUSCRIPT_ROW_HEIGHT + MANUSCRIPT_ROW_HEIGHT / 2
    return anchor_x, anchor_y


def plan_manuscript_routes(
    relationships: list[dict],
    positions: dict[str, tuple[int, int, int, int]],
    displayed_columns: dict[str, list[dict]],
) -> list[dict]:
    endpoint_usage = defaultdict(int)
    table_side_usage = defaultdict(int)
    reserved_vertical = []
    top_count = 0
    bottom_count = 0
    maximum_bottom = max(y + height for _, y, _, height in positions.values())
    routes = []

    def claim(candidate: float, direction: int) -> float:
        while any(abs(candidate - used) < MANUSCRIPT_LANE_GAP for used in reserved_vertical):
            candidate += direction * MANUSCRIPT_LANE_GAP
        reserved_vertical.append(candidate)
        return candidate

    def choose_side(table_name: str, column_name: str, preferred: str) -> str:
        alternate = "L" if preferred == "R" else "R"
        if endpoint_usage[(table_name, column_name, preferred)] <= endpoint_usage[(table_name, column_name, alternate)]:
            return preferred
        return alternate

    def side_corridor(position: tuple[int, int, int, int], side: str, lane: int) -> float:
        column_index = round(
            (position[0] - MANUSCRIPT_LEFT)
            / (MANUSCRIPT_TABLE_WIDTH + MANUSCRIPT_COLUMN_GAP)
        )
        if side == "L":
            base = 20 if column_index == 0 else position[0] - MANUSCRIPT_COLUMN_GAP / 2
            direction = 1 if column_index == 0 else -1
        else:
            base = MANUSCRIPT_WIDTH - 20 if column_index == MANUSCRIPT_COLUMN_COUNT - 1 else position[0] + position[2] + MANUSCRIPT_COLUMN_GAP / 2
            direction = -1 if column_index == MANUSCRIPT_COLUMN_COUNT - 1 else 1
        offsets = (0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6)
        return base + direction * offsets[lane % len(offsets)] * MANUSCRIPT_LANE_GAP

    for index, fk in enumerate(relationships, start=1):
        source_name = fk["source_table"]
        target_name = fk["target_table"]
        source_position = positions[source_name]
        target_position = positions[target_name]
        source_center = source_position[0] + source_position[2] / 2
        target_center = target_position[0] + target_position[2] / 2
        if target_center > source_center:
            preferred_source, preferred_target = "R", "L"
        elif target_center < source_center:
            preferred_source, preferred_target = "L", "R"
        else:
            preferred_source, preferred_target = "R", "R"
        source_column = fk["source_columns"][0]
        target_column = fk["target_columns"][0]
        source_side = choose_side(source_name, source_column, preferred_source)
        endpoint_usage[(source_name, source_column, source_side)] += 1
        target_side = choose_side(target_name, target_column, preferred_target)
        endpoint_usage[(target_name, target_column, target_side)] += 1

        source = manuscript_anchor_point(
            source_position, displayed_columns[source_name], source_column, source_side
        )
        target = manuscript_anchor_point(
            target_position, displayed_columns[target_name], target_column, target_side
        )
        ignored = {source_name, target_name}
        source_direction = -1 if source_side == "L" else 1
        target_direction = -1 if target_side == "L" else 1
        source_lane = table_side_usage[(source_name, source_side)]
        table_side_usage[(source_name, source_side)] += 1
        target_lane = table_side_usage[(target_name, target_side)]
        table_side_usage[(target_name, target_side)] += 1

        if source_side != target_side:
            lane_x = (source[0] + target[0]) / 2
            lane_direction = 1 if source[0] <= target[0] else -1
        else:
            lane_direction = 1 if source_side == "R" else -1
            outer = max(source[0], target[0]) if lane_direction > 0 else min(source[0], target[0])
            lane_x = outer + lane_direction * (
                18 + max(source_lane, target_lane) * MANUSCRIPT_LANE_GAP
            )
        lane_x = claim(lane_x, lane_direction)
        points = [source, (lane_x, source[1]), (lane_x, target[1]), target]

        force_detour = source_side != preferred_source or target_side != preferred_target
        if force_detour or not route_is_clear(points, positions, ignored):
            source_stub = side_corridor(source_position, source_side, source_lane)
            target_stub = side_corridor(target_position, target_side, target_lane)
            candidates = []
            minimum_top = min(y for _, y, _, _ in positions.values())
            if top_count <= bottom_count:
                candidates.extend([
                    ("top", minimum_top - 18 - top_count * MANUSCRIPT_LANE_GAP),
                    ("bottom", maximum_bottom + 18 + bottom_count * MANUSCRIPT_LANE_GAP),
                ])
            else:
                candidates.extend([
                    ("bottom", maximum_bottom + 18 + bottom_count * MANUSCRIPT_LANE_GAP),
                    ("top", minimum_top - 18 - top_count * MANUSCRIPT_LANE_GAP),
                ])
            chosen = None
            for lane_kind, lane_y in candidates:
                candidate = [
                    source,
                    (source_stub, source[1]),
                    (source_stub, lane_y),
                    (target_stub, lane_y),
                    (target_stub, target[1]),
                    target,
                ]
                if 82 <= lane_y <= MANUSCRIPT_HEIGHT - 34 and route_is_clear(candidate, positions, ignored):
                    chosen = candidate
                    if lane_kind == "top":
                        top_count += 1
                    else:
                        bottom_count += 1
                    break
            if chosen is None:
                raise ValueError(f"Unable to route manuscript relationship {fk['name']}.")
            points = chosen
        if not route_is_clear(points, positions, ignored):
            raise ValueError(f"Manuscript route {fk['name']} crosses an unrelated table.")
        routes.append({
            "fk": fk,
            "index": index,
            "source_side": source_side,
            "target_side": target_side,
            "points": points,
        })

    label_rectangles = []
    table_rectangles = [
        (x - 5, y - 5, width + 10, height + 10)
        for x, y, width, height in positions.values()
    ]

    def overlaps(first, second) -> bool:
        return not (
            first[0] + first[2] <= second[0]
            or second[0] + second[2] <= first[0]
            or first[1] + first[3] <= second[1]
            or second[1] + second[3] <= first[1]
        )

    for route in routes:
        label = route["fk"]["source_columns"][0]
        label_width = max(58, min(210, len(label) * 8 + 18))
        label_height = 22
        candidates = []
        segments = list(zip(route["points"], route["points"][1:]))
        segments.sort(
            key=lambda segment: -(
                abs(segment[1][0] - segment[0][0])
                + abs(segment[1][1] - segment[0][1])
            )
        )
        for start, end in segments:
            horizontal = abs(start[1] - end[1]) < 0.01
            for ratio in (0.5, 0.32, 0.68):
                center_x = start[0] + (end[0] - start[0]) * ratio
                center_y = start[1] + (end[1] - start[1]) * ratio
                offsets = ((0, 0), (0, -14), (0, 14)) if horizontal else ((0, 0), (-18, 0), (18, 0))
                for offset_x, offset_y in offsets:
                    candidates.append((center_x + offset_x, center_y + offset_y))
        chosen = None
        for center_x, center_y in candidates:
            rectangle = (
                center_x - label_width / 2,
                center_y - label_height / 2,
                label_width,
                label_height,
            )
            if (
                rectangle[0] < 8
                or rectangle[1] < 80
                or rectangle[0] + rectangle[2] > MANUSCRIPT_WIDTH - 8
                or rectangle[1] + rectangle[3] > MANUSCRIPT_HEIGHT - 30
                or any(overlaps(rectangle, table) for table in table_rectangles)
                or any(overlaps(rectangle, other) for other in label_rectangles)
            ):
                continue
            chosen = (center_x, center_y)
            label_rectangles.append(rectangle)
            break
        route["label_point"] = chosen
        route["label_width"] = label_width
    return routes


def add_manuscript_table(
    root: ET.Element,
    page_id: str,
    table_name: str,
    table: dict,
    columns: list[dict],
    position: tuple[int, int, int, int],
    fk_columns: set[str],
    color: str,
) -> None:
    x, y, width, height = position
    table_id = f"table_{safe_id(page_id)}_{safe_id(table_name)}"
    table_cell = add_vertex(
        root, table_id, "", "group;html=1;", "1", x, y, width, height,
        {"data-table": table_name, "data-manuscript": "1"},
    )
    table_cell.set("connectable", "0")
    header_color = EXTERNAL_COLOR if table.get("external") else color
    header_style = "dashed=1;dashPattern=5 3;" if table.get("external") else ""
    add_vertex(
        root,
        f"{table_id}_header",
        html.escape(table_name),
        (
            "rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;"
            f"spacingLeft=9;fontSize=18;fontStyle=1;fontColor=#FFFFFF;fillColor={header_color};"
            f"strokeColor=#404040;strokeWidth=1.4;{header_style}"
        ),
        table_id, 0, 0, width, MANUSCRIPT_HEADER_HEIGHT,
    )
    for index, column in enumerate(columns):
        row_y = MANUSCRIPT_HEADER_HEIGHT + index * MANUSCRIPT_ROW_HEIGHT
        row_fill = "#FFFFFF" if index % 2 == 0 else "#F3F4F6"
        marker = row_marker(table_name, column, fk_columns)
        marker_cell = add_vertex(
            root,
            f"{column_cell_id(page_id, table_name, column['name'])}_marker",
            marker,
            (
                "rounded=0;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;"
                f"fontSize=15;fontStyle=1;fontColor=#222222;fillColor={row_fill};"
                "strokeColor=#B8BDC4;strokeWidth=1;"
            ),
            table_id, 0, row_y, MANUSCRIPT_MARKER_WIDTH, MANUSCRIPT_ROW_HEIGHT,
        )
        marker_cell.set("connectable", "0")
        name_cell = add_vertex(
            root,
            column_cell_id(page_id, table_name, column["name"]),
            html.escape(column["name"] + (" ?" if column["nullable"] else "")),
            (
                "rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;"
                f"spacingLeft=8;fontSize=15;fontColor=#111111;fillColor={row_fill};"
                "strokeColor=#B8BDC4;strokeWidth=1;"
            ),
            table_id, MANUSCRIPT_MARKER_WIDTH, row_y,
            MANUSCRIPT_NAME_WIDTH, MANUSCRIPT_ROW_HEIGHT,
            {"data-column-table": table_name, "data-column": column["name"]},
        )
        name_cell.set("connectable", "0")
        type_cell = add_vertex(
            root,
            f"{column_cell_id(page_id, table_name, column['name'])}_type",
            html.escape(column["type"]),
            (
                "rounded=0;whiteSpace=wrap;html=1;align=right;verticalAlign=middle;"
                f"spacingRight=7;fontSize=15;fontColor=#444444;fillColor={row_fill};"
                "strokeColor=#B8BDC4;strokeWidth=1;"
            ),
            table_id, MANUSCRIPT_MARKER_WIDTH + MANUSCRIPT_NAME_WIDTH, row_y,
            MANUSCRIPT_TYPE_WIDTH, MANUSCRIPT_ROW_HEIGHT,
        )
        type_cell.set("connectable", "0")
        for side, anchor_x in (("L", -MANUSCRIPT_ANCHOR_OFFSET - 1), ("R", width + MANUSCRIPT_ANCHOR_OFFSET - 1)):
            anchor = add_vertex(
                root,
                anchor_cell_id(page_id, table_name, column["name"], side),
                "",
                "ellipse;html=1;opacity=0;fillOpacity=0;strokeOpacity=0;perimeter=ellipsePerimeter;",
                table_id, anchor_x, row_y + MANUSCRIPT_ROW_HEIGHT / 2 - 1, 2, 2,
                {
                    "data-anchor-table": table_name,
                    "data-anchor-column": column["name"],
                    "data-anchor-side": side,
                },
            )
            anchor.set("connectable", "1")


def add_manuscript_relationship(root: ET.Element, page_id: str, route: dict) -> None:
    fk = route["fk"]
    child_arrow, parent_arrow = edge_markers(fk)
    source_column = fk["source_columns"][0]
    target_column = fk["target_columns"][0]
    edge = ET.SubElement(root, "mxCell", {
        "id": f"fk_{safe_id(page_id)}_{route['index']}_{safe_id(fk['name'])}",
        "value": "",
        "style": (
            "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;"
            "html=1;strokeColor=#374151;strokeWidth=2.25;jumpStyle=arc;jumpSize=12;"
            f"startArrow={child_arrow};startFill=0;endArrow={parent_arrow};endFill=0;"
            "fontSize=13;fontColor=#1F2937;labelBackgroundColor=#FFFFFF;"
        ),
        "edge": "1",
        "parent": "1",
        "source": anchor_cell_id(page_id, fk["source_table"], source_column, route["source_side"]),
        "target": anchor_cell_id(page_id, fk["target_table"], target_column, route["target_side"]),
        "data-fk": fk["name"],
        "data-source-table": fk["source_table"],
        "data-source-column": source_column,
        "data-target-table": fk["target_table"],
        "data-target-column": target_column,
        "data-route": ";".join(f"{x:.1f},{y:.1f}" for x, y in route["points"]),
        "data-manuscript": "1",
    })
    edge_geometry = geometry(edge, relative=True)
    edge_geometry.set("x", "-0.62")
    waypoint_array = ET.SubElement(edge_geometry, "Array", {"as": "points"})
    for x, y in route["points"][1:-1]:
        ET.SubElement(waypoint_array, "mxPoint", {"x": f"{x:.1f}", "y": f"{y:.1f}"})
    if route.get("label_point") is not None:
        label_x, label_y = route["label_point"]
        label_width = route["label_width"]
        label_cell = add_vertex(
            root,
            f"fk_label_{safe_id(page_id)}_{route['index']}_{safe_id(fk['name'])}",
            html.escape(source_column),
            (
                "text;html=1;align=center;verticalAlign=middle;fontSize=13;"
                "fontColor=#1F2937;fillColor=#FFFFFF;strokeColor=none;spacing=2;"
            ),
            "1",
            label_x - label_width / 2,
            label_y - 11,
            label_width,
            22,
            {"data-fk-label": fk["name"]},
        )
        label_cell.set("connectable", "0")


def add_manuscript_page(mxfile: ET.Element, schema: dict, figure: dict, page_number: int) -> dict:
    tables = table_map(schema)
    names = manuscript_figure_names(figure)
    if not 3 <= len(names) <= 7:
        raise ValueError(f"Manuscript figure {figure['key']} must contain 3-7 entities.")
    positions, displayed_columns = layout_manuscript_figure(schema, figure, tables)
    if any(y + height > MANUSCRIPT_HEIGHT - 28 for _, y, _, height in positions.values()):
        raise ValueError(f"Manuscript figure {figure['key']} exceeds the A4 layout height.")
    relationships = manuscript_relationships(schema, figure)
    routes = plan_manuscript_routes(relationships, positions, displayed_columns)
    page_id = f"manuscript_{figure['key']}"
    _, root = new_diagram(
        mxfile, f"diagram_{safe_id(page_id)}",
        f"Figure {page_number:02d} - {figure['title']}",
        MANUSCRIPT_WIDTH, MANUSCRIPT_HEIGHT,
    )
    add_vertex(
        root, f"title_{safe_id(page_id)}",
        html.escape(f"MULTIVENT ERD - {figure['title']}"),
        "text;html=1;align=center;verticalAlign=middle;fontSize=22;fontStyle=1;fontColor=#111111;strokeColor=none;fillColor=none;",
        "1", 24, 18, MANUSCRIPT_WIDTH - 48, 34,
    )
    add_vertex(
        root, f"subtitle_{safe_id(page_id)}",
        html.escape(
            f"Figure {page_number:02d} | {len(names)} entities | {len(relationships)} foreign-key relationships | selective manuscript attributes"
        ),
        "text;html=1;align=center;verticalAlign=middle;fontSize=11;fontColor=#555555;strokeColor=none;fillColor=none;",
        "1", 24, 54, MANUSCRIPT_WIDTH - 48, 22,
    )
    for route in routes:
        add_manuscript_relationship(root, page_id, route)
    all_fk_columns = defaultdict(set)
    for fk in schema["foreign_keys"]:
        all_fk_columns[fk["source_table"]].update(fk["source_columns"])
    for table_name in names:
        add_manuscript_table(
            root, page_id, table_name, tables[table_name], displayed_columns[table_name],
            positions[table_name], all_fk_columns[table_name], figure["color"],
        )
    add_vertex(
        root, f"note_{safe_id(page_id)}",
        "Selective manuscript view: all PK/FK columns and essential business attributes are shown. See the Complete Technical ERD for every column and relationship.",
        "text;html=1;align=center;verticalAlign=middle;fontSize=10;fontColor=#555555;strokeColor=none;fillColor=none;",
        "1", 24, MANUSCRIPT_HEIGHT - 24, MANUSCRIPT_WIDTH - 48, 16,
    )
    return {
        "page_id": page_id,
        "positions": positions,
        "displayed_columns": displayed_columns,
        "relationships": relationships,
        "routes": routes,
    }


def add_table(
    root: ET.Element,
    page_id: str,
    module_name: str,
    table_name: str,
    table: dict,
    position: tuple[int, int, int, int],
    fk_columns: set[str],
    owned: set[str],
) -> None:
    x, y, width, height = position
    table_id = f"table_{safe_id(page_id)}_{safe_id(table_name)}"
    table_cell = add_vertex(
        root,
        table_id,
        "",
        "group;html=1;",
        "1",
        x,
        y,
        width,
        height,
        {"data-table": table_name},
    )
    table_cell.set("connectable", "0")
    fill, stroke = table_header_colors(
        table_name, module_name, owned, table.get("external", False)
    )
    header_value = html.escape(table_name)
    external_style = "dashed=1;dashPattern=6 4;" if table.get("external") else ""
    add_vertex(
        root,
        f"{table_id}_header",
        header_value,
        (
            "rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;"
            f"spacingLeft=12;fontSize=18;fontStyle=1;fontColor=#FFFFFF;fillColor={fill};"
            f"strokeColor={stroke};strokeWidth=2;{external_style}"
        ),
        table_id,
        0,
        0,
        width,
        HEADER_HEIGHT,
    )
    for index, column in enumerate(table["columns"]):
        row_y = HEADER_HEIGHT + index * ROW_HEIGHT
        row_fill = "#FFFFFF" if index % 2 == 0 else "#F4F6F8"
        marker = row_marker(table_name, column, fk_columns)
        marker_cell = add_vertex(
            root,
            f"{column_cell_id(page_id, table_name, column['name'])}_marker",
            marker,
            (
                "rounded=0;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;"
                f"fontSize=15;fontStyle=1;fontColor=#333333;fillColor={row_fill};"
                "strokeColor=#B7BDC5;strokeWidth=1;"
            ),
            table_id,
            0,
            row_y,
            MARKER_WIDTH,
            ROW_HEIGHT,
        )
        marker_cell.set("connectable", "0")
        name_value = html.escape(column["name"] + (" ?" if column["nullable"] else ""))
        name_cell = add_vertex(
            root,
            column_cell_id(page_id, table_name, column["name"]),
            name_value,
            (
                "rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;"
                f"spacingLeft=12;fontSize=15;fontColor=#111111;fillColor={row_fill};"
                "strokeColor=#B7BDC5;strokeWidth=1;"
            ),
            table_id,
            MARKER_WIDTH,
            row_y,
            NAME_WIDTH,
            ROW_HEIGHT,
            {"data-column-table": table_name, "data-column": column["name"]},
        )
        name_cell.set("connectable", "0")
        type_cell = add_vertex(
            root,
            f"{column_cell_id(page_id, table_name, column['name'])}_type",
            html.escape(column["type"]),
            (
                "rounded=0;whiteSpace=wrap;html=1;align=right;verticalAlign=middle;"
                f"spacingRight=12;fontSize=15;fontColor=#4B5563;fillColor={row_fill};"
                "strokeColor=#B7BDC5;strokeWidth=1;"
            ),
            table_id,
            MARKER_WIDTH + NAME_WIDTH,
            row_y,
            TYPE_WIDTH,
            ROW_HEIGHT,
        )
        type_cell.set("connectable", "0")
        for side, anchor_x in (("L", -ANCHOR_OFFSET - 1), ("R", width + ANCHOR_OFFSET - 1)):
            anchor = add_vertex(
                root,
                anchor_cell_id(page_id, table_name, column["name"], side),
                "",
                (
                    "ellipse;html=1;opacity=0;fillOpacity=0;strokeOpacity=0;"
                    "perimeter=ellipsePerimeter;"
                ),
                table_id,
                anchor_x,
                row_y + ROW_HEIGHT / 2 - 1,
                2,
                2,
                {
                    "data-anchor-table": table_name,
                    "data-anchor-column": column["name"],
                    "data-anchor-side": side,
                },
            )
            anchor.set("connectable", "1")


def edge_markers(fk: dict) -> tuple[str, str]:
    child = "ERzeroToOne" if fk.get("source_unique") else "ERzeroToMany"
    parent = "ERzeroToOne" if fk.get("source_nullable") else "ERone"
    return child, parent


def add_relationship(root: ET.Element, page_id: str, route: dict) -> None:
    fk = route["fk"]
    index = route["index"]
    child_arrow, parent_arrow = edge_markers(fk)
    source_column = fk["source_columns"][0]
    target_column = fk["target_columns"][0]
    source_id = anchor_cell_id(
        page_id, fk["source_table"], source_column, route["source_side"]
    )
    target_id = anchor_cell_id(
        page_id, fk["target_table"], target_column, route["target_side"]
    )
    label = ", ".join(fk["source_columns"])
    attributes = {
        "id": f"fk_{safe_id(page_id)}_{index}_{safe_id(fk['name'])}",
        "value": html.escape(label),
        "style": (
            "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;"
            "html=1;strokeColor=#4B5563;strokeWidth=1.5;jumpStyle=arc;jumpSize=10;"
            f"startArrow={child_arrow};startFill=0;endArrow={parent_arrow};endFill=0;"
            "fontSize=13;fontColor=#374151;labelBackgroundColor=#FFFFFF;"
        ),
        "edge": "1",
        "parent": "1",
        "source": source_id,
        "target": target_id,
        "data-fk": fk["name"],
        "data-source-table": fk["source_table"],
        "data-source-column": source_column,
        "data-target-table": fk["target_table"],
        "data-target-column": target_column,
        "data-route": ";".join(f"{x:.1f},{y:.1f}" for x, y in route["points"]),
    }
    edge = ET.SubElement(root, "mxCell", attributes)
    edge_geometry = geometry(edge, relative=True)
    edge_geometry.set("x", "-0.72")
    waypoint_array = ET.SubElement(edge_geometry, "Array", {"as": "points"})
    for x, y in route["points"][1:-1]:
        ET.SubElement(waypoint_array, "mxPoint", {"x": f"{x:.1f}", "y": f"{y:.1f}"})


def add_page_title(root: ET.Element, page_id: str, title: str, subtitle: str, width: int):
    add_vertex(
        root,
        f"title_{safe_id(page_id)}",
        html.escape(f"MULTIVENT ERD — {title}"),
        (
            "text;html=1;align=center;verticalAlign=middle;fontSize=24;fontStyle=1;"
            "fontColor=#111111;strokeColor=none;fillColor=none;"
        ),
        "1",
        40,
        24,
        width - 80,
        42,
    )
    add_vertex(
        root,
        f"subtitle_{safe_id(page_id)}",
        html.escape(subtitle),
        (
            "text;html=1;align=center;verticalAlign=middle;fontSize=12;"
            "fontColor=#555555;strokeColor=none;fillColor=none;"
        ),
        "1",
        40,
        72,
        width - 80,
        28,
    )


def add_module_page(mxfile: ET.Element, schema: dict, module_name: str, diagram_name=None):
    tables = table_map(schema)
    names = module_tables(schema, module_name)
    relationships = module_relationships(schema, module_name)
    positions, width, height = layout_tables(names, tables)
    page_id = module_name
    _, root = new_diagram(
        mxfile,
        f"diagram_{safe_id(page_id)}",
        diagram_name or MODULES[module_name]["title"],
        width,
        height,
    )
    owned = set(MODULES[module_name]["owned"])
    add_page_title(
        root,
        page_id,
        MODULES[module_name]["title"],
        (
            f"{len(owned)} primary tables · {len(names) - len(owned)} context tables · "
            f"{len(relationships)} foreign-key relationships"
        ),
        width,
    )
    routes = plan_relationship_routes(relationships, positions, tables)
    for route in routes:
        add_relationship(root, page_id, route)
    fk_columns = defaultdict(set)
    for fk in schema["foreign_keys"]:
        fk_columns[fk["source_table"]].update(fk["source_columns"])
    for name in names:
        add_table(
            root,
            page_id,
            module_name,
            name,
            tables[name],
            positions[name],
            fk_columns[name],
            owned,
        )
    legend = (
        "PK = primary key · FK = foreign key · UQ = unique · ? = nullable · "
        "Colored headers = module-owned · Gray headers = context · "
        "Crow's Foot endpoints are derived from FK nullability and uniqueness · "
        "connectors use exterior row anchors and orthogonal routed lanes"
    )
    add_vertex(
        root,
        f"legend_{safe_id(page_id)}",
        html.escape(legend),
        (
            "text;html=1;align=center;verticalAlign=middle;fontSize=12;"
            "fontColor=#555555;strokeColor=none;fillColor=none;"
        ),
        "1",
        40,
        height - 52,
        width - 80,
        26,
    )


def add_overview_page(mxfile: ET.Element, schema: dict):
    width, height = 1900, 1120
    _, root = new_diagram(mxfile, "diagram_overview", "Overview", width, height)
    add_page_title(
        root,
        "overview",
        "Complete Database Overview",
        "51 public tables · 569 columns · 116 foreign keys (115 internal + 1 external)",
        width,
    )
    positions = [
        (100, 170),
        (700, 170),
        (1300, 170),
        (100, 580),
        (700, 580),
        (1300, 580),
    ]
    for (module_name, module), (x, y) in zip(MODULES.items(), positions):
        relationships = module_relationships(schema, module_name)
        context_count = len(module_tables(schema, module_name)) - len(module["owned"])
        lines = "<br>".join(html.escape(name) for name in module["owned"])
        value = (
            f"<b>{html.escape(module['title'])}</b><br><br>{lines}<br><br>"
            f"<font color=\"#555555\">{len(module['owned'])} primary tables · "
            f"{context_count} context · {len(relationships)} FK relationships</font>"
        )
        add_vertex(
            root,
            f"overview_{safe_id(module_name)}",
            value,
            (
                "rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;"
                f"spacing=14;fontSize=12;fontColor=#111111;fillColor=#FFFFFF;"
                f"strokeColor={module['color']};strokeWidth=3;"
            ),
            "1",
            x,
            y,
            500,
            330,
        )
    add_vertex(
        root,
        "overview_note",
        (
            "Each following page owns a non-overlapping set of source tables. Context tables are repeated "
            "only where needed, so every real foreign key is drawn exactly once across the detailed pages."
        ),
        (
            "text;html=1;align=center;verticalAlign=middle;fontSize=11;"
            "fontColor=#444444;strokeColor=none;fillColor=none;"
        ),
        "1",
        180,
        1010,
        1540,
        44,
    )


def write_xml(root: ET.Element, path: Path) -> None:
    ET.indent(root, space="  ")
    tree = ET.ElementTree(root)
    tree.write(path, encoding="utf-8", xml_declaration=True, short_empty_elements=True)


def pdf_color(value: str):
    from reportlab.lib.colors import HexColor
    return HexColor(value)


def pdf_point(x: float, y: float) -> tuple[float, float]:
    from reportlab.lib.pagesizes import A4, landscape
    page_width, page_height = landscape(A4)
    return x * page_width / MANUSCRIPT_WIDTH, page_height - y * page_height / MANUSCRIPT_HEIGHT


def draw_pdf_cardinality(pdf, endpoint, adjacent, kind: str) -> None:
    ex, ey = pdf_point(*endpoint)
    ax, ay = pdf_point(*adjacent)
    dx, dy = ax - ex, ay - ey
    length = math.hypot(dx, dy) or 1
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    pdf.setStrokeColor(pdf_color("#374151"))
    pdf.setLineWidth(1.5)

    def at(distance, spread=0):
        return ex + ux * distance + px * spread, ey + uy * distance + py * spread

    if "Many" in kind:
        tip = at(1.5)
        for spread in (-4.2, 0, 4.2):
            pdf.line(*tip, *at(8.5, spread))
        circle_center = at(12)
        pdf.setFillColor(pdf_color("#FFFFFF"))
        pdf.circle(circle_center[0], circle_center[1], 2.4, stroke=1, fill=1)
    else:
        for distance in ((4.0, 8.0) if "zero" in kind.lower() else (4.5,)):
            pdf.line(*at(distance, -4), *at(distance, 4))
        if "zero" in kind.lower():
            circle_center = at(12)
            pdf.setFillColor(pdf_color("#FFFFFF"))
            pdf.circle(circle_center[0], circle_center[1], 2.4, stroke=1, fill=1)


def fitted_pdf_text(
    pdf,
    value: str,
    font_name: str,
    font_size: float,
    width: float,
    minimum: float = 7.5,
) -> float:
    from reportlab.pdfbase.pdfmetrics import stringWidth
    size = font_size
    while size > minimum and stringWidth(value, font_name, size) > width:
        size -= 0.25
    return size


def split_pdf_header(value: str, width: float, font_size: float) -> list[str]:
    from reportlab.pdfbase.pdfmetrics import stringWidth
    if stringWidth(value, "Helvetica-Bold", font_size) <= width:
        return [value]
    parts = value.split("_")
    best = None
    for index in range(1, len(parts)):
        first = "_".join(parts[:index]) + "_"
        second = "_".join(parts[index:])
        score = max(
            stringWidth(first, "Helvetica-Bold", font_size),
            stringWidth(second, "Helvetica-Bold", font_size),
        )
        if best is None or score < best[0]:
            best = (score, first, second)
    return [best[1], best[2]] if best else [value]


def draw_manuscript_pdf_page(pdf, schema: dict, figure: dict, payload: dict, page_number: int) -> None:
    from reportlab.lib.pagesizes import A4, landscape
    page_width, page_height = landscape(A4)
    scale_x = page_width / MANUSCRIPT_WIDTH
    scale_y = page_height / MANUSCRIPT_HEIGHT
    tables = table_map(schema)
    pdf.setFillColor(pdf_color("#FFFFFF"))
    pdf.rect(0, 0, page_width, page_height, stroke=0, fill=1)

    title = f"MULTIVENT ERD - {figure['title']}"
    title_size = fitted_pdf_text(
        pdf, title, "Helvetica-Bold", 16.5, page_width - 36, minimum=11
    )
    pdf.setFont("Helvetica-Bold", title_size)
    pdf.setFillColor(pdf_color("#111111"))
    pdf.drawCentredString(page_width / 2, page_height - 30, title)
    subtitle = (
        f"Figure {page_number:02d} | {len(manuscript_figure_names(figure))} entities | "
        f"{len(payload['relationships'])} foreign-key relationships | selective manuscript attributes"
    )
    subtitle_size = fitted_pdf_text(
        pdf, subtitle, "Helvetica", 8.25, page_width - 44, minimum=6.25
    )
    pdf.setFont("Helvetica", subtitle_size)
    pdf.setFillColor(pdf_color("#555555"))
    pdf.drawCentredString(
        page_width / 2,
        page_height - 45,
        subtitle,
    )

    for route in payload["routes"]:
        points = [pdf_point(x, y) for x, y in route["points"]]
        pdf.setStrokeColor(pdf_color("#374151"))
        pdf.setLineWidth(1.55)
        for start, end in zip(points, points[1:]):
            pdf.line(start[0], start[1], end[0], end[1])

    crossing_points = set()
    routes = payload["routes"]
    for route_index, route in enumerate(routes):
        for other in routes[route_index + 1:]:
            for first_start, first_end in zip(route["points"], route["points"][1:]):
                for second_start, second_end in zip(other["points"], other["points"][1:]):
                    first_horizontal = abs(first_start[1] - first_end[1]) < 0.01
                    second_horizontal = abs(second_start[1] - second_end[1]) < 0.01
                    if first_horizontal == second_horizontal:
                        continue
                    horizontal = (first_start, first_end) if first_horizontal else (second_start, second_end)
                    vertical = (second_start, second_end) if first_horizontal else (first_start, first_end)
                    left, right = sorted((horizontal[0][0], horizontal[1][0]))
                    top, bottom = sorted((vertical[0][1], vertical[1][1]))
                    crossing_x = vertical[0][0]
                    crossing_y = horizontal[0][1]
                    if left < crossing_x < right and top < crossing_y < bottom:
                        crossing_points.add((round(crossing_x, 2), round(crossing_y, 2)))
    for crossing_x, crossing_y in crossing_points:
        x, y = pdf_point(crossing_x, crossing_y)
        pdf.setFillColor(pdf_color("#FFFFFF"))
        pdf.circle(x, y, 4.0, stroke=0, fill=1)
        pdf.setStrokeColor(pdf_color("#374151"))
        pdf.setLineWidth(1.55)
        pdf.arc(x - 5, y - 4, x + 5, y + 4, 0, 180)

    for route in payload["routes"]:
        points = [pdf_point(x, y) for x, y in route["points"]]
        child, parent = edge_markers(route["fk"])
        draw_pdf_cardinality(pdf, route["points"][0], route["points"][1], child)
        draw_pdf_cardinality(pdf, route["points"][-1], route["points"][-2], parent)
        if route.get("label_point") is None:
            continue
        label = route["fk"]["source_columns"][0]
        label_x, label_y = pdf_point(*route["label_point"])
        pdf.setFont("Helvetica", 9)
        label_width = pdf.stringWidth(label, "Helvetica", 9) + 6
        label_x = max(label_width / 2 + 4, min(page_width - label_width / 2 - 4, label_x))
        label_y = max(22, min(page_height - 64, label_y))
        pdf.setFillColor(pdf_color("#FFFFFF"))
        pdf.rect(label_x - label_width / 2, label_y - 5, label_width, 11, stroke=0, fill=1)
        pdf.setFillColor(pdf_color("#1F2937"))
        pdf.drawCentredString(label_x, label_y - 3, label)

    all_fk_columns = defaultdict(set)
    for fk in schema["foreign_keys"]:
        all_fk_columns[fk["source_table"]].update(fk["source_columns"])
    for table_name in manuscript_figure_names(figure):
        x, y, width, height = payload["positions"][table_name]
        columns = payload["displayed_columns"][table_name]
        left = x * scale_x
        top = page_height - y * scale_y
        table_width = width * scale_x
        header_height = MANUSCRIPT_HEADER_HEIGHT * scale_y
        row_height = MANUSCRIPT_ROW_HEIGHT * scale_y
        header_color = EXTERNAL_COLOR if tables[table_name].get("external") else figure["color"]
        pdf.setStrokeColor(pdf_color("#404040"))
        pdf.setLineWidth(0.9)
        pdf.setFillColor(pdf_color(header_color))
        pdf.rect(left, top - header_height, table_width, header_height, stroke=1, fill=1)
        header_lines = split_pdf_header(table_name, table_width - 12, 13.5)
        pdf.setFillColor(pdf_color("#FFFFFF"))
        pdf.setFont("Helvetica-Bold", 13.5)
        if len(header_lines) == 1:
            pdf.drawString(left + 7, top - header_height / 2 - 4.5, header_lines[0])
        else:
            pdf.drawString(left + 7, top - 13.5, header_lines[0])
            pdf.drawString(left + 7, top - 27.5, header_lines[1])

        marker_width = MANUSCRIPT_MARKER_WIDTH * scale_x
        name_width = MANUSCRIPT_NAME_WIDTH * scale_x
        type_width = MANUSCRIPT_TYPE_WIDTH * scale_x
        for row_index, column in enumerate(columns):
            row_top = top - header_height - row_index * row_height
            row_bottom = row_top - row_height
            fill = "#FFFFFF" if row_index % 2 == 0 else "#F3F4F6"
            pdf.setFillColor(pdf_color(fill))
            pdf.setStrokeColor(pdf_color("#B8BDC4"))
            pdf.setLineWidth(0.45)
            pdf.rect(left, row_bottom, marker_width, row_height, stroke=1, fill=1)
            pdf.rect(left + marker_width, row_bottom, name_width, row_height, stroke=1, fill=1)
            pdf.rect(left + marker_width + name_width, row_bottom, type_width, row_height, stroke=1, fill=1)
            marker = row_marker(table_name, column, all_fk_columns[table_name])
            pdf.setFillColor(pdf_color("#222222"))
            marker_size = fitted_pdf_text(pdf, marker, "Helvetica-Bold", 11.25, marker_width - 4)
            pdf.setFont("Helvetica-Bold", marker_size)
            pdf.drawCentredString(left + marker_width / 2, row_bottom + row_height / 2 - marker_size / 3, marker)
            column_label = column["name"] + (" ?" if column["nullable"] else "")
            name_size = fitted_pdf_text(pdf, column_label, "Helvetica", 11.25, name_width - 10)
            pdf.setFont("Helvetica", name_size)
            pdf.setFillColor(pdf_color("#111111"))
            pdf.drawString(left + marker_width + 5, row_bottom + row_height / 2 - name_size / 3, column_label)
            type_size = fitted_pdf_text(pdf, column["type"], "Helvetica", 11.25, type_width - 8)
            pdf.setFont("Helvetica", type_size)
            pdf.setFillColor(pdf_color("#444444"))
            pdf.drawRightString(left + table_width - 4, row_bottom + row_height / 2 - type_size / 3, column["type"])

    footer = "Selective manuscript view: all PK/FK columns and essential attributes are shown. Full schema: Complete Technical ERD."
    footer_size = fitted_pdf_text(
        pdf, footer, "Helvetica", 7.2, page_width - 28, minimum=6
    )
    pdf.setFont("Helvetica", footer_size)
    pdf.setFillColor(pdf_color("#555555"))
    pdf.drawCentredString(
        page_width / 2, 10,
        footer,
    )


def render_manuscript_pdf(
    path: Path,
    schema: dict,
    figure_payloads: list[tuple[dict, dict]],
    start_page_number: int = 1,
) -> None:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.pdfgen import canvas
    pdf = canvas.Canvas(str(path), pagesize=landscape(A4), pageCompression=1)
    pdf.setTitle("MULTIVENT Manuscript ERD")
    pdf.setAuthor("MULTIVENT Capstone Project")
    for page_number, (figure, payload) in enumerate(
        figure_payloads, start=start_page_number
    ):
        draw_manuscript_pdf_page(pdf, schema, figure, payload, page_number)
        pdf.showPage()
    pdf.save()


def write_manuscript_report(schema: dict, figure_payloads: list[tuple[dict, dict]]) -> None:
    tables = table_map(schema)
    occurrence_count = defaultdict(int)
    for figure, _ in figure_payloads:
        for table_name in manuscript_figure_names(figure):
            if table_name != "auth.users":
                occurrence_count[table_name] += 1
    repeated = sorted(
        ((name, count) for name, count in occurrence_count.items() if count > 1),
        key=lambda item: (-item[1], item[0]),
    )
    lines = [
        "# MULTIVENT Manuscript ERD Completeness and Accuracy Report",
        "",
        f"Generated: {date.today().isoformat()}",
        "",
        "## Summary",
        "",
        "- Public database tables: **51**",
        "- Public-to-public foreign keys: **115**",
        "- External Auth foreign key: **1** (`profiles.id -> auth.users.id`)",
        "- Total actual foreign-key constraints retained by the Complete Technical ERD: **116**",
        f"- Manuscript figures: **{len(figure_payloads)}**",
        "- Public tables represented in at least one manuscript figure: **51 of 51**",
        "- Manuscript pages intentionally show selective attributes; they do not contain every database column.",
        "- No database table, column, constraint, policy, function, or application file was changed by this documentation export.",
        "",
        "## Repeated reference entities",
        "",
        ", ".join(f"`{name}` ({count} figures)" for name, count in repeated),
        "",
        "## Figure inventory and omissions",
        "",
    ]
    for page_number, (figure, payload) in enumerate(figure_payloads, start=1):
        names = manuscript_figure_names(figure)
        name_set = set(names)
        displayed = payload["displayed_columns"]
        omitted_relationships = [
            fk for fk in schema["foreign_keys"]
            if fk["source_table"] in name_set and fk["target_table"] not in name_set
        ]
        lines.extend([
            f"### Figure {page_number:02d}: {figure['title']}",
            "",
            f"- Entities ({len(names)}): " + ", ".join(f"`{name}`" for name in names),
            f"- Relationships displayed: **{len(payload['relationships'])}**",
            "- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):",
            "",
        ])
        route_by_fk = {route["fk"]["name"]: route for route in payload["routes"]}
        for fk in payload["relationships"]:
            route = route_by_fk[fk["name"]]
            label_note = "" if route.get("label_point") is not None else " — connector label suppressed; mapping retained here"
            lines.append(
                f"  - `{fk['source_table']}.{','.join(fk['source_columns'])} -> "
                f"{fk['target_table']}.{','.join(fk['target_columns'])}`{label_note}"
            )
        lines.extend([
            "",
            "- Non-key attributes omitted from this focused view:",
            "",
        ])
        for table_name in names:
            shown = {column["name"] for column in displayed[table_name]}
            omitted = [
                column["name"] for column in tables[table_name]["columns"]
                if column["name"] not in shown
                and not column["primary_key"]
                and not any(
                    column["name"] in fk["source_columns"]
                    for fk in schema["foreign_keys"]
                    if fk["source_table"] == table_name
                )
            ]
            lines.append(
                f"  - `{table_name}`: " + (", ".join(f"`{name}`" for name in omitted) if omitted else "None")
            )
        lines.extend(["", "- Relationships omitted from this focused figure:", ""])
        if omitted_relationships:
            for fk in omitted_relationships:
                lines.append(
                    f"  - `{fk['source_table']}.{','.join(fk['source_columns'])} -> "
                    f"{fk['target_table']}.{','.join(fk['target_columns'])}`"
                )
        else:
            lines.append("  - None")
        lines.append("")
    lines.extend([
        "## Complete Technical ERD confirmation",
        "",
        "`Multivent_Complete_ERD.drawio` and `Multivent_Complete_ERD.xml` retain all 51 public tables, all 569 public-table columns, and all 116 actual foreign-key relationships. The selective omissions listed above apply only to the manuscript-focused figures.",
        "",
    ])
    (OUTPUT_DIR / "MANUSCRIPT_ERD_REPORT.md").write_text("\n".join(lines), encoding="utf-8")


def isolated_tables(schema: dict) -> list[str]:
    related = set()
    for fk in schema["foreign_keys"]:
        if fk["source_table"] != "auth.users":
            related.add(fk["source_table"])
        if fk["target_table"] != "auth.users":
            related.add(fk["target_table"])
    public_names = {table["name"] for table in schema["tables"]}
    return sorted(public_names - related)


def write_readme(schema: dict) -> None:
    isolated = isolated_tables(schema)
    tables = table_map(schema)
    generated_files = [
        "Multivent_Complete_ERD.drawio",
        "Multivent_Complete_ERD.xml",
        "Multivent_Manuscript_ERD.drawio",
        "Multivent_Manuscript_ERD.pdf",
        "MANUSCRIPT_ERD_REPORT.md",
        *[module["file"] for module in MODULES.values()],
        "ERD_README.md",
    ]
    module_lines = []
    for module_name, module in MODULES.items():
        module_lines.append(
            f"- `{module['file']}` — {module['title']} "
            f"({len(module['owned'])} primary tables, "
            f"{len(module_tables(schema, module_name)) - len(module['owned'])} context tables)."
        )
    routing_lines = []
    for module_name, module in MODULES.items():
        names = module_tables(schema, module_name)
        positions, _, _ = layout_tables(names, tables)
        routes = plan_relationship_routes(
            module_relationships(schema, module_name), positions, tables
        )
        metrics = route_intersection_metrics(routes)
        routing_lines.append(
            f"| {module['title']} | {len(routes)} | {metrics['crossings']} | "
            f"{metrics['overlaps']} | {metrics['long_overlaps']} | "
            f"{metrics['maximum_overlap']} |"
        )
    content = f"""# Multivent ERD Documentation

## Database

- Platform: Supabase PostgreSQL
- Schema documented: `public`
- External system reference shown: `auth.users`
- Generation date: {date.today().isoformat()}

## Verified schema totals

- Total public tables: **51**
- Total public-table columns: **569**
- Total foreign keys: **116**
  - Public-to-public foreign keys: **115**
- Public-to-external foreign keys: **1** (`profiles.id -> auth.users.id`)
- Total relationships drawn across the six detailed pages: **116**

## Generated files

{chr(10).join(f'- `{name}`' for name in generated_files)}

## Focused diagrams

{chr(10).join(module_lines)}

The complete `.drawio` file contains an overview page followed by all six detailed module pages. The `.xml` file is an identical native diagrams.net document. Each focused `.drawio` file contains its corresponding detailed page.

## Manuscript ERD package

- `Multivent_Manuscript_ERD.drawio` contains **{len(MANUSCRIPT_FIGURES)}** named, editable pages designed for an A4 landscape manuscript layout.
- `Multivent_Manuscript_ERD.pdf` is the matching **{len(MANUSCRIPT_FIGURES)}-page** vector PDF export.
- `manuscript/` contains one editable `.drawio` file and one print-ready `.pdf` file per figure.
- `MANUSCRIPT_ERD_REPORT.md` documents table coverage, repeated reference entities, selective attribute omissions, and relationships omitted from each focused figure.

The manuscript figures intentionally display all primary-key and foreign-key columns plus selected business attributes. Routine timestamps, metadata, snapshots, and other nonessential attributes may be omitted from an individual figure. The Complete Technical ERD remains the authoritative all-column and all-relationship documentation.

## Schema source and verification

The source of truth was the connected Supabase PostgreSQL project. On {date.today().isoformat()}, a read-only catalog check reported **51 tables**, **569 columns**, and **116 foreign keys**. The column fingerprint returned by the live catalog was `ec3f02f326b0eb43576e86b043f13d0c`.

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
{chr(10).join(routing_lines)}

## Tables with no foreign-key relationships

{', '.join(f'`{name}`' for name in isolated) if isolated else 'None.'}

## External references

- `profiles.id -> auth.users.id` is the only external foreign-key reference. Only `auth.users.id` is displayed because the external Auth schema is not application-owned.

## Ambiguities and limitations

- PostgreSQL foreign keys define child-to-parent validity, nullability, and uniqueness, but they do not require a parent row to have at least one child. Therefore child multiplicities are rendered as zero-to-one or zero-to-many, while the parent endpoint is zero-or-one for nullable FKs and exactly one for non-nullable FKs.
- Unique indicators were reconciled against live `pg_constraint` rows. Composite primary keys mark every participating column, and composite unique constraints use matching numbered `UQn` markers rather than incorrectly implying that each member column is independently unique.
- No relationships were omitted. The six module pages partition relationship ownership by source table, so every one of the 116 live constraints is drawn exactly once in the complete file.
- A diagrams.net desktop/CLI renderer was not installed in the workspace. For privacy, the schema was not uploaded to the external diagrams.net viewer. Local-only previews of the complete overview and all six technical module pages were inspected. The {len(MANUSCRIPT_FIGURES)}-page manuscript PDF was rendered at its actual A4 landscape dimensions and every page was inspected for text legibility, clipping, table spacing, Crow's Foot clearance, connector placement, and visible bridge arcs. The deliverables were also validated as well-formed native draw.io XML with valid connector endpoints, complete declared coverage, and non-overlapping table geometry. They are not claimed as having been opened by the official diagrams.net renderer.

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
"""
    README_PATH.write_text(content, encoding="utf-8")


def rectangles_overlap(a: tuple[float, float, float, float], b: tuple[float, float, float, float]):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by


def style_values(style: str) -> dict[str, str]:
    values = {}
    for item in style.split(";"):
        if "=" in item:
            key, value = item.split("=", 1)
            values[key] = value
    return values


def parsed_route(cell: ET.Element) -> list[tuple[float, float]]:
    return [
        tuple(float(value) for value in point.split(","))
        for point in cell.get("data-route", "").split(";")
        if point
    ]


def validate_drawio(path: Path, schema: dict, complete=False) -> dict:
    tree = ET.parse(path)
    root = tree.getroot()
    if root.tag != "mxfile" or root.get("compressed") != "false":
        raise ValueError(f"{path.name} is not an uncompressed native mxfile.")
    diagrams = root.findall("diagram")
    expected_pages = 7 if complete else 1
    if len(diagrams) != expected_pages:
        raise ValueError(f"{path.name}: expected {expected_pages} pages, found {len(diagrams)}.")

    all_table_names = set()
    all_column_pairs = set()
    all_fk_names = []
    checked_routes = 0
    for diagram in diagrams:
        model = diagram.find("mxGraphModel")
        graph_root = model.find("root") if model is not None else None
        if graph_root is None:
            raise ValueError(f"{path.name}: diagram {diagram.get('name')} has no graph root.")
        cells = graph_root.findall("mxCell")
        page_width = float(model.get("pageWidth", "0"))
        page_height = float(model.get("pageHeight", "0"))
        ids = {cell.get("id") for cell in cells}
        rectangles = []
        table_rectangles = {
            cell.get("data-table"): tuple(
                float(cell.find("mxGeometry").get(key, "0"))
                for key in ("x", "y", "width", "height")
            )
            for cell in cells
            if cell.get("data-table")
        }
        routes_seen = set()
        for cell in cells:
            if cell.get("data-table"):
                all_table_names.add(cell.get("data-table"))
                geo = cell.find("mxGeometry")
                rect = tuple(float(geo.get(key, "0")) for key in ("x", "y", "width", "height"))
                rectangles.append((cell.get("data-table"), rect))
                table_rectangles[cell.get("data-table")] = rect
            if cell.get("data-column-table"):
                all_column_pairs.add((cell.get("data-column-table"), cell.get("data-column")))
            if cell.get("data-fk"):
                all_fk_names.append(cell.get("data-fk"))
                if cell.get("source") not in ids or cell.get("target") not in ids:
                    raise ValueError(f"{path.name}: broken connector {cell.get('data-fk')}.")
                source_anchor = next(item for item in cells if item.get("id") == cell.get("source"))
                target_anchor = next(item for item in cells if item.get("id") == cell.get("target"))
                if (
                    source_anchor.get("data-anchor-table") != cell.get("data-source-table")
                    or source_anchor.get("data-anchor-column") != cell.get("data-source-column")
                    or target_anchor.get("data-anchor-table") != cell.get("data-target-table")
                    or target_anchor.get("data-anchor-column") != cell.get("data-target-column")
                ):
                    raise ValueError(f"{path.name}: {cell.get('data-fk')} is attached to the wrong row anchor.")
                edge_style = style_values(cell.get("style", ""))
                if edge_style.get("jumpStyle") != "arc" or edge_style.get("jumpSize") != "10":
                    raise ValueError(f"{path.name}: {cell.get('data-fk')} has no line-jump styling.")
                if edge_style.get("fontSize") not in {"12", "13"}:
                    raise ValueError(f"{path.name}: relationship label typography is incorrect.")
                route = parsed_route(cell)
                if len(route) < 4:
                    raise ValueError(f"{path.name}: {cell.get('data-fk')} has no explicit orthogonal route.")
                if any(
                    x < 0 or x > page_width or y < 110 or y > page_height
                    for x, y in route
                ):
                    raise ValueError(
                        f"{path.name}: {cell.get('data-fk')} leaves the page or title-safe routing area."
                    )
                route_key = tuple(route)
                if route_key in routes_seen:
                    raise ValueError(f"{path.name}: duplicate relationship lane for {cell.get('data-fk')}.")
                routes_seen.add(route_key)
                ignored = {cell.get("data-source-table"), cell.get("data-target-table")}
                if not route_is_clear(route, table_rectangles, ignored):
                    raise ValueError(f"{path.name}: {cell.get('data-fk')} crosses an unrelated table.")
                checked_routes += 1
        for cell in cells:
            cell_id = cell.get("id", "")
            styles = style_values(cell.get("style", ""))
            value = html.unescape(cell.get("value", ""))
            if cell_id.endswith("_header"):
                if styles.get("fontSize") != "18":
                    raise ValueError(f"{path.name}: table header typography is incorrect.")
                if "[RLS" in value:
                    raise ValueError(f"{path.name}: RLS text remains in a table header.")
                if len(value) * 9.5 > TABLE_WIDTH - 24:
                    raise ValueError(f"{path.name}: table header may overflow: {value}")
            if cell.get("data-column"):
                if styles.get("fontSize") != "15":
                    raise ValueError(f"{path.name}: column typography is incorrect.")
                if len(value) * 8 > NAME_WIDTH - 24:
                    raise ValueError(f"{path.name}: column name may overflow: {value}")
            if cell_id.endswith("_marker"):
                if styles.get("fontSize") != "15":
                    raise ValueError(f"{path.name}: PK/FK typography is incorrect.")
                if len(value) * 8 > MARKER_WIDTH - 12:
                    raise ValueError(f"{path.name}: key marker may overflow: {value}")
            if cell_id.endswith("_type"):
                if styles.get("fontSize") != "15":
                    raise ValueError(f"{path.name}: data-type typography is incorrect.")
                if len(value) * 8 > TYPE_WIDTH - 24:
                    raise ValueError(f"{path.name}: data type may overflow: {value}")
            if cell.get("data-anchor-table"):
                parent = next(item for item in cells if item.get("id") == cell.get("parent"))
                table_geo = parent.find("mxGeometry")
                anchor_geo = cell.find("mxGeometry")
                table_width = float(table_geo.get("width"))
                anchor_x = float(anchor_geo.get("x")) + 1
                side = cell.get("data-anchor-side")
                expected = -ANCHOR_OFFSET if side == "L" else table_width + ANCHOR_OFFSET
                if abs(anchor_x - expected) > 0.01:
                    raise ValueError(f"{path.name}: row anchor is not outside the table boundary.")
        for index, (name_a, rect_a) in enumerate(rectangles):
            for name_b, rect_b in rectangles[index + 1 :]:
                if rectangles_overlap(rect_a, rect_b):
                    raise ValueError(
                        f"{path.name}: overlapping tables {name_a} and {name_b} on {diagram.get('name')}."
                    )

    if complete:
        expected_tables = {table["name"] for table in schema["tables"]}
        expected_columns = {
            (table["name"], column["name"])
            for table in schema["tables"]
            for column in table["columns"]
        }
        expected_fks = {fk["name"] for fk in schema["foreign_keys"]}
        if not expected_tables.issubset(all_table_names):
            raise ValueError(f"Missing tables: {sorted(expected_tables - all_table_names)}")
        if not expected_columns.issubset(all_column_pairs):
            raise ValueError(f"Missing columns: {sorted(expected_columns - all_column_pairs)[:20]}")
        if set(all_fk_names) != expected_fks or len(all_fk_names) != len(expected_fks):
            raise ValueError(
                f"FK coverage mismatch: drawn={len(all_fk_names)}, unique={len(set(all_fk_names))}, "
                f"expected={len(expected_fks)}"
            )
    return {
        "pages": len(diagrams),
        "tables_seen": len(all_table_names),
        "columns_seen": len(all_column_pairs),
        "relationships": len(all_fk_names),
        "routes_checked": checked_routes,
    }


def validate_manuscript_drawio(path: Path, schema: dict) -> dict:
    document = ET.parse(path).getroot()
    if document.tag != "mxfile" or document.get("compressed") != "false":
        raise ValueError("The manuscript ERD must be an uncompressed native mxfile.")
    diagrams = document.findall("diagram")
    if len(diagrams) != len(MANUSCRIPT_FIGURES):
        raise ValueError("The manuscript ERD page count is incorrect.")
    tables = table_map(schema)
    relationship_total = 0
    public_coverage = set()
    for diagram, figure in zip(diagrams, MANUSCRIPT_FIGURES):
        model = diagram.find("mxGraphModel")
        if model is None or int(model.get("pageWidth", "0")) != MANUSCRIPT_WIDTH or int(model.get("pageHeight", "0")) != MANUSCRIPT_HEIGHT:
            raise ValueError(f"{diagram.get('name')} is not A4-landscape-oriented.")
        graph = model.find("root")
        cells = graph.findall("mxCell")
        ids = {cell.get("id") for cell in cells}
        expected_names = manuscript_figure_names(figure)
        table_cells = [cell for cell in cells if cell.get("data-table")]
        actual_names = [cell.get("data-table") for cell in table_cells]
        if set(actual_names) != set(expected_names) or not 3 <= len(actual_names) <= 7:
            raise ValueError(f"{diagram.get('name')} has an incorrect entity set.")
        public_coverage.update(name for name in actual_names if name != "auth.users")
        positions = {}
        for cell in table_cells:
            geo = cell.find("mxGeometry")
            rect = tuple(float(geo.get(key, "0")) for key in ("x", "y", "width", "height"))
            positions[cell.get("data-table")] = rect
            x, y, width, height = rect
            if (
                x < MANUSCRIPT_OUTER_MARGIN - 1
                or y < MANUSCRIPT_TOP
                or x + width > MANUSCRIPT_WIDTH - MANUSCRIPT_OUTER_MARGIN + 1
                or y + height > MANUSCRIPT_HEIGHT - 28
            ):
                raise ValueError(f"{diagram.get('name')}: {cell.get('data-table')} is clipped.")
        for index, first in enumerate(actual_names):
            for second in actual_names[index + 1:]:
                if rectangles_overlap(positions[first], positions[second]):
                    raise ValueError(f"{diagram.get('name')}: overlapping entities {first}, {second}.")
                first_x, first_y, first_width, first_height = positions[first]
                second_x, second_y, second_width, second_height = positions[second]
                vertical_overlap = min(first_y + first_height, second_y + second_height) - max(first_y, second_y)
                horizontal_overlap = min(first_x + first_width, second_x + second_width) - max(first_x, second_x)
                if vertical_overlap > 0:
                    horizontal_gap = max(
                        second_x - (first_x + first_width),
                        first_x - (second_x + second_width),
                    )
                    if horizontal_gap < 100:
                        raise ValueError(f"{diagram.get('name')}: horizontal entity gap is below 100px.")
                if horizontal_overlap > 0:
                    vertical_gap = max(
                        second_y - (first_y + first_height),
                        first_y - (second_y + second_height),
                    )
                    if vertical_gap < 90:
                        raise ValueError(f"{diagram.get('name')}: vertical entity gap is below 90px.")

        expected_columns = {
            (table_name, column["name"])
            for table_name in expected_names
            for column in manuscript_columns(schema, table_name, tables[table_name])
        }
        actual_columns = {
            (cell.get("data-column-table"), cell.get("data-column"))
            for cell in cells if cell.get("data-column-table")
        }
        if actual_columns != expected_columns:
            raise ValueError(f"{diagram.get('name')}: selective column coverage mismatch.")
        for cell in cells:
            styles = style_values(cell.get("style", ""))
            if cell.get("id", "").endswith("_header"):
                if styles.get("fontSize") != "18" or "[RLS" in html.unescape(cell.get("value", "")):
                    raise ValueError(f"{diagram.get('name')}: invalid table header typography.")
            if cell.get("data-column") and styles.get("fontSize") != "15":
                raise ValueError(f"{diagram.get('name')}: invalid column typography.")
            if cell.get("id", "").endswith("_marker") and styles.get("fontSize") != "15":
                raise ValueError(f"{diagram.get('name')}: invalid key typography.")
            if cell.get("id", "").endswith("_type") and styles.get("fontSize") != "15":
                raise ValueError(f"{diagram.get('name')}: invalid type typography.")

        expected_relationships = {fk["name"] for fk in manuscript_relationships(schema, figure)}
        edge_cells = [cell for cell in cells if cell.get("data-fk")]
        actual_relationships = {cell.get("data-fk") for cell in edge_cells}
        if actual_relationships != expected_relationships or len(edge_cells) != len(expected_relationships):
            raise ValueError(f"{diagram.get('name')}: relationship coverage mismatch.")
        relationship_total += len(edge_cells)
        for cell in edge_cells:
            if cell.get("source") not in ids or cell.get("target") not in ids:
                raise ValueError(f"{diagram.get('name')}: broken relationship endpoint.")
            source = next(item for item in cells if item.get("id") == cell.get("source"))
            target = next(item for item in cells if item.get("id") == cell.get("target"))
            if (
                source.get("data-anchor-table") != cell.get("data-source-table")
                or source.get("data-anchor-column") != cell.get("data-source-column")
                or target.get("data-anchor-table") != cell.get("data-target-table")
                or target.get("data-anchor-column") != cell.get("data-target-column")
            ):
                raise ValueError(f"{diagram.get('name')}: relationship attached to the wrong row.")
            style = style_values(cell.get("style", ""))
            if (
                style.get("fontSize") != "13"
                or style.get("jumpStyle") != "arc"
                or style.get("strokeColor") != "#374151"
                or style.get("strokeWidth") != "2.25"
            ):
                raise ValueError(f"{diagram.get('name')}: relationship style mismatch.")
            route = parsed_route(cell)
            if len(route) < 4 or any(
                x < 0 or x > MANUSCRIPT_WIDTH or y < 76 or y > MANUSCRIPT_HEIGHT
                for x, y in route
            ):
                raise ValueError(f"{diagram.get('name')}: invalid print-page route.")
            ignored = {cell.get("data-source-table"), cell.get("data-target-table")}
            if not route_is_clear(route, positions, ignored):
                raise ValueError(f"{diagram.get('name')}: route crosses an unrelated entity.")
        label_cells = [cell for cell in cells if cell.get("data-fk-label")]
        label_rectangles = []
        for label_cell in label_cells:
            geo = label_cell.find("mxGeometry")
            rectangle = tuple(float(geo.get(key, "0")) for key in ("x", "y", "width", "height"))
            if any(rectangles_overlap(rectangle, table_rect) for table_rect in positions.values()):
                raise ValueError(f"{diagram.get('name')}: relationship label overlaps an entity.")
            if any(rectangles_overlap(rectangle, other) for other in label_rectangles):
                raise ValueError(f"{diagram.get('name')}: relationship labels overlap.")
            label_rectangles.append(rectangle)
    expected_public = {table["name"] for table in schema["tables"]}
    if public_coverage != expected_public:
        raise ValueError(f"Manuscript public-table coverage mismatch: {sorted(expected_public - public_coverage)}")
    return {
        "pages": len(diagrams),
        "public_tables_covered": len(public_coverage),
        "relationship_instances": relationship_total,
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    MANUSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
    for generated_path in MANUSCRIPT_DIR.iterdir():
        if (
            generated_path.is_file()
            and generated_path.name.startswith("Figure_")
            and generated_path.suffix.lower() in {".drawio", ".pdf"}
        ):
            generated_path.unlink()
    schema = load_schema()
    owner_map(schema)

    complete = new_mxfile()
    add_overview_page(complete, schema)
    for module_name in MODULES:
        add_module_page(complete, schema, module_name)
    write_xml(complete, COMPLETE_DRAWIO)
    shutil.copyfile(COMPLETE_DRAWIO, COMPLETE_XML)

    for module_name, module in MODULES.items():
        module_file = new_mxfile()
        add_module_page(module_file, schema, module_name)
        write_xml(module_file, OUTPUT_DIR / module["file"])

    manuscript = new_mxfile()
    figure_payloads = []
    individual_pdf_paths = []
    for page_number, figure in enumerate(MANUSCRIPT_FIGURES, start=1):
        payload = add_manuscript_page(manuscript, schema, figure, page_number)
        figure_payloads.append((figure, payload))
        file_stem = f"Figure_{page_number:02d}_{safe_id(figure['title']).strip('_')}"
        individual = new_mxfile()
        add_manuscript_page(individual, schema, figure, page_number)
        write_xml(individual, MANUSCRIPT_DIR / f"{file_stem}.drawio")
        individual_pdf = MANUSCRIPT_DIR / f"{file_stem}.pdf"
        render_manuscript_pdf(
            individual_pdf, schema, [(figure, payload)], start_page_number=page_number
        )
        individual_pdf_paths.append(individual_pdf)
    write_xml(manuscript, MANUSCRIPT_DRAWIO)
    render_manuscript_pdf(MANUSCRIPT_PDF, schema, figure_payloads)
    write_manuscript_report(schema, figure_payloads)

    write_readme(schema)
    complete_result = validate_drawio(COMPLETE_DRAWIO, schema, complete=True)
    if COMPLETE_DRAWIO.read_bytes() != COMPLETE_XML.read_bytes():
        raise ValueError("The complete .drawio and .xml files must be identical.")
    for module in MODULES.values():
        validate_drawio(OUTPUT_DIR / module["file"], schema, complete=False)
    manuscript_result = validate_manuscript_drawio(MANUSCRIPT_DRAWIO, schema)
    for pdf_path in [MANUSCRIPT_PDF, *individual_pdf_paths]:
        if pdf_path.stat().st_size < 1000 or not pdf_path.read_bytes().startswith(b"%PDF"):
            raise ValueError(f"Invalid manuscript PDF export: {pdf_path.name}")

    print(json.dumps({
        "output": str(OUTPUT_DIR),
        "complete": complete_result,
        "manuscript": manuscript_result,
        "manuscript_pdf_exports": 1 + len(individual_pdf_paths),
    }, indent=2))


if __name__ == "__main__":
    main()
