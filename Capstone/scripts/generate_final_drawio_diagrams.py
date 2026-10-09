"""Generate final, native, editable draw.io diagrams for the MULTIVENT manuscript.

The generator is intentionally deterministic and uses the verified public-schema
snapshot. It creates one multipage file plus independently editable one-page
files. No application, database, or manuscript content is modified.
"""

from __future__ import annotations

import copy
import json
import math
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "docs" / "erd_exports" / "live_public_schema.json"
OUTPUT_DIR = ROOT / "docs" / "diagrams" / "final-drawio"
COMBINED_PATH = OUTPUT_DIR / "MULTIVENT_ALL_DIAGRAMS.drawio"
README_PATH = OUTPUT_DIR / "README.md"
VALIDATION_PATH = OUTPUT_DIR / "DIAGRAM_VALIDATION.md"

FONT = "Arial"
INK = "#202020"
MUTED = "#555555"
BORDER = "#606060"
LIGHT_BORDER = "#A8A8A8"
LIGHT = "#F4F4F4"
LIGHTER = "#FAFAFA"
WHITE = "#FFFFFF"

EXTERNAL_TABLE = {
    "name": "auth.users",
    "comment": "Supabase Auth identity table (external schema context).",
    "rls_enabled": True,
    "external": True,
    "columns": [
        {"name": "id", "type": "uuid", "unique": True, "nullable": False, "primary_key": True}
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

FOCUSED_ERDS = [
    ("05_ERD_Identity_Access", "MULTIVENT ERD - Identity and Access", [
        "auth.users", "profiles", "roles", "permissions", "role_permissions",
        "user_roles", "user_permissions", "provider_profile_merge_archive",
    ]),
    ("06_ERD_Providers_Services", "MULTIVENT ERD - Providers and Services", [
        "profiles", "provider_profiles", "service_categories", "services",
        "service_packages", "service_package_items", "provider_availability",
        "provider_operating_hours", "provider_notification_preferences",
        "provider_service_listing_drafts",
    ]),
    ("07_ERD_Events_Budget", "MULTIVENT ERD - Events and Budget Allocation", [
        "profiles", "events", "event_requirements", "event_budget_items",
        "service_categories", "coordination_tasks", "event_schedule_checks",
        "event_schedule_check_results",
    ]),
    ("08_ERD_Selection_Booking", "MULTIVENT ERD - Service Selection and Booking", [
        "profiles", "events", "provider_profiles", "service_categories", "services",
        "service_packages", "event_service_selections", "event_provider_instructions",
        "bookings",
    ]),
    ("09_ERD_Coordinators_Packages", "MULTIVENT ERD - Coordinators and Packages", [
        "profiles", "events", "coordinator_service_profiles", "coordinator_availability",
        "coordinator_assignment_attempts", "coordinator_packages",
        "coordinator_package_items", "event_coordinator_package_selections",
        "event_coordinator_package_services", "event_service_selections", "services",
    ]),
    ("10_ERD_Payments_Ledger_Payouts", "MULTIVENT ERD - Payments, Ledger, and Payouts", [
        "profiles", "provider_profiles", "events", "bookings", "payments",
        "financial_transactions", "cash_remittances", "provider_payment_receipts",
        "provider_payout_accounts", "provider_payout_requests",
    ]),
    ("11_ERD_Messaging_Notifications", "MULTIVENT ERD - Messaging and Notifications", [
        "profiles", "events", "bookings", "conversations",
        "conversation_participants", "messages", "notifications",
    ]),
    ("12_ERD_Reviews_Sentiment", "MULTIVENT ERD - Reviews and Sentiment Analysis", [
        "profiles", "provider_profiles", "services", "bookings", "reviews",
        "service_review_summaries", "event_feedback", "coordinator_reviews", "events",
    ]),
    ("13_ERD_Support_Administration", "MULTIVENT ERD - Support and Administration", [
        "profiles", "roles", "permissions", "user_roles", "user_permissions",
        "support_tickets", "support_messages", "audit_logs", "system_settings",
        "events", "bookings",
    ]),
]

CONDENSED_TABLES = [
    "auth.users", "profiles", "provider_profiles", "service_categories", "services",
    "events", "event_budget_items", "event_service_selections", "bookings",
    "coordinator_service_profiles", "coordinator_packages", "coordinator_package_items",
    "payments", "financial_transactions", "reviews",
]

CONDENSED_BUSINESS = {
    "profiles": ["full_name", "default_role", "account_status"],
    "provider_profiles": ["business_name", "verification_status"],
    "service_categories": ["name", "is_active"],
    "services": ["name", "base_price", "pricing_unit", "status", "is_available"],
    "events": ["name", "event_type", "event_date", "guest_count", "total_budget", "status"],
    "event_budget_items": ["category_key", "allocated_amount", "status"],
    "event_service_selections": ["service_name", "estimated_amount", "status", "category_key"],
    "bookings": ["amount", "provider_amount", "status", "requested_date"],
    "coordinator_service_profiles": ["coordination_fee", "is_accepting_bookings"],
    "coordinator_packages": ["name", "event_type", "status"],
    "coordinator_package_items": ["position"],
    "payments": ["amount", "payment_scope", "status", "platform_fee_amount"],
    "financial_transactions": ["gross_amount", "commission_amount", "provider_net_amount", "provider_funds_status"],
    "reviews": ["rating", "sentiment", "analysis_status"],
}


def sid(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_]+", "_", value).strip("_")


def compact_type(value: str) -> str:
    return (value.replace("timestamp with time zone", "timestamptz")
                 .replace("timestamp without time zone", "timestamp")
                 .replace("character varying", "varchar"))


def xml_text(value: str) -> str:
    # ElementTree performs XML escaping when serializing attributes. Preserve
    # Draw.io's supported HTML markup so labels render instead of showing tags.
    return value.replace("\n", "<br>")


@dataclass
class Box:
    x: float
    y: float
    w: float
    h: float


class Page:
    def __init__(self, page_id: str, name: str, width: int = 1600, height: int = 1000):
        self.page_id = page_id
        self.name = name
        self.width = width
        self.height = height
        self.diagram = ET.Element("diagram", {"id": page_id, "name": name})
        self.model = ET.SubElement(self.diagram, "mxGraphModel", {
            "dx": "1422", "dy": "794", "grid": "1", "gridSize": "10",
            "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1",
            "fold": "1", "page": "1", "pageScale": "1",
            "pageWidth": str(width), "pageHeight": str(height),
            "math": "0", "shadow": "0", "background": WHITE,
        })
        self.root = ET.SubElement(self.model, "root")
        ET.SubElement(self.root, "mxCell", {"id": "0"})
        ET.SubElement(self.root, "mxCell", {"id": "1", "parent": "0"})
        self.ids = {"0", "1"}
        self.major_boxes: dict[str, Box] = {}
        self.edge_count = 0

    def cell(self, cell_id: str, value: str, style: str, x: float, y: float,
             w: float, h: float, parent: str = "1", connectable: bool = True,
             major: bool = False) -> ET.Element:
        if cell_id in self.ids:
            raise ValueError(f"Duplicate cell id on {self.name}: {cell_id}")
        self.ids.add(cell_id)
        attrs = {"id": cell_id, "value": value, "style": style,
                 "vertex": "1", "parent": parent}
        if not connectable:
            attrs["connectable"] = "0"
        cell = ET.SubElement(self.root, "mxCell", attrs)
        ET.SubElement(cell, "mxGeometry", {
            "x": f"{x:.2f}", "y": f"{y:.2f}", "width": f"{w:.2f}",
            "height": f"{h:.2f}", "as": "geometry",
        })
        if major and parent == "1":
            self.major_boxes[cell_id] = Box(x, y, w, h)
        return cell

    def title(self, title: str, subtitle: str = "") -> None:
        self.cell(f"{self.page_id}_title", xml_text(title),
                  f"text;html=1;align=center;verticalAlign=middle;fontFamily={FONT};fontSize=20;fontStyle=1;fontColor={INK};strokeColor=none;fillColor=none;",
                  50, 24, self.width - 100, 34, connectable=False)
        if subtitle:
            self.cell(f"{self.page_id}_subtitle", xml_text(subtitle),
                      f"text;html=1;align=center;verticalAlign=middle;fontFamily={FONT};fontSize=13;fontColor={MUTED};strokeColor=none;fillColor=none;",
                      80, 59, self.width - 160, 28, connectable=False)

    def box(self, cell_id: str, label: str, x: float, y: float, w: float, h: float,
            *, kind: str = "component", parent: str = "1", major: bool = True) -> ET.Element:
        styles = {
            "component": f"rounded=1;arcSize=8;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;fontFamily={FONT};fontSize=15;fontColor={INK};fillColor={WHITE};strokeColor={BORDER};strokeWidth=2;spacing=8;",
            "external": f"rounded=0;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;fontFamily={FONT};fontSize=15;fontColor={INK};fillColor={LIGHT};strokeColor={INK};strokeWidth=2;spacing=8;",
            "process": f"ellipse;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;fontFamily={FONT};fontSize=15;fontColor={INK};fillColor={WHITE};strokeColor={INK};strokeWidth=2;spacing=8;",
            "datastore": f"shape=datastore;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;fontFamily={FONT};fontSize=14;fontColor={INK};fillColor={WHITE};strokeColor={INK};strokeWidth=2;spacing=8;",
            "boundary": f"rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;fontFamily={FONT};fontSize=16;fontStyle=1;fontColor={INK};fillColor=none;strokeColor={BORDER};strokeWidth=2;dashed=1;spacingTop=12;spacingLeft=14;",
            "note": f"shape=note;whiteSpace=wrap;html=1;align=left;verticalAlign=top;fontFamily={FONT};fontSize=13;fontColor={INK};fillColor={LIGHTER};strokeColor={LIGHT_BORDER};strokeWidth=1.5;spacing=10;",
            "screen": f"rounded=1;arcSize=5;whiteSpace=wrap;html=1;align=left;verticalAlign=top;fontFamily={FONT};fontSize=14;fontColor={INK};fillColor={WHITE};strokeColor={INK};strokeWidth=2;spacing=12;",
        }
        return self.cell(cell_id, xml_text(label), styles[kind], x, y, w, h,
                         parent=parent, major=major)

    def actor(self, cell_id: str, label: str, x: float, y: float, w: float = 90,
              h: float = 120) -> ET.Element:
        return self.cell(cell_id, xml_text(label),
                         f"shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;fontFamily={FONT};fontSize=14;fontColor={INK};fillColor={WHITE};strokeColor={INK};strokeWidth=2;",
                         x, y, w, h, major=True)

    def edge(self, source: str, target: str, label: str = "", *, dashed: bool = False,
             arrow: bool = True, points: list[tuple[float, float]] | None = None,
             style_extra: str = "") -> ET.Element:
        self.edge_count += 1
        edge_id = f"{self.page_id}_edge_{self.edge_count}"
        style = (
            f"edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
            f"fontFamily={FONT};fontSize=13;fontColor={INK};labelBackgroundColor={WHITE};"
            f"strokeColor={INK};strokeWidth=2;endArrow={'block' if arrow else 'none'};endFill=1;"
            f"{'dashed=1;dashPattern=6 4;' if dashed else ''}{style_extra}"
        )
        cell = ET.SubElement(self.root, "mxCell", {
            "id": edge_id, "value": xml_text(label), "style": style, "edge": "1",
            "parent": "1", "source": source, "target": target,
        })
        self.ids.add(edge_id)
        geometry = ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
        if points:
            array = ET.SubElement(geometry, "Array", {"as": "points"})
            for x, y in points:
                ET.SubElement(array, "mxPoint", {"x": f"{x:.2f}", "y": f"{y:.2f}"})
        return cell


def write_mxfile(path: Path, pages: list[Page]) -> None:
    mxfile = ET.Element("mxfile", {
        "host": "app.diagrams.net", "modified": "2026-10-09T00:00:00.000Z",
        "agent": "OpenAI Codex", "version": "24.7.17", "type": "device",
        "compressed": "false", "pages": str(len(pages)),
    })
    for page in pages:
        mxfile.append(copy.deepcopy(page.diagram))
    ET.indent(mxfile, space="  ")
    path.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' +
                    ET.tostring(mxfile, encoding="unicode") + "\n", encoding="utf-8")


def load_schema() -> tuple[dict[str, dict], list[dict]]:
    payload = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    tables = {table["name"]: table for table in payload["tables"]}
    tables[EXTERNAL_TABLE["name"]] = EXTERNAL_TABLE
    fks = [fk for fk in payload["foreign_keys"] if fk["name"] != "profiles_id_fkey"]
    fks.append(EXTERNAL_FK)
    return tables, fks


def component_page(page_id: str, name: str, title: str, subtitle: str = "",
                   width: int = 1600, height: int = 1000) -> Page:
    page = Page(page_id, name, width, height)
    page.title(title, subtitle)
    return page


def build_high_level() -> Page:
    p = component_page("architecture", "3.6 High-Level System Architecture",
                       "MULTIVENT - High-Level System Architecture",
                       "Implemented client, managed backend, protected NLP service, and external model provider")
    p.box("actors", "SYSTEM USERS<br><b>Client</b><br><b>Service Provider</b><br><b>Event Coordinator</b><br><b>Authorized Staff</b>", 55, 245, 220, 360, kind="external")
    p.box("expo", "<b>EXPO APPLICATION</b><br>React Native / TypeScript<br>Android · iOS · Web<br><br>Role-aware screens<br>Shared data libraries", 360, 320, 270, 230)
    p.box("supabase_boundary", "SUPABASE MANAGED BACKEND", 720, 135, 500, 650, kind="boundary")
    p.box("auth", "<b>Supabase Auth</b><br>Session and JWT identity", 785, 220, 365, 100)
    p.box("api", "<b>Data APIs</b><br>PostgREST · SQL RPCs · Realtime", 785, 350, 365, 110)
    p.box("db", "<b>PostgreSQL</b><br>Tables · RLS · constraints<br>triggers · transactions", 785, 490, 365, 125)
    p.box("storage", "<b>Object Storage</b><br>Profile and service images", 785, 650, 170, 90)
    p.box("edge", "<b>Edge Functions</b><br>Review analysis<br>summary · staff user creation", 980, 650, 170, 90)
    p.box("sentiment", "<b>PROTECTED SENTIMENT API</b><br>FastAPI · LDA · FAISS<br>schema validation", 1275, 330, 250, 190, kind="external")
    p.box("model", "<b>EXTERNAL MODEL PROVIDER</b><br>Pre-trained structured inference", 1275, 610, 250, 125, kind="external")
    p.edge("actors", "expo", "User interaction")
    p.edge("expo", "auth", "HTTPS authentication")
    p.edge("expo", "api", "HTTPS + JWT")
    p.edge("expo", "storage", "Authenticated storage API")
    p.edge("api", "db", "SQL / transactions")
    p.edge("edge", "db", "Validated server access")
    p.edge("edge", "sentiment", "HTTPS + X-Analysis-Key")
    p.edge("sentiment", "model", "Structured inference request")
    p.edge("sentiment", "edge", "Validated JSON result")
    return p


def build_network() -> Page:
    p = component_page("network", "3.6.1 Network Architecture",
                       "MULTIVENT - Network Architecture",
                       "HTTPS communication paths and trust boundaries; no secrets are exposed in the client")
    p.box("client_zone", "CLIENT DEVICE / BROWSER", 45, 155, 420, 690, kind="boundary")
    p.box("expo_runtime", "<b>Expo Runtime</b><br>Android · iOS · Web", 110, 260, 290, 120)
    p.box("public_config", "<b>Public configuration</b><br>Supabase URL<br>publishable/anon key", 110, 470, 290, 120, kind="note")
    p.box("session", "<b>Authenticated session</b><br>Access token / JWT", 110, 665, 290, 105)

    p.box("supabase_zone", "SUPABASE CLOUD TRUST BOUNDARY", 560, 115, 590, 770, kind="boundary")
    p.box("auth_endpoint", "Auth endpoint", 635, 205, 205, 85)
    p.box("rest_endpoint", "PostgREST / RPC endpoint", 865, 205, 210, 85)
    p.box("storage_endpoint", "Storage endpoint", 635, 355, 205, 85)
    p.box("edge_endpoint", "Edge Function endpoint", 865, 355, 210, 85)
    p.box("postgres", "<b>PostgreSQL</b><br>RLS · authorization<br>functions · durable records", 635, 535, 440, 175)
    p.box("server_secrets", "Server-only secrets:<br>service role · analysis URL · analysis key", 635, 755, 440, 75, kind="note")

    p.box("nlp_zone", "PROTECTED NLP CONTAINER", 1230, 220, 320, 390, kind="boundary")
    p.box("fastapi", "<b>FastAPI</b><br>/health · /analyze · /summarize", 1280, 325, 220, 115)
    p.box("artifacts", "Local versioned artifacts<br>LDA · encoder · FAISS", 1280, 485, 220, 80)
    p.box("external_api", "External model API", 1280, 710, 220, 95, kind="external")

    p.edge("expo_runtime", "auth_endpoint", "HTTPS: sign-in/session")
    p.edge("session", "rest_endpoint", "HTTPS: JWT + REST/RPC")
    p.edge("session", "storage_endpoint", "HTTPS: JWT + object path")
    p.edge("session", "edge_endpoint", "HTTPS: JWT + JSON")
    p.edge("auth_endpoint", "postgres", "Identity context")
    p.edge("rest_endpoint", "postgres", "SQL under RLS / RPC")
    p.edge("storage_endpoint", "postgres", "Object metadata / policies")
    p.edge("edge_endpoint", "postgres", "Validated server-side read/write")
    p.edge("edge_endpoint", "fastapi", "HTTPS: X-Analysis-Key + JSON")
    p.edge("fastapi", "artifacts", "Local inference context")
    p.edge("fastapi", "external_api", "HTTPS structured request")
    p.edge("external_api", "fastapi", "Schema-constrained result")
    return p


def key_columns(table_name: str, table: dict, fks: list[dict]) -> set[str]:
    keys = {c["name"] for c in table["columns"] if c.get("primary_key")}
    for fk in fks:
        if fk["source_table"] == table_name:
            keys.update(fk["source_columns"])
    return keys


def display_columns(table_name: str, table: dict, fks: list[dict], mode: str) -> list[dict]:
    columns = table["columns"]
    if mode == "complete":
        return columns
    keys = key_columns(table_name, table, fks)
    if mode == "condensed":
        wanted = keys | set(CONDENSED_BUSINESS.get(table_name, []))
        return [column for column in columns if column["name"] in wanted]
    selected: list[dict] = []
    for column in columns:
        if column["name"] in keys:
            selected.append(column)
    for column in columns:
        if column in selected or column["name"] in {"created_at", "updated_at"}:
            continue
        selected.append(column)
        if len(selected) >= max(12, len(keys)):
            break
    if len(selected) < len(columns):
        selected.append({
            "name": f"... +{len(columns) - len(selected)} additional columns",
            "type": "see complete technical ERD", "nullable": True,
            "primary_key": False, "unique": False, "summary": True,
        })
    return selected


def table_height(columns: list[dict], row_h: int = 25) -> int:
    return 38 + len(columns) * row_h


def greedy_layout(names: list[str], tables: dict[str, dict], fks: list[dict],
                  mode: str, columns_count: int, table_w: int = 390,
                  gap_x: int = 135, gap_y: int = 80, top: int = 120,
                  left: int = 60) -> tuple[dict[str, Box], int, int]:
    lanes: list[list[tuple[str, int]]] = [[] for _ in range(columns_count)]
    totals = [0] * columns_count
    for name in names:
        height = table_height(display_columns(name, tables[name], fks, mode))
        lane = min(range(columns_count), key=lambda index: totals[index])
        lanes[lane].append((name, height))
        totals[lane] += height + gap_y
    boxes: dict[str, Box] = {}
    for col, lane in enumerate(lanes):
        y = top
        x = left + col * (table_w + gap_x)
        for name, height in lane:
            boxes[name] = Box(x, y, table_w, height)
            y += height + gap_y
    width = left * 2 + columns_count * table_w + (columns_count - 1) * gap_x
    height = max(totals, default=800) + top + 80
    return boxes, width, max(height, 800)


def add_table(p: Page, table_name: str, table: dict, fks: list[dict], box: Box,
              mode: str, row_h: int = 25) -> dict[str, dict[str, str]]:
    table_id = f"{p.page_id}_table_{sid(table_name)}"
    p.cell(table_id, "", "group;", box.x, box.y, box.w, box.h, major=True)
    p.cell(f"{table_id}_header", xml_text(table_name),
           f"rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;spacingLeft=12;fontFamily={FONT};fontSize=16;fontStyle=1;fontColor={INK};fillColor={LIGHT};strokeColor={BORDER};strokeWidth=2;",
           0, 0, box.w, 38, parent=table_id, connectable=False)
    displayed = display_columns(table_name, table, fks, mode)
    fk_cols = key_columns(table_name, table, fks) - {
        c["name"] for c in table["columns"] if c.get("primary_key")
    }
    anchors: dict[str, dict[str, str]] = {}
    for index, column in enumerate(displayed):
        y = 38 + index * row_h
        background = WHITE if index % 2 == 0 else LIGHTER
        is_pk = column.get("primary_key", False)
        is_fk = column["name"] in fk_cols
        marker = "PK/FK" if is_pk and is_fk else "PK" if is_pk else "FK" if is_fk else "UQ" if column.get("unique") else ""
        marker_w = 60
        name_w = box.w - marker_w - 125
        type_w = 125
        prefix = f"{table_id}_row_{sid(column['name'])}"
        p.cell(f"{prefix}_marker", xml_text(marker),
               f"rounded=0;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;fontFamily={FONT};fontSize=12;fontStyle=1;fontColor={INK};fillColor={background};strokeColor={LIGHT_BORDER};strokeWidth=1;",
               0, y, marker_w, row_h, parent=table_id, connectable=False)
        p.cell(f"{prefix}_name", xml_text(column["name"]),
               f"rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;spacingLeft=8;fontFamily={FONT};fontSize=14;fontColor={INK};fillColor={background};strokeColor={LIGHT_BORDER};strokeWidth=1;",
               marker_w, y, name_w, row_h, parent=table_id, connectable=False)
        type_label = compact_type(column.get("type", "")) + (" ?" if column.get("nullable") else "")
        p.cell(f"{prefix}_type", xml_text(type_label),
               f"rounded=0;whiteSpace=wrap;html=1;align=right;verticalAlign=middle;spacingRight=8;fontFamily={FONT};fontSize=12;fontColor={MUTED};fillColor={background};strokeColor={LIGHT_BORDER};strokeWidth=1;",
               marker_w + name_w, y, type_w, row_h, parent=table_id, connectable=False)
        left_anchor = f"{prefix}_anchor_l"
        right_anchor = f"{prefix}_anchor_r"
        for anchor_id, anchor_x in ((left_anchor, -5), (right_anchor, box.w - 5)):
            p.cell(anchor_id, "", "ellipse;html=1;opacity=0;fillOpacity=0;strokeOpacity=0;perimeter=ellipsePerimeter;",
                   anchor_x, y + row_h / 2 - 5, 10, 10, parent=table_id, major=False)
        anchors[column["name"]] = {"left": left_anchor, "right": right_anchor}
    return anchors


def add_erd_relationships(p: Page, names: list[str], fks: list[dict], boxes: dict[str, Box],
                          anchors: dict[str, dict[str, dict[str, str]]]) -> int:
    names_set = set(names)
    relevant = [fk for fk in fks if fk["source_table"] in names_set and fk["target_table"] in names_set]
    lane_counts: defaultdict[tuple[int, int], int] = defaultdict(int)
    for index, fk in enumerate(relevant):
        child = fk["source_table"]
        parent = fk["target_table"]
        child_col = fk["source_columns"][0]
        parent_col = fk["target_columns"][0]
        if child_col not in anchors[child] or parent_col not in anchors[parent]:
            raise RuntimeError(f"Missing row anchor for {fk['name']}")
        cb, pb = boxes[child], boxes[parent]
        if pb.x + pb.w <= cb.x:
            source_side, target_side = "right", "left"
            corridor_x = (pb.x + pb.w + cb.x) / 2
        elif cb.x + cb.w <= pb.x:
            source_side, target_side = "left", "right"
            corridor_x = (cb.x + cb.w + pb.x) / 2
        else:
            source_side = target_side = "right"
            lane_key = (round(pb.x), round(cb.x))
            lane = lane_counts[lane_key]
            lane_counts[lane_key] += 1
            corridor_x = max(pb.x + pb.w, cb.x + cb.w) + 45 + lane * 14
        source = anchors[parent][parent_col][source_side]
        target = anchors[child][child_col][target_side]
        parent_y = pb.y + 38 + list(anchors[parent]).index(parent_col) * 25 + 12.5
        child_y = cb.y + 38 + list(anchors[child]).index(child_col) * 25 + 12.5
        start_marker = "ERzeroToOne" if fk.get("source_nullable") else "ERone"
        end_marker = "ERzeroToOne" if fk.get("source_unique") else "ERzeroToMany"
        p.edge(source, target, "", arrow=False,
               points=[(corridor_x, parent_y), (corridor_x, child_y)],
               style_extra=f"startArrow={start_marker};startFill=0;endArrow={end_marker};endFill=0;")
    return len(relevant)


def build_erd(page_id: str, name: str, title: str, names: list[str], tables: dict[str, dict],
              fks: list[dict], mode: str, cols: int) -> Page:
    boxes, width, height = greedy_layout(names, tables, fks, mode, cols)
    p = component_page(page_id, name, title,
                       "Crow's Foot notation · ? denotes nullable · row-level PK/FK anchors",
                       width=width, height=height)
    anchors = {}
    for table_name in names:
        anchors[table_name] = add_table(p, table_name, tables[table_name], fks,
                                         boxes[table_name], mode)
    add_erd_relationships(p, names, fks, boxes, anchors)
    return p


def build_module_architecture() -> Page:
    p = component_page("modules", "3.6.3 Application/Module Architecture",
                       "MULTIVENT - Application / Module Architecture",
                       "Role-specific operations share one application shell and authoritative data services")
    p.box("shell", "<b>SHARED APPLICATION SHELL</b><br>App.tsx · session · navigation · notifications · responsive UI", 300, 120, 1000, 95)
    modules = [
        ("client", "<b>CLIENT OPERATIONS</b><br>Event setup and budget<br>Recommendations and selections<br>Coordinator choice/packages<br>Bookings, payments, messages, reviews", 70),
        ("provider", "<b>PROVIDER OPERATIONS</b><br>Profile and listings<br>Packages and availability<br>Booking decisions<br>Earnings and payout requests", 445),
        ("coordinator", "<b>COORDINATOR OPERATIONS</b><br>Service profile and packages<br>Assignment decisions<br>Event workspace and tasks<br>Provider coordination", 820),
        ("staff", "<b>AUTHORIZED STAFF OPERATIONS</b><br>Accounts and permissions<br>Listing moderation<br>Support and finance<br>Audit and configuration", 1195),
    ]
    for cell_id, label, x in modules:
        p.box(cell_id, label, x, 310, 300, 260)
        p.edge("shell", cell_id, "Routes by authenticated role")
    p.box("shared_libs", "<b>SHARED TYPESCRIPT DATA SERVICES</b><br>auth · planning · catalog · merchant · coordinator · messaging · reviews", 250, 675, 1100, 100)
    p.box("supabase_services", "<b>SUPABASE SDK</b><br>Auth · tables · RPCs · Storage · Realtime · Edge Functions", 250, 835, 1100, 90)
    for cell_id, _, _ in modules:
        p.edge(cell_id, "shared_libs", "Typed calls")
    p.edge("shared_libs", "supabase_services", "HTTPS / JWT / JSON")
    return p


def build_security() -> Page:
    p = component_page("security", "3.6.4 Security Architecture",
                       "MULTIVENT - Security Architecture",
                       "Implemented defense-in-depth controls and current verified limitation")
    layers = [
        ("identity", "1 · IDENTITY & AUTHENTICATION", "Supabase Auth<br>JWT-backed user identity<br>Account-status checks", 125),
        ("roles", "2 · ROLE & PERMISSION CONTROL", "profiles.default_role<br>roles / permissions / assignments<br>staff permission checks", 275),
        ("database_security", "3 · DATABASE AUTHORIZATION", "Row Level Security policies<br>owner/participant checks<br>authenticated-only RPC grants", 425),
        ("business", "4 · TRANSACTIONAL RULE ENFORCEMENT", "constraints and triggers<br>security-definer RPC validation<br>row locks and atomic commit/rollback", 575),
        ("protection", "5 · DATA PROTECTION", "server-held service credentials<br>immutable pricing/payment snapshots<br>validated JSON contracts", 725),
    ]
    for i, (cell_id, heading, body, y) in enumerate(layers):
        p.box(cell_id, f"<b>{heading}</b><br>{body}", 250, y, 800, 105)
        if i:
            p.edge(layers[i - 1][0], cell_id, "")
    p.box("audit", "<b>AUDITING & MONITORING</b><br>audit_logs · financial ledger<br>analysis status/error states<br>Supabase logs and advisors", 1150, 300, 350, 220)
    p.edge("roles", "audit", "Authorized actions")
    p.edge("business", "audit", "State transitions")
    p.box("warning", "<b>Verified limitation</b><br>service_categories currently has RLS disabled in the live project. This diagram does not claim otherwise.", 1150, 625, 350, 145, kind="note")
    return p


def build_integration() -> Page:
    p = component_page("integration", "3.6.5 Integration Architecture",
                       "MULTIVENT - Integration Architecture",
                       "Verified exchange mechanisms; no live payment gateway is represented")
    p.box("app", "<b>Expo Application</b><br>Supabase JavaScript SDK", 70, 360, 245, 145)
    integrations = [
        ("iauth", "Supabase Auth", 470, 145),
        ("idb", "PostgreSQL + SQL RPCs", 470, 310),
        ("istorage", "Supabase Storage", 470, 475),
        ("iedge", "Supabase Edge Functions", 470, 640),
    ]
    for cell_id, label, x, y in integrations:
        p.box(cell_id, f"<b>{label}</b>", x, y, 285, 100)
        p.edge("app", cell_id, "SDK over HTTPS + JWT")
    p.box("review_edge", "analyze-review<br>analyze-feedback<br>summarize-reviews", 885, 600, 250, 155)
    p.box("admin_edge", "admin-create-user", 885, 170, 250, 90)
    p.edge("iedge", "review_edge", "Function invocation")
    p.edge("iedge", "admin_edge", "Authorized staff action")
    p.edge("admin_edge", "iauth", "Server-side Auth Admin API")
    p.edge("review_edge", "idb", "Read source / persist result")
    p.box("nlp", "<b>Protected FastAPI</b><br>/analyze · /summarize<br>X-Analysis-Key", 1250, 560, 280, 170, kind="external")
    p.box("model_provider", "<b>External model provider</b><br>Schema-constrained inference", 1250, 250, 280, 120, kind="external")
    p.edge("review_edge", "nlp", "HTTPS + JSON")
    p.edge("nlp", "model_provider", "Responses API request")
    p.edge("model_provider", "nlp", "Validated structured result")
    p.box("payment_note", "Payment boundary<br>Internal demo reference and ledger workflow only.<br>No verified live payment processor call.", 825, 825, 420, 105, kind="note")
    return p


def build_deployment() -> Page:
    p = component_page("deployment", "3.6.6 Deployment Architecture",
                       "MULTIVENT - Deployment Architecture",
                       "Implemented/deployable components are separated from documented target infrastructure")
    p.box("source", "<b>Source Repository</b><br>TypeScript · SQL migrations<br>Edge Functions · tests", 60, 160, 270, 160)
    p.box("build", "<b>Expo / EAS Build</b><br>development · preview · production profiles", 430, 160, 300, 160)
    p.box("runtime", "<b>User Runtime</b><br>Android · iOS · Web", 430, 430, 300, 130)
    p.edge("source", "build", "Build inputs")
    p.edge("build", "runtime", "Install / deploy bundle")
    p.box("supabase_deploy", "<b>Supabase Project</b>", 835, 105, 420, 585, kind="boundary")
    p.box("deployed_db", "PostgreSQL<br>ordered SQL migrations", 900, 200, 290, 105)
    p.box("deployed_auth", "Auth + Storage + Realtime", 900, 345, 290, 95)
    p.box("deployed_edge", "Edge Functions<br>Deno server runtime", 900, 480, 290, 105)
    p.edge("source", "deployed_db", "Apply migrations")
    p.edge("source", "deployed_edge", "Deploy functions")
    p.edge("runtime", "deployed_auth", "Hosted HTTPS")
    p.edge("runtime", "deployed_db", "PostgREST / RPC")
    p.edge("runtime", "deployed_edge", "Function invoke")
    p.box("container_image", "<b>Sentiment Container Image</b><br>Python 3.13 · FastAPI/Uvicorn<br>CPU PyTorch · packaged artifacts", 1325, 170, 250, 180)
    p.box("azure_target", "<b>Azure Container Apps</b><br>Documented intended target<br><i>live deployment not independently verified</i>", 1325, 465, 250, 145, kind="external")
    p.edge("source", "container_image", "Docker build")
    p.edge("container_image", "azure_target", "Intended deployment")
    p.edge("deployed_edge", "azure_target", "HTTPS analysis call")
    p.box("external_model_deploy", "External model API", 1325, 740, 250, 90, kind="external")
    p.edge("azure_target", "external_model_deploy", "HTTPS")
    p.box("secret_note", "Deployment configuration only:<br>Supabase keys · service role · analysis URL/key · model API key", 760, 800, 500, 105, kind="note")
    return p


def build_use_cases() -> Page:
    p = component_page("use_cases", "3.8.1 Use Case Diagram",
                       "MULTIVENT - UML Use Case Diagram",
                       "Principal implemented role capabilities")
    p.actor("client_actor", "Client", 35, 300)
    p.actor("provider_actor", "Service Provider", 35, 650)
    p.actor("coordinator_actor", "Event Coordinator", 1470, 300)
    p.actor("staff_actor", "Authorized Staff", 1470, 650)
    p.actor("nlp_actor", "NLP Service", 1470, 105)
    p.box("system_boundary", "MULTIVENT SYSTEM", 190, 105, 1210, 800, kind="boundary")
    cases = [
        ("uc_event", "Create and manage event", 270, 180),
        ("uc_budget", "Allocate category budget", 270, 305),
        ("uc_select", "Select service / package", 270, 430),
        ("uc_pay", "Record downpayment", 270, 555),
        ("uc_review", "Submit verified review", 270, 680),
        ("uc_listing", "Manage listings and packages", 620, 180),
        ("uc_availability", "Manage availability", 620, 305),
        ("uc_booking", "Respond to booking request", 620, 430),
        ("uc_balance", "View earnings and request payout", 620, 555),
        ("uc_message", "Exchange event messages", 620, 680),
        ("uc_coord_profile", "Manage coordination service", 970, 180),
        ("uc_coord_request", "Review and respond to assignment", 970, 305),
        ("uc_coord_work", "Coordinate event and tasks", 970, 430),
        ("uc_moderate", "Moderate accounts and listings", 970, 555),
        ("uc_operations", "Manage support, finance, and audit", 970, 680),
        ("uc_nlp", "Analyze optional written feedback", 970, 805),
    ]
    for cid, label, x, y in cases:
        p.box(cid, label, x, y, 270, 80, kind="process", parent="1", major=True)
    for target in ("uc_event", "uc_budget", "uc_select", "uc_pay", "uc_review", "uc_message"):
        p.edge("client_actor", target, "", arrow=False)
    for target in ("uc_listing", "uc_availability", "uc_booking", "uc_balance", "uc_message"):
        p.edge("provider_actor", target, "", arrow=False)
    for target in ("uc_coord_profile", "uc_coord_request", "uc_coord_work", "uc_message"):
        p.edge("coordinator_actor", target, "", arrow=False)
    for target in ("uc_moderate", "uc_operations"):
        p.edge("staff_actor", target, "", arrow=False)
    p.edge("nlp_actor", "uc_nlp", "", arrow=False)
    p.edge("uc_review", "uc_nlp", "<<extend>> when a comment is supplied", dashed=True,
           style_extra="endArrow=open;endFill=0;")
    return p


def build_dfd0() -> Page:
    p = component_page("dfd0", "3.8.2 Level 0 Data Flow Diagram",
                       "MULTIVENT - Level 0 Data Flow Diagram",
                       "Context diagram: external entities and balanced information exchanges")
    p.box("dfd0_client", "CLIENT", 60, 200, 240, 110, kind="external")
    p.box("dfd0_provider", "SERVICE PROVIDER", 60, 640, 240, 110, kind="external")
    p.box("dfd0_system", "0<br><b>MULTIVENT</b><br>Event-services marketplace<br>and planning system", 585, 315, 430, 300, kind="process")
    p.box("dfd0_coord", "EVENT COORDINATOR", 1300, 200, 240, 110, kind="external")
    p.box("dfd0_staff", "AUTHORIZED STAFF", 1300, 640, 240, 110, kind="external")
    p.box("dfd0_nlp", "NLP SERVICE", 680, 790, 240, 95, kind="external")
    p.edge("dfd0_client", "dfd0_system", "Event plan · budget · selections · payment · review")
    p.edge("dfd0_system", "dfd0_client", "Quotes · booking state · receipts · notifications")
    p.edge("dfd0_provider", "dfd0_system", "Listings · availability · decisions · payout requests")
    p.edge("dfd0_system", "dfd0_provider", "Booking details · balances · messages")
    p.edge("dfd0_coord", "dfd0_system", "Profile · packages · assignment decisions · tasks")
    p.edge("dfd0_system", "dfd0_coord", "Client request · event plan · services · balances")
    p.edge("dfd0_staff", "dfd0_system", "Authorized moderation · support · finance actions")
    p.edge("dfd0_system", "dfd0_staff", "Queues · records · audit information")
    p.edge("dfd0_system", "dfd0_nlp", "Eligible written comments")
    p.edge("dfd0_nlp", "dfd0_system", "Validated sentiment and summary")
    return p


def build_dfd1() -> Page:
    p = component_page("dfd1", "3.8.2 Level 1 Data Flow Diagram",
                       "MULTIVENT - Level 1 Data Flow Diagram",
                       "Decomposition of the Level 0 process into major logical processes and data stores",
                       width=1900, height=1250)
    actors = [
        ("l1_client", "CLIENT", 45, 155), ("l1_provider", "SERVICE PROVIDER", 45, 500),
        ("l1_coord", "EVENT COORDINATOR", 1615, 155), ("l1_staff", "AUTHORIZED STAFF", 1615, 500),
        ("l1_nlp", "NLP SERVICE", 1615, 845),
    ]
    for cid, label, x, y in actors:
        p.box(cid, label, x, y, 240, 95, kind="external")
    processes = [
        ("p1", "1.0<br>Identity & Access", 360, 130),
        ("p2", "2.0<br>Marketplace Supply", 720, 130),
        ("p3", "3.0<br>Event Planning & Selection", 1080, 130),
        ("p4", "4.0<br>Booking & Coordination", 360, 470),
        ("p5", "5.0<br>Payment & Ledger", 720, 470),
        ("p6", "6.0<br>Messaging & Notifications", 1080, 470),
        ("p7", "7.0<br>Reviews & Analysis", 360, 810),
        ("p8", "8.0<br>Support & Governance", 1080, 810),
    ]
    for cid, label, x, y in processes:
        p.box(cid, label, x, y, 250, 120, kind="process")
    stores = [
        ("d1", "D1 · Identity & Permissions", 320, 1050),
        ("d2", "D2 · Services & Availability", 620, 1050),
        ("d3", "D3 · Events, Selections & Bookings", 920, 1050),
        ("d4", "D4 · Payments & Ledger", 1220, 1050),
        ("d5", "D5 · Communication, Reviews & Audit", 1520, 1050),
    ]
    for cid, label, x, y in stores:
        p.box(cid, label, x, y, 250, 85, kind="datastore")
    p.edge("l1_client", "p1", "Credentials / profile")
    p.edge("p1", "l1_client", "Session / role")
    p.edge("l1_provider", "p2", "Listings / availability")
    p.edge("p2", "l1_client", "Catalog / recommendations")
    p.edge("l1_client", "p3", "Event / budget / choices")
    p.edge("p3", "p4", "Validated selections")
    p.edge("p4", "l1_provider", "Booking request")
    p.edge("l1_provider", "p4", "Accept / decline / completion")
    p.edge("p4", "l1_coord", "Assignment / event information")
    p.edge("l1_coord", "p4", "Decision / tasks / packages")
    p.edge("l1_client", "p5", "Payment record")
    p.edge("p5", "l1_provider", "Earnings / payout status")
    p.edge("p5", "l1_coord", "Coordinator balance")
    p.edge("l1_client", "p6", "Messages")
    p.edge("p6", "l1_provider", "Messages / notifications")
    p.edge("p6", "l1_coord", "Messages / notifications")
    p.edge("l1_client", "p7", "Rating / optional comment")
    p.edge("p7", "l1_nlp", "Comment analysis request")
    p.edge("l1_nlp", "p7", "Sentiment / summary")
    p.edge("l1_staff", "p8", "Authorized operational action")
    p.edge("p8", "l1_staff", "Queues / audit results")
    p.edge("p1", "d1", "Identity records", arrow=False)
    p.edge("p2", "d2", "Catalog records", arrow=False)
    p.edge("p3", "d3", "Plans and selections", arrow=False)
    p.edge("p4", "d3", "Booking / assignment state", arrow=False)
    p.edge("p5", "d4", "Payment / ledger entries", arrow=False)
    p.edge("p6", "d5", "Messages / notices", arrow=False)
    p.edge("p7", "d5", "Reviews / analysis", arrow=False)
    p.edge("p8", "d1", "Permissions", arrow=False)
    p.edge("p8", "d5", "Support / audit", arrow=False)
    return p


def build_input_layout() -> Page:
    p = component_page("input_layout", "3.9.1 Input Screens Layout",
                       "MULTIVENT - Input Screens Layout",
                       "Editable documentation wireframes derived from implemented React Native forms",
                       width=1800, height=1100)
    p.box("input_client", "<b>CLIENT · EVENT & BUDGET</b><br><br>Event name  [________________]<br>Event type  [ Select        v ]<br>Date        [ yyyy-mm-dd    ]<br>Time        [ --:--         ]<br>Guest count [______________]<br>Venue       [______________]<br><br><b>Category allocations</b><br>Venue       PHP [__________]<br>Catering    PHP [__________]<br>Coordinator PHP [__________]<br><br><i>Inline rule:</i> Allocations cannot exceed<br>the total event budget.<br><br>[ Back ]          [ Save and continue ]", 60, 135, 510, 825, kind="screen")
    p.box("input_provider", "<b>PROVIDER · SERVICE LISTING</b><br><br>Category     [ Select        v ]<br>Service name [________________]<br>Description  [________________]<br>             [________________]<br>Base price   PHP [___________]<br>Pricing unit [ Event / Person ]<br>Cover image  [ Choose photo  ]<br><br><b>Category-specific options</b><br>Option name  [________________]<br>Guest range  [____] to [____]<br>Price/head   PHP [___________]<br>Menu items   [ + Add item    ]<br><br><i>Validation appears next to the field.</i><br><br>[ Save draft ]    [ Review listing ]", 645, 135, 510, 825, kind="screen")
    p.box("input_coordinator", "<b>COORDINATOR · PROFILE / PACKAGE</b><br><br>Description     [________________]<br>                [________________]<br>Coordination fee PHP [__________]<br>Specializations [ + Add       ]<br>Accept bookings [ on / off    ]<br><br><b>Curated package</b><br>Package name    [________________]<br>Event type      [ Select       v ]<br>Services        [ Search and select ]<br>                [x] Venue<br>                [x] Catering<br>Status          [ Draft / Active ]<br><br><i>Unavailable services prevent activation.</i><br><br>[ Cancel ]         [ Save package ]", 1230, 135, 510, 825, kind="screen")
    p.cell("input_pattern", xml_text("Shared pattern: descriptive header → grouped fields → inline validation → calculated summary → one clear primary action"),
           f"rounded=1;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;fontFamily={FONT};fontSize=14;fontStyle=1;fontColor={INK};fillColor={LIGHT};strokeColor={BORDER};strokeWidth=1.5;",
           260, 1000, 1280, 55, connectable=False)
    return p


def build_pages(tables: dict[str, dict], fks: list[dict]) -> list[Page]:
    pages = [build_high_level(), build_network()]
    pages.append(build_erd("erd_condensed", "3.6.2.1 Condensed ERD",
                           "MULTIVENT ERD - Condensed Operational Model",
                           CONDENSED_TABLES, tables, fks, "condensed", 4))
    all_tables = ["auth.users"] + sorted(name for name in tables if name != "auth.users")
    pages.append(build_erd("erd_complete", "3.6.2.1 Complete Technical ERD",
                           "MULTIVENT ERD - Complete Technical Schema",
                           all_tables, tables, fks, "complete", 7))
    for page_id, title, names in FOCUSED_ERDS:
        pages.append(build_erd(page_id.lower(), title.replace("_", " "), title,
                               names, tables, fks, "focused", 4))
    pages.extend([
        build_module_architecture(), build_security(), build_integration(),
        build_deployment(), build_use_cases(), build_dfd0(), build_dfd1(),
        build_input_layout(),
    ])
    return pages


def validate_file(path: Path) -> dict:
    root = ET.parse(path).getroot()
    if root.tag != "mxfile":
        raise RuntimeError(f"{path.name}: root is not mxfile")
    page_reports = []
    for diagram in root.findall("diagram"):
        cells = diagram.findall("./mxGraphModel/root/mxCell")
        ids = [cell.get("id") for cell in cells]
        if len(ids) != len(set(ids)):
            raise RuntimeError(f"{path.name}/{diagram.get('name')}: duplicate cell id")
        id_set = set(ids)
        edges = [cell for cell in cells if cell.get("edge") == "1"]
        broken = [cell.get("id") for cell in edges
                  if cell.get("source") not in id_set or cell.get("target") not in id_set]
        if broken:
            raise RuntimeError(f"{path.name}/{diagram.get('name')}: broken edges {broken}")
        page_reports.append({
            "name": diagram.get("name"), "cells": len(cells), "edges": len(edges),
        })
    return {"file": path.name, "pages": page_reports}


def overlapping_major_boxes(page: Page) -> list[tuple[str, str]]:
    # Only same-level major boxes are tested; intentional boundaries are ignored.
    items = [(key, box) for key, box in page.major_boxes.items()
             if "boundary" not in key and not key.endswith("_actor")]
    overlaps = []
    for index, (left_name, left) in enumerate(items):
        for right_name, right in items[index + 1:]:
            if (left.x < right.x + right.w and left.x + left.w > right.x and
                    left.y < right.y + right.h and left.y + left.h > right.y):
                # Parent trust boundaries intentionally overlap their contents and
                # use-case system boundaries intentionally contain the use cases.
                if left_name in {"supabase_boundary", "client_zone", "supabase_zone", "nlp_zone", "system_boundary", "supabase_deploy"}:
                    continue
                if right_name in {"supabase_boundary", "client_zone", "supabase_zone", "nlp_zone", "system_boundary", "supabase_deploy"}:
                    continue
                overlaps.append((left_name, right_name))
    return overlaps


def write_readme(pages: list[Page]) -> None:
    rows = [
        ("01", "3.6 / Figure 3.6-1", "High-Level System Architecture"),
        ("02", "3.6.1 / Figure 3.6.1-1", "Network Architecture"),
        ("03", "3.6.2.1 / Figure 3.6.2.1-1", "Condensed Operational ERD"),
        ("04", "3.6.2.1 / technical appendix", "Complete Technical ERD"),
    ]
    for index, (_, title, _) in enumerate(FOCUSED_ERDS, start=5):
        rows.append((f"{index:02}", "3.6.2.1 / focused technical view", title.replace("MULTIVENT ERD - ", "")))
    rows.extend([
        ("14", "3.6.3 / Figure 3.6.3-1", "Application / Module Architecture"),
        ("15", "3.6.4 / Figure 3.6.4-1", "Security Architecture"),
        ("16", "3.6.5 / figure caption absent from reviewed DOCX", "Integration Architecture"),
        ("17", "3.6.6 / Figure 3.6.6-1", "Deployment Architecture"),
        ("18", "3.8.1 / Figure 3.8.1-1", "UML Use Case Diagram"),
        ("19", "3.8.2 / Figure 3.8.2-1", "Level 0 Context DFD"),
        ("20", "3.8.2 / Figure 3.8.2-2", "Level 1 DFD"),
        ("21", "3.9.1 / Figure 3.9.1-1", "Input Screens Layout"),
    ])
    lines = [
        "# MULTIVENT Final Editable Draw.io Diagrams", "",
        f"Generated **{len(pages)} fully editable diagrams** from the checked manuscript, current source code, and verified database schema.", "",
        "## Files", "",
        "- `MULTIVENT_ALL_DIAGRAMS.drawio` — combined multipage source.",
        "- `01_...drawio` through `21_...drawio` — independent one-page sources.",
        "- `DIAGRAM_VALIDATION.md` — accuracy and structural validation report.", "",
        "## Diagram index", "",
        "| File prefix | Manuscript reference | Diagram |", "|---|---|---|",
    ]
    lines += [f"| {prefix} | {section} | {title} |" for prefix, section, title in rows]
    lines += [
        "", "## Open and edit", "",
        "1. Open [diagrams.net](https://app.diagrams.net/) or the desktop draw.io application.",
        "2. Choose **File → Open From → Device** and select a `.drawio` file.",
        "3. In the combined file, use the page tabs at the bottom to switch figures.",
        "4. Every component, table, attribute row, actor, process, store, label, and connector is native editable XML.",
        "5. Export with **File → Export as → PDF/PNG**. For manuscript figures, enable crop and use a high zoom/DPI setting.",
        "", "## ERD notation", "",
        "- `PK`, `FK`, `PK/FK`, and `UQ` mark relational keys.",
        "- `?` after a type marks a nullable column.",
        "- Crow's Foot endpoints are attached to invisible row-level anchors outside each table body.",
        "- Junction tables are shown explicitly; no direct many-to-many relationships are invented.",
        "", "## Print style", "",
        "All pages use a white background, dark text, grayscale fills, 2 px connectors, and orthogonal routing. No manuscript DOCX was modified.",
    ]
    README_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_validation(pages: list[Page], reports: list[dict], tables: dict[str, dict],
                     fks: list[dict]) -> None:
    overlaps = {page.name: overlapping_major_boxes(page) for page in pages}
    overlap_count = sum(len(value) for value in overlaps.values())
    lines = [
        "# MULTIVENT Diagram Validation", "", "## Source verification", "",
        "- Reviewed `docs/MULTIVENT_PROGRAMMER_MANUSCRIPT_BLACK_AND_WHITE.docx` without modifying it.",
        "- Reviewed `D:/Multivent/HARVEY&CAANG.pdf` (the requested `HARVEY&CAANG(1).pdf` filename was not present).",
        "- Verified the schema snapshot against the connected Supabase project on 2026-10-09.",
        f"- Public schema: **{len(tables) - 1} tables** and **{len(fks) - 1} public-schema foreign keys**.",
        "- The additional `profiles.id → auth.users.id` relationship is shown as an external-schema FK, producing 116 declared relationships in the complete model.",
        "- Migration 61 adds RPC visibility only; it introduces no ERD tables or columns and was not installed in the read-only live connection.",
        "", "## Structural validation", "",
        f"- Generated **{len(pages)} individual pages** and one combined multipage file.",
        "- Every output parsed successfully as XML.",
        "- Every connector source and target resolves to an existing native `mxCell`.",
        "- Cell identifiers are unique within each page.",
        f"- Automated same-level box-overlap findings: **{overlap_count}**.",
        "- ERD relationships use declared PostgreSQL foreign keys and row-level anchors with Crow's Foot endpoints.",
        "- Complete technical ERD includes every column from all 51 verified public tables plus the external `auth.users.id` context row.",
        "", "## Visual validation", "",
        "- Layouts use deterministic columns, minimum table gaps, white backgrounds, grayscale fills, readable font sizes, and orthogonal connector corridors.",
        "- No diagrams.net desktop/CLI renderer was available in the environment, so pixel-rendered PDF/PNG inspection was **not** claimed or generated.",
        "- The files should be opened in diagrams.net for final human inspection at the exact Word insertion scale before export.",
        "", "## Implementation and manuscript discrepancies", "",
        "1. The reviewed manuscript contains no explicit figure-caption line for Section 3.6.5 Integration Architecture. The deliverable is indexed by section but does not invent a manuscript caption.",
        "2. The manuscript describes RLS as a security layer. Live Supabase advisors report `public.service_categories` currently has RLS disabled; the Security Architecture labels this verified limitation.",
        "3. No confirmed live PayMongo or equivalent runtime call exists. Integration diagrams show internal payment/ledger records only and explicitly omit a payment gateway.",
        "4. Azure Container Apps is documented as the intended sentiment-container target, but live deployment was not independently verified. It is labeled as intended.",
        "5. The requested `HARVEY&CAANG(1).pdf` was unavailable; `HARVEY&CAANG.pdf` was reviewed instead and contains the cited Sections 3.6–3.10 requirements.",
        "", "## Page metrics", "",
        "| Page | Native cells | Connectors |", "|---|---:|---:|",
    ]
    combined = next(report for report in reports if report["file"] == COMBINED_PATH.name)
    for item in combined["pages"]:
        lines.append(f"| {item['name']} | {item['cells']} | {item['edges']} |")
    VALIDATION_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    tables, fks = load_schema()
    pages = build_pages(tables, fks)
    expected_names = {
        0: "01_High_Level_System_Architecture.drawio",
        1: "02_Network_Architecture.drawio",
        2: "03_Condensed_Manuscript_ERD.drawio",
        3: "04_Complete_Technical_ERD.drawio",
    }
    # Focused pages occupy page indexes 4-12 while their filenames continue
    # after the condensed (03) and complete (04) editions.
    for index, (prefix, _, _) in enumerate(FOCUSED_ERDS, start=4):
        expected_names[index] = f"{prefix}.drawio"
    expected_names.update({
        13: "14_Application_Module_Architecture.drawio",
        14: "15_Security_Architecture.drawio",
        15: "16_Integration_Architecture.drawio",
        16: "17_Deployment_Architecture.drawio",
        17: "18_UML_Use_Case_Diagram.drawio",
        18: "19_DFD_Level_0_Context.drawio",
        19: "20_DFD_Level_1.drawio",
        20: "21_Input_Screens_Layout.drawio",
    })
    write_mxfile(COMBINED_PATH, pages)
    paths = [COMBINED_PATH]
    for index, page in enumerate(pages):
        path = OUTPUT_DIR / expected_names[index]
        write_mxfile(path, [page])
        paths.append(path)
    reports = [validate_file(path) for path in paths]
    write_readme(pages)
    write_validation(pages, reports, tables, fks)
    print(json.dumps({
        "output_dir": str(OUTPUT_DIR), "diagrams": len(pages),
        "files": len(paths) + 2,
        "combined_pages": len(reports[0]["pages"]),
        "tables": len(tables) - 1, "relationships": len(fks),
    }, indent=2))


if __name__ == "__main__":
    main()
