"""Generate the implementation-grounded MULTIVENT programmer manuscript.

The document follows the requirements in D:/Multivent/HARVEY&CAANG.pdf and
deliberately separates implemented evidence from evaluation instruments whose
results still have to be collected from respondents or Lighthouse.
"""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "multivent_matplotlib"))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle
from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "MULTIVENT_PROGRAMMER_MANUSCRIPT_BLACK_AND_WHITE_ERD_REVISED.docx"

# Print-safe manuscript theme: pure black ink on white paper. The legacy color
# edition remains untouched; this generator now creates a separate B&W file.
WINE = "000000"
WINE_DARK = "000000"
GOLD = "000000"
CREAM = "FFFFFF"
LIGHT_WINE = "FFFFFF"
LIGHT_GOLD = "FFFFFF"
LIGHT_GRAY = "FFFFFF"
MID_GRAY = "000000"
DARK = "000000"
WHITE = "FFFFFF"
GREEN = "FFFFFF"
BLUE = "FFFFFF"


def hex_rgb(value: str) -> RGBColor:
    return RGBColor.from_string(value)


def shade(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=70, start=90, bottom=70, end=90) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def prevent_row_split(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tr_pr.append(OxmlElement("w:cantSplit"))


def set_cell_text(cell, text: str, *, bold=False, color=None, size=8.4) -> None:
    cell.text = ""
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(0)
    run = paragraph.add_run(str(text))
    run.bold = bold
    run.font.name = "Times New Roman"
    run.font.size = Pt(size)
    if color:
        run.font.color.rgb = hex_rgb(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_margins(cell)


def add_table(document: Document, headers: list[str], rows: list[list[str]], widths=None,
              font_size=8.4, header_fill=WINE) -> None:
    table = document.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    table.autofit = True
    set_repeat_table_header(table.rows[0])
    for index, header in enumerate(headers):
        set_cell_text(table.rows[0].cells[index], header, bold=True, color=WHITE, size=font_size)
        shade(table.rows[0].cells[index], header_fill)
    for row_index, values in enumerate(rows):
        row = table.add_row()
        prevent_row_split(row)
        for column_index, value in enumerate(values):
            set_cell_text(row.cells[column_index], value, size=font_size)
            shade(row.cells[column_index], WHITE)
    if widths:
        for row in table.rows:
            for index, width in enumerate(widths):
                row.cells[index].width = Inches(width)
    document.add_paragraph()


def add_page_field(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("Page ")
    run.font.name = "Times New Roman"
    run.font.size = Pt(8.5)
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    run._r.addnext(fld)


def add_toc(document: Document) -> None:
    document.add_heading("Table of Contents", level=1)
    paragraph = document.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = ' TOC \\o "1-3" \\h \\z \\u '
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "Open in Microsoft Word and update this field to generate the table of contents."
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, text, end])
    document.add_page_break()


def add_caption(document: Document, text: str) -> None:
    paragraph = document.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.keep_with_next = True
    run = paragraph.add_run(text)
    run.bold = True
    run.font.size = Pt(9)
    run.font.color.rgb = hex_rgb(WINE_DARK)


def add_figure(document: Document, path: Path, caption: str, width=6.65) -> None:
    paragraph = document.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_after = Pt(3)
    paragraph.add_run().add_picture(str(path), width=Inches(width))
    add_caption(document, caption)


def add_bullets(document: Document, items: list[str], level=0) -> None:
    style = "List Bullet" if level == 0 else "List Bullet 2"
    for item in items:
        paragraph = document.add_paragraph(style=style)
        paragraph.paragraph_format.space_after = Pt(3)
        paragraph.add_run(item)


def add_numbered(document: Document, items: list[str]) -> None:
    for item in items:
        paragraph = document.add_paragraph(style="List Number")
        paragraph.paragraph_format.space_after = Pt(3)
        paragraph.add_run(item)


def add_callout(document: Document, title: str, body: str, fill=LIGHT_WINE) -> None:
    table = document.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    cell = table.cell(0, 0)
    shade(cell, fill)
    set_cell_margins(cell, 120, 150, 120, 150)
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(3)
    run = paragraph.add_run(title)
    run.bold = True
    run.font.color.rgb = hex_rgb(WINE_DARK)
    paragraph.add_run("\n" + body)
    document.add_paragraph()


def configure_document(document: Document) -> None:
    section = document.sections[0]
    section.top_margin = Inches(0.72)
    section.bottom_margin = Inches(0.68)
    section.left_margin = Inches(0.82)
    section.right_margin = Inches(0.82)

    styles = document.styles
    normal = styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(11)
    normal.font.color.rgb = hex_rgb(DARK)
    normal.paragraph_format.line_spacing = 1.13
    normal.paragraph_format.space_after = Pt(5)

    title = styles["Title"]
    title.font.name = "Times New Roman"
    title.font.size = Pt(29)
    title.font.bold = True
    title.font.color.rgb = hex_rgb(WINE)

    subtitle = styles["Subtitle"]
    subtitle.font.name = "Times New Roman"
    subtitle.font.size = Pt(14)
    subtitle.font.color.rgb = hex_rgb(GOLD)

    for name, size, before, after in (
        ("Heading 1", 17, 14, 6),
        ("Heading 2", 13, 11, 5),
        ("Heading 3", 11, 9, 4),
    ):
        style = styles[name]
        style.font.name = "Times New Roman"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = hex_rgb(WINE)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)

    for section in document.sections:
        header = section.header.paragraphs[0]
        header.text = "MULTIVENT  |  Programmer’s Chapter Manuscript"
        header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        header.runs[0].font.name = "Times New Roman"
        header.runs[0].font.size = Pt(8)
        header.runs[0].font.color.rgb = hex_rgb(WINE)
        add_page_field(section.footer.paragraphs[0])

    settings = document.settings._element
    update = OxmlElement("w:updateFields")
    update.set(qn("w:val"), "true")
    settings.append(update)


def setup_plot(width=12, height=7):
    fig, ax = plt.subplots(figsize=(width, height), dpi=180)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")
    ax.set_xlim(0, width)
    ax.set_ylim(0, height)
    ax.axis("off")
    return fig, ax


def box(ax, xy, wh, title, lines=(), fill="#FFFFFF", edge="#000000", title_color="#000000",
        fontsize=8.5, radius=0.12):
    x, y = xy
    w, h = wh
    patch = FancyBboxPatch(
        (x, y), w, h,
        boxstyle=f"round,pad=0.04,rounding_size={radius}",
        linewidth=1.4, edgecolor="#000000", facecolor="#FFFFFF",
    )
    ax.add_patch(patch)
    ax.text(x + w / 2, y + h - 0.26, title, ha="center", va="top",
            fontsize=fontsize + 0.5, fontweight="bold", color="#000000")
    if lines:
        ax.text(x + 0.16, y + h - 0.65, "\n".join(lines), ha="left", va="top",
                fontsize=fontsize, color="#000000", linespacing=1.25)
    return patch


def routed_arrow(ax, points, label=None):
    """Draw one black, right-angle route and place its label in open space."""
    for first, second in zip(points[:-2], points[1:-1]):
        ax.plot([first[0], second[0]], [first[1], second[1]], color="#000000", linewidth=1.25)
    patch = FancyArrowPatch(points[-2], points[-1], arrowstyle="-|>", mutation_scale=12,
                            linewidth=1.25, color="#000000")
    ax.add_patch(patch)
    if label:
        segments = list(zip(points[:-1], points[1:]))
        first, second = max(
            segments,
            key=lambda segment: abs(segment[1][0] - segment[0][0])
            + abs(segment[1][1] - segment[0][1]),
        )
        mx = (first[0] + second[0]) / 2
        my = (first[1] + second[1]) / 2
        is_horizontal = abs(first[1] - second[1]) < 0.001
        ax.text(
            mx + (0 if is_horizontal else 0.10),
            my + (0.10 if is_horizontal else 0),
            label,
            ha="center" if is_horizontal else "left",
            va="bottom" if is_horizontal else "center",
            fontsize=7.0,
            color="#000000",
            bbox=dict(facecolor="white", edgecolor="none", pad=1.0),
        )


def arrow(ax, start, end, label=None, color="#000000", style="-|>", connection="orthogonal"):
    """Draw a clean black connector with only horizontal/vertical segments."""
    del color, style, connection
    sx, sy = start
    ex, ey = end
    if abs(sx - ex) < 0.001 or abs(sy - ey) < 0.001:
        points = [start, end]
    else:
        mid_x = (sx + ex) / 2
        points = [start, (mid_x, sy), (mid_x, ey), end]
    routed_arrow(ax, points, label)


def save_fig(fig, path: Path) -> None:
    fig.savefig(path, bbox_inches="tight", facecolor="white", pad_inches=0.1)
    plt.close(fig)


def architecture_diagram(path: Path) -> None:
    fig, ax = setup_plot(12, 7)
    ax.text(6, 6.75, "MULTIVENT High-Level System Architecture", ha="center", va="top",
            fontsize=15, fontweight="bold", color="#000000")
    box(ax, (0.35, 3.95), (2.2, 2.0), "Users", ["Client", "Service Provider", "Event Coordinator", "Authorized Staff"], "#F5EBDD")
    box(ax, (3.05, 3.95), (2.4, 2.0), "Expo Application", ["React Native + Web", "Role-aware navigation", "Responsive screens", "Supabase client"], "#DDEAF5")
    box(ax, (6.05, 3.95), (2.35, 2.0), "Supabase Backend", ["Authentication", "PostgREST / RPC", "Edge Functions", "Storage / Realtime"], "#DDEFE5")
    box(ax, (9.0, 3.95), (2.55, 2.0), "PostgreSQL", ["Relational data", "RLS policies", "Constraints / triggers", "Snapshots / audit"], "#F6EAED")
    box(ax, (3.0, 0.65), (2.6, 1.85), "Sentiment Edge Layer", ["analyze-review", "analyze-feedback", "summarize-reviews", "Server-side secrets"], "#F5EBDD")
    box(ax, (6.05, 0.65), (2.35, 1.85), "Python NLP API", ["FastAPI", "LDA topics", "FAISS retrieval", "Schema validation"], "#DDEAF5")
    box(ax, (9.0, 0.65), (2.55, 1.85), "Model Provider", ["Pre-trained OpenAI model", "Binary sentiment verdict", "Grounded summaries"], "#F6EAED")
    arrow(ax, (2.55, 4.95), (3.05, 4.95))
    arrow(ax, (5.45, 4.95), (6.05, 4.95))
    arrow(ax, (8.4, 4.95), (9.0, 4.95))
    routed_arrow(
        ax,
        [(6.45, 3.95), (6.45, 3.25), (4.30, 3.25), (4.30, 2.50)],
        "invoke / result",
    )
    arrow(ax, (5.6, 1.57), (6.05, 1.57))
    arrow(ax, (8.4, 1.57), (9.0, 1.57))
    save_fig(fig, path)


def network_diagram(path: Path) -> None:
    fig, ax = setup_plot(12, 7)
    ax.text(6, 6.75, "Network and Communication Architecture", ha="center", va="top",
            fontsize=15, fontweight="bold", color="#000000")
    box(ax, (0.35, 4.1), (2.25, 1.65), "Client Device", ["Android / iOS / browser", "Supabase session token", "No service-role secret"], "#DDEAF5")
    box(ax, (3.15, 4.1), (2.3, 1.65), "Supabase Gateway", ["TLS endpoint", "JWT validation", "Auth / REST / RPC"], "#DDEFE5")
    box(ax, (6.05, 4.1), (2.3, 1.65), "PostgreSQL", ["RLS-filtered queries", "Transactional functions", "Relational constraints"], "#F6EAED")
    box(ax, (9.0, 4.1), (2.55, 1.65), "Object Storage", ["Service images", "Policy-controlled access", "Public/authorized URLs"], "#F5EBDD")
    box(ax, (3.15, 1.15), (2.3, 1.65), "Edge Functions", ["User/session verification", "Privileged DB writes", "Secret isolation"], "#F5EBDD")
    box(ax, (6.05, 1.15), (2.3, 1.65), "Sentiment API", ["X-Analysis-Key", "Container port 8080", "JSON request/response"], "#DDEAF5")
    box(ax, (9.0, 1.15), (2.55, 1.65), "OpenAI API", ["Structured response", "Configured model", "No direct client access"], "#F6EAED")
    arrow(ax, (2.6, 4.9), (3.15, 4.9))
    arrow(ax, (5.45, 4.9), (6.05, 4.9))
    arrow(ax, (8.35, 4.9), (9.0, 4.9))
    arrow(ax, (4.3, 4.1), (4.3, 2.8), "function invoke")
    arrow(ax, (5.45, 1.95), (6.05, 1.95))
    arrow(ax, (8.35, 1.95), (9.0, 1.95))
    ax.text(0.45, 0.42, "Performance controls: filtered RPCs, database indexes, cached review summaries, paged/targeted reads, and asynchronous analysis status.", fontsize=8.2, color="#000000")
    save_fig(fig, path)


def erd_diagram(path: Path) -> None:
    fig, ax = setup_plot(14, 9)
    ax.text(7, 8.75, "Condensed MULTIVENT Entity-Relationship Diagram", ha="center", va="top",
            fontsize=15, fontweight="bold", color="#000000")
    nodes = {
        "profiles": ((0.25, 6.45), (2.15, 1.35), ["PK id", "role", "account status"]),
        "provider_profiles": ((2.95, 6.45), (2.15, 1.35), ["PK id", "FK user_id", "business name"]),
        "services": ((5.65, 6.45), (2.15, 1.35), ["PK id", "FK provider/category", "price + details"]),
        "service_packages": ((8.35, 6.45), (2.15, 1.35), ["PK id", "FK service_id", "price + inclusions"]),
        "service_categories": ((11.05, 6.45), (2.15, 1.35), ["PK id", "name", "active flag"]),
        "events": ((0.25, 3.85), (2.15, 1.5), ["PK id", "FK client/coordinator", "date, guests, budget"]),
        "budget_items": ((2.95, 3.85), (2.15, 1.5), ["PK id", "FK event_id", "category allocation"]),
        "selections": ((5.65, 3.85), (2.15, 1.5), ["PK id", "FK event/service", "option snapshots"]),
        "bookings": ((8.35, 3.85), (2.15, 1.5), ["PK id", "FK event/service", "status + amounts"]),
        "payments": ((11.05, 3.85), (2.15, 1.5), ["PK id", "FK booking/event", "financial snapshots"]),
        "coordinator_profiles": ((0.25, 1.0), (2.15, 1.55), ["PK/FK coordinator", "fee", "availability"]),
        "coordinator_packages": ((2.95, 1.0), (2.15, 1.55), ["PK id", "FK coordinator", "status"]),
        "package_items": ((5.65, 1.0), (2.15, 1.55), ["PK id", "FK package/service", "position"]),
        "financial_transactions": ((8.35, 1.0), (2.15, 1.55), ["PK id", "FK payment/booking", "held/earned/released"]),
        "reviews": ((11.05, 1.0), (2.15, 1.55), ["PK id", "FK booking", "rating + NLP"]),
    }
    for name, (xy, wh, lines) in nodes.items():
        box(ax, xy, wh, name.replace("_", "\n"), lines, fontsize=7.1)

    # Only relationships that can be shown without crossing another entity are
    # drawn here. The complete cardinality list follows the figure as a table.
    relations = [
        ((2.40, 7.10), (2.95, 7.10), None),
        ((5.10, 7.10), (5.65, 7.10), None),
        ((7.80, 7.10), (8.35, 7.10), None),
        ((2.40, 4.60), (2.95, 4.60), None),
        ((7.80, 4.60), (8.35, 4.60), None),
        ((10.50, 4.60), (11.05, 4.60), None),
        ((2.40, 1.78), (2.95, 1.78), None),
        ((5.10, 1.78), (5.65, 1.78), None),
        ((1.33, 6.45), (1.33, 5.35), "owns"),
        ((6.73, 6.45), (6.73, 5.35), "selected"),
        ((9.43, 3.85), (9.43, 2.55), "ledger"),
    ]
    for start, end, label in relations:
        arrow(ax, start, end, label)
    routed_arrow(
        ax,
        [(12.13, 7.80), (12.13, 8.15), (6.73, 8.15), (6.73, 7.80)],
        "category",
    )
    ax.text(
        0.35,
        0.35,
        "The relationship table below the figure documents cross-lane and many-to-many links omitted here for legibility.",
        fontsize=7.6,
        color="#000000",
    )
    save_fig(fig, path)


def erd_entity(ax, xy, title, fields, width=2.5, height=1.7):
    """Draw a conventional ERD entity with a header and keyed attributes."""
    x, y = xy
    header_height = 0.42
    ax.add_patch(Rectangle(
        (x, y), width, height, facecolor="#FFFFFF", edgecolor="#000000", linewidth=1.35
    ))
    ax.add_patch(Rectangle(
        (x, y + height - header_height), width, header_height,
        facecolor="#000000", edgecolor="#000000", linewidth=1.35,
    ))
    ax.text(
        x + width / 2, y + height - header_height / 2, title,
        ha="center", va="center", fontsize=10.0, fontweight="bold", color="#FFFFFF",
    )
    field_y = y + height - header_height - 0.13
    for field in fields:
        ax.text(x + 0.14, field_y, field, ha="left", va="top", fontsize=8.8, color="#000000")
        field_y -= 0.22


def _erd_cardinality_marker(ax, endpoint, neighbor, cardinality):
    """Draw a crow's-foot marker plus an explicit min..max label."""
    ex, ey = endpoint
    nx, ny = neighbor
    dx = nx - ex
    dy = ny - ey
    length = max((dx * dx + dy * dy) ** 0.5, 0.001)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux

    first = (ex + ux * 0.12, ey + uy * 0.12)
    second = (ex + ux * 0.28, ey + uy * 0.28)

    def bar(center):
        ax.plot(
            [center[0] - px * 0.085, center[0] + px * 0.085],
            [center[1] - py * 0.085, center[1] + py * 0.085],
            color="#000000", linewidth=1.2,
        )

    minimum, maximum = cardinality.split("..") if ".." in cardinality else ("1", "1")
    if minimum == "0":
        ax.add_patch(plt.Circle(first, 0.055, facecolor="#FFFFFF", edgecolor="#000000", linewidth=1.1))
    else:
        bar(first)

    if maximum == "1":
        bar(second)
    else:
        vertex = second
        tips = [
            (vertex[0] + ux * 0.19 + px * 0.11, vertex[1] + uy * 0.19 + py * 0.11),
            (vertex[0] + ux * 0.19, vertex[1] + uy * 0.19),
            (vertex[0] + ux * 0.19 - px * 0.11, vertex[1] + uy * 0.19 - py * 0.11),
        ]
        for tip in tips:
            ax.plot([vertex[0], tip[0]], [vertex[1], tip[1]], color="#000000", linewidth=1.1)

    label_x = ex + ux * 0.43 + px * 0.16
    label_y = ey + uy * 0.43 + py * 0.16
    ax.text(
        label_x, label_y, cardinality, ha="center", va="center", fontsize=8.5,
        fontweight="bold", color="#000000",
        bbox=dict(facecolor="#FFFFFF", edgecolor="none", pad=0.35),
    )


def erd_relation(ax, points, start_cardinality, end_cardinality):
    """Draw an orthogonal, non-directional ERD relation with both cardinalities."""
    for first, second in zip(points[:-1], points[1:]):
        if abs(first[0] - second[0]) > 0.001 and abs(first[1] - second[1]) > 0.001:
            raise ValueError("ERD relation segments must be horizontal or vertical.")
        ax.plot([first[0], second[0]], [first[1], second[1]], color="#000000", linewidth=1.3)
    _erd_cardinality_marker(ax, points[0], points[1], start_cardinality)
    _erd_cardinality_marker(ax, points[-1], points[-2], end_cardinality)


def erd_legend(ax, y):
    ax.text(
        5, y,
        "Cardinality:  1 = exactly one     0..1 = optional one     0..* = zero or many     1..* = one or many",
        ha="center", va="center", fontsize=8.6, color="#000000",
        bbox=dict(facecolor="#FFFFFF", edgecolor="#000000", linewidth=0.8, pad=3.0),
    )


def erd_marketplace_diagram(path: Path) -> None:
    fig, ax = setup_plot(10, 7)
    ax.text(5, 6.78, "Marketplace and Package ERD", ha="center", va="top",
            fontsize=16, fontweight="bold", color="#000000")
    erd_legend(ax, 6.28)
    erd_entity(ax, (0.35, 3.95), "profiles", [
        "PK  id", "full_name", "default_role", "account_status",
    ])
    erd_entity(ax, (3.75, 3.95), "provider_profiles", [
        "PK  id", "FK/UQ  user_id", "business_name", "verification_status",
    ])
    erd_entity(ax, (7.15, 3.95), "services", [
        "PK  id", "FK  provider_id", "FK  category_id (NULL)", "name / base_price", "status",
    ])
    erd_entity(ax, (0.35, 0.75), "service_categories", [
        "PK  id", "UQ  name", "description", "is_active",
    ])
    erd_entity(ax, (3.75, 0.75), "service_package_items", [
        "PK  id", "FK/UQ  package_id", "FK/UQ  service_id", "quantity / unit_price", "position",
    ])
    erd_entity(ax, (7.15, 0.75), "service_packages", [
        "PK  id", "FK  service_id", "name / price", "pricing_mode", "is_active",
    ])

    erd_relation(ax, [(2.85, 4.80), (3.75, 4.80)], "1", "0..1")
    erd_relation(ax, [(6.25, 4.80), (7.15, 4.80)], "1", "0..*")
    erd_relation(ax, [(1.60, 2.45), (1.60, 3.15), (7.65, 3.15), (7.65, 3.95)], "0..1", "0..*")
    erd_relation(ax, [(8.40, 3.95), (8.40, 2.45)], "1", "0..*")
    erd_relation(ax, [(7.15, 1.60), (6.25, 1.60)], "1", "0..*")
    erd_relation(ax, [(9.65, 4.80), (9.85, 4.80), (9.85, 0.40), (5.00, 0.40), (5.00, 0.75)], "1", "0..*")
    save_fig(fig, path)


def erd_planning_diagram(path: Path) -> None:
    fig, ax = setup_plot(10, 6.5)
    ax.text(5, 6.28, "Event Planning and Selection ERD", ha="center", va="top",
            fontsize=16, fontweight="bold", color="#000000")
    erd_legend(ax, 5.78)
    erd_entity(ax, (0.35, 3.65), "profiles", [
        "PK  id", "full_name", "default_role", "account_status",
    ])
    erd_entity(ax, (3.75, 3.65), "events", [
        "PK  id", "FK  client_id", "FK  coordinator_id (NULL)", "date / guests / budget", "status",
    ])
    erd_entity(ax, (7.15, 3.65), "event_budget_items", [
        "PK  id", "FK  event_id", "FK  category_id (NULL)", "category_key", "allocated_amount",
    ])
    erd_entity(ax, (0.35, 0.55), "service_categories", [
        "PK  id", "UQ  name", "description", "is_active",
    ])
    erd_entity(ax, (3.75, 0.55), "services", [
        "PK  id", "FK  provider_id", "FK  category_id (NULL)", "name / base_price", "status",
    ])
    erd_entity(ax, (7.15, 0.55), "event_service_selections", [
        "PK  id", "FK  event_id", "FK  service_id (NULL)", "FK  package_id (NULL)", "category / snapshots",
    ])

    erd_relation(ax, [(2.85, 4.50), (3.75, 4.50)], "1", "0..*")
    erd_relation(ax, [(6.25, 4.50), (7.15, 4.50)], "1", "0..*")
    erd_relation(ax, [(5.00, 3.65), (5.00, 3.05), (8.40, 3.05), (8.40, 2.25)], "1", "0..*")
    erd_relation(ax, [(2.85, 1.40), (3.75, 1.40)], "0..1", "0..*")
    erd_relation(ax, [(6.25, 1.40), (7.15, 1.40)], "0..1", "0..*")
    save_fig(fig, path)


def erd_booking_diagram(path: Path) -> None:
    fig, ax = setup_plot(10, 6.5)
    ax.text(5, 6.28, "Booking, Payment, Ledger, and Review ERD", ha="center", va="top",
            fontsize=16, fontweight="bold", color="#000000")
    erd_legend(ax, 5.78)
    erd_entity(ax, (0.35, 3.65), "events", [
        "PK  id", "FK  client_id", "event_date / time", "status",
    ])
    erd_entity(ax, (3.75, 3.65), "bookings", [
        "PK  id", "FK  event_id", "FK  service_id", "FK  provider_id", "status / amounts",
    ])
    erd_entity(ax, (7.15, 3.65), "payments", [
        "PK  id", "FK  booking_id (NULL)", "FK  event_id (NULL)", "amount / status", "financial snapshots",
    ])
    erd_entity(ax, (0.35, 0.55), "services", [
        "PK  id", "FK  provider_id", "FK  category_id (NULL)", "name / base_price", "status",
    ])
    erd_entity(ax, (3.75, 0.55), "reviews", [
        "PK  id", "FK/UQ  booking_id", "FK  reviewer_id", "rating / comment", "sentiment fields",
    ])
    erd_entity(ax, (7.15, 0.55), "financial_transactions", [
        "PK  id", "FK  payment_id (NULL)", "FK  booking_id (NULL)", "gross / commission", "held / earned / released",
    ])

    erd_relation(ax, [(2.85, 4.50), (3.75, 4.50)], "1", "0..*")
    erd_relation(ax, [(6.25, 4.50), (7.15, 4.50)], "0..1", "0..*")
    erd_relation(ax, [(1.60, 2.25), (1.60, 3.05), (3.40, 3.05), (3.40, 4.15), (3.75, 4.15)], "1", "0..*")
    erd_relation(ax, [(5.00, 3.65), (5.00, 2.25)], "1", "0..1")
    erd_relation(ax, [(8.40, 3.65), (8.40, 2.25)], "0..1", "0..*")
    save_fig(fig, path)


def modules_diagram(path: Path) -> None:
    fig, ax = setup_plot(12, 8)
    ax.text(6, 7.75, "Application and Module Architecture", ha="center", va="top", fontsize=15,
            fontweight="bold", color="#000000")
    box(ax, (4.1, 6.15), (3.8, 1.0), "Shared Application Shell",
        ["Session • role routing • reusable interface • Supabase client"], fontsize=7.7)
    role_modules = [
        (0.45, "Client", ["events and budgets", "recommendations", "selection and payment"]),
        (3.35, "Provider", ["listings and availability", "booking decisions", "earnings and payouts"]),
        (6.25, "Coordinator", ["service profile", "curated packages", "assignments and tasks"]),
        (9.15, "Authorized Staff", ["accounts and RBAC", "moderation/support", "finance and audit"]),
    ]
    for x, title, lines in role_modules:
        box(ax, (x, 3.85), (2.4, 1.45), title, lines, fontsize=7.6)

    # A shared bus keeps every connector orthogonal and outside the boxes.
    ax.plot([1.65, 10.35], [5.75, 5.75], color="#000000", linewidth=1.25)
    arrow(ax, (6, 6.15), (6, 5.75))
    for x, _, _ in role_modules:
        center = x + 1.2
        arrow(ax, (center, 5.75), (center, 5.30))

    box(ax, (1.0, 1.05), (10.0, 1.65), "Shared Business and Data Services", [
        "Marketplace and booking • communication and notifications • reviews and NLP • support",
        "PostgreSQL RPCs • RLS • constraints • triggers • immutable snapshots • audit records",
    ], fontsize=8.0)
    ax.plot([1.65, 10.35], [3.25, 3.25], color="#000000", linewidth=1.25)
    for x, _, _ in role_modules:
        center = x + 1.2
        arrow(ax, (center, 3.85), (center, 3.25))
    arrow(ax, (6, 3.25), (6, 2.70))
    ax.text(6, 0.48, "Cross-cutting controls: authentication • authorization • validation • auditability • responsive presentation", ha="center", fontsize=8.3, color="#000000")
    save_fig(fig, path)


def security_diagram(path: Path) -> None:
    fig, ax = setup_plot(12, 7)
    ax.text(6, 6.75, "Security Architecture: Defense in Depth", ha="center", va="top", fontsize=15,
            fontweight="bold", color="#000000")
    layers = [
        (0.55, 5.1, 10.9, 0.9, "Identity Layer", "Supabase Auth • verified session • password recovery • account status"),
        (1.05, 4.0, 9.9, 0.9, "Access-Control Layer", "roles + permissions • role routing • PostgreSQL RLS • auth.uid() ownership checks"),
        (1.55, 2.9, 8.9, 0.9, "Business-Rule Layer", "security-definer RPCs • explicit grants/revokes • constraints • transactional row locks"),
        (2.05, 1.8, 7.9, 0.9, "Data-Protection Layer", "server-side secrets • redacted audits • snapshots • protected storage policies"),
        (2.55, 0.7, 6.9, 0.9, "Monitoring & Recovery", "audit logs • notifications • error states\nversioned migrations • retained history"),
    ]
    fills = ["#FFFFFF"] * 5
    for (x, y, w, h, title, desc), fill in zip(layers, fills):
        patch = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.04,rounding_size=0.12", linewidth=1.4, edgecolor="#000000", facecolor=fill)
        ax.add_patch(patch)
        ax.text(x + 0.25, y + h / 2, title, ha="left", va="center", fontsize=9, fontweight="bold", color="#000000")
        ax.text(x + 2.7, y + h / 2, desc, ha="left", va="center", fontsize=7.3, color="#000000")
    save_fig(fig, path)


def deployment_diagram(path: Path) -> None:
    fig, ax = setup_plot(12, 7)
    ax.text(6, 6.75, "Deployment Architecture", ha="center", va="top", fontsize=15,
            fontweight="bold", color="#000000")
    box(ax, (0.35, 4.0), (2.45, 1.85), "User Runtime", ["Android / iOS app", "or React Native Web", "Expo build/runtime"], "#DDEAF5")
    box(ax, (3.25, 4.0), (2.45, 1.85), "Supabase Project", ["Auth", "PostgreSQL", "Edge Functions", "Storage / Realtime"], "#DDEFE5")
    box(ax, (6.15, 4.0), (2.45, 1.85), "Sentiment Container", ["Python 3.13", "FastAPI + Uvicorn", "models + FAISS index", "PORT 8080"], "#F5EBDD")
    box(ax, (9.05, 4.0), (2.55, 1.85), "External Model API", ["OpenAI Responses API", "structured output", "provider-managed runtime"], "#F6EAED")
    box(ax, (0.35, 1.0), (2.45, 1.85), "Build Workstation / CI", ["Node + npm", "Expo/EAS profiles", "TypeScript + ESLint"], "#F1F3F5")
    box(ax, (3.25, 1.0), (2.45, 1.85), "Database Release", ["ordered SQL migrations", "seed data (optional)", "rollback via transaction"], "#F1F3F5")
    box(ax, (6.15, 1.0), (2.45, 1.85), "ML Artifact Build", ["registered datasets", "LDA/vectorizer", "encoder + FAISS", "evaluation report"], "#F1F3F5")
    box(ax, (9.05, 1.0), (2.55, 1.85), "Configured Target", ["Azure Container Apps", "Dockerfile.azure", "secrets/env settings", "health endpoint"], "#F1F3F5")
    arrow(ax, (2.8, 4.92), (3.25, 4.92))
    arrow(ax, (5.7, 4.92), (6.15, 4.92))
    arrow(ax, (8.6, 4.92), (9.05, 4.92))
    arrow(ax, (1.58, 2.85), (1.58, 4.0), "build")
    arrow(ax, (4.48, 2.85), (4.48, 4.0), "migrate")
    arrow(ax, (7.38, 2.85), (7.38, 4.0), "embed")
    routed_arrow(ax, [(10.33, 2.85), (10.33, 3.35), (8.30, 3.35), (8.30, 4.0)], "deploy")
    save_fig(fig, path)


def use_case_diagram(path: Path) -> None:
    fig, ax = setup_plot(14, 9)
    ax.text(7, 8.75, "MULTIVENT Use Case Diagram", ha="center", va="top", fontsize=15,
            fontweight="bold", color="#000000")
    ax.add_patch(Rectangle((2.1, 0.45), 9.8, 7.65, fill=False, linewidth=1.5, edgecolor="#000000"))
    ax.text(7, 7.9, "MULTIVENT System Boundary", ha="center", va="top", fontsize=10, fontweight="bold", color="#000000")

    def actor(x, y, label):
        ax.scatter([x + 0.55], [y + 0.62], s=140, facecolors="white", edgecolors="#000000", linewidths=1.2)
        ax.plot([x + 0.55, x + 0.55], [y + 0.5, y + 0.05], color="#000000", linewidth=1.2)
        ax.plot([x + 0.25, x + 0.85], [y + 0.35, y + 0.35], color="#000000", linewidth=1.2)
        ax.plot([x + 0.55, x + 0.25], [y + 0.05, y - 0.25], color="#000000", linewidth=1.2)
        ax.plot([x + 0.55, x + 0.85], [y + 0.05, y - 0.25], color="#000000", linewidth=1.2)
        ax.text(x + 0.55, y - 0.43, label, ha="center", va="top", fontsize=8.2, fontweight="bold")

    actor(0.25, 6.45, "Client")
    actor(0.25, 4.65, "Service\nProvider")
    actor(0.25, 2.85, "Event\nCoordinator")
    actor(0.25, 1.05, "Authorized\nStaff")
    actor(12.25, 2.05, "NLP / Model\nService")

    groups = [
        (2.85, 6.15, 7.8, 1.05, "Client Planning and Booking", "register/sign in • create event/budget • select coordinator/services • pay • message • review"),
        (2.85, 4.35, 7.8, 1.05, "Provider Operations", "manage listings/availability • accept or reject • communicate • track earnings and payouts"),
        (2.85, 2.55, 5.3, 1.05, "Coordinator Operations", "manage profile/packages • accept or reject\ncoordinate event tasks • view remittances"),
        (2.85, 0.75, 5.3, 1.05, "Staff Governance", "manage authorized accounts • moderate listings • support • finance • audit"),
        (8.75, 2.15, 2.7, 1.45, "Review Analysis", "topic inference\nretrieval\nsentiment and summaries"),
    ]
    for x, y, w, h, title, detail in groups:
        box(ax, (x, y), (w, h), title, [detail], fontsize=7.0)

    arrow(ax, (1.1, 6.82), (2.85, 6.82))
    arrow(ax, (1.1, 5.02), (2.85, 5.02))
    arrow(ax, (1.1, 3.22), (2.85, 3.22))
    arrow(ax, (1.1, 1.42), (2.85, 1.42))
    arrow(ax, (12.25, 2.42), (11.45, 2.42))
    save_fig(fig, path)


def dfd_context_diagram(path: Path) -> None:
    fig, ax = setup_plot(12, 7)
    ax.text(6, 6.75, "Level 0 Data Flow Diagram (Context)", ha="center", va="top", fontsize=15,
            fontweight="bold", color="#000000")
    box(ax, (4.15, 2.6), (3.7, 1.9), "0. MULTIVENT", ["Event-services marketplace", "planning, booking, payment,", "operations, reviews"], "#F6EAED", fontsize=8.2)
    externals = [
        ((0.35, 4.55), "Client", ["event/service choices", "payment/review data"]),
        ((0.35, 0.85), "Service Provider", ["listing/availability", "booking decision"]),
        ((9.25, 4.55), "Event Coordinator", ["fee/packages", "assignment decision"]),
        ((9.25, 0.85), "Authorized Staff", ["moderation/RBAC", "support/finance"]),
    ]
    for xy, title, lines in externals:
        box(ax, xy, (2.4, 1.55), title, lines, "#DDEAF5")
    arrow(ax, (2.75, 5.0), (4.15, 3.85), "requests / input")
    arrow(ax, (4.15, 3.35), (2.75, 4.65), "plans / status")
    arrow(ax, (2.75, 1.55), (4.15, 2.95), "catalog / decisions")
    arrow(ax, (4.15, 2.7), (2.75, 1.25), "requests / earnings")
    arrow(ax, (9.25, 5.0), (7.85, 3.85), "profile / decisions")
    arrow(ax, (7.85, 3.35), (9.25, 4.65), "requests / events")
    arrow(ax, (9.25, 1.55), (7.85, 2.95), "admin actions")
    arrow(ax, (7.85, 2.7), (9.25, 1.25), "queues / reports")
    save_fig(fig, path)


def dfd_level1_diagram(path: Path) -> None:
    fig, ax = setup_plot(14, 9)
    ax.text(7, 8.75, "Level 1 Data Flow Diagram", ha="center", va="top", fontsize=15,
            fontweight="bold", color="#000000")
    processes = [
        ((0.35, 6.45), "1.0 Identity & Access"), ((3.75, 6.45), "2.0 Event Planning"), ((7.15, 6.45), "3.0 Marketplace & Selection"), ((10.55, 6.45), "4.0 Booking & Payment"),
        ((0.35, 4.05), "5.0 Provider / Coordinator Ops"), ((3.75, 4.05), "6.0 Messaging & Support"), ((7.15, 4.05), "7.0 Reviews & NLP"), ((10.55, 4.05), "8.0 Staff Governance"),
    ]
    for xy, title in processes:
        box(ax, xy, (3.0, 1.15), title, (), fontsize=7.7)
    stores = [
        ((0.30, 0.75), "D1 Users & RBAC"), ((3.00, 0.75), "D2 Events & Budgets"), ((5.70, 0.75), "D3 Services & Packages"), ((8.40, 0.75), "D4 Bookings & Finance"), ((11.10, 0.75), "D5 Reviews / Audit / Support"),
    ]
    for xy, title in stores:
        x, y = xy
        ax.add_patch(Rectangle((x, y), 2.3, 0.75, facecolor="#FFFFFF", edgecolor="#000000", linewidth=1.2))
        ax.plot([x, x + 2.3], [y + 0.16, y + 0.16], color="#000000", linewidth=0.8)
        ax.text(x + 1.15, y + 0.46, title, ha="center", va="center", fontsize=7.0, fontweight="bold")

    # Process flow uses two clean horizontal rows.
    for x in (3.35, 6.75, 10.15):
        arrow(ax, (x, 7.02), (x + 0.40, 7.02))
        arrow(ax, (x, 4.62), (x + 0.40, 4.62))

    # Upper processes hand work to the role/governance process below them.
    # The lower row shares a single database-access bus so all lines remain
    # orthogonal, visible, and free from crossovers.
    for x in (1.85, 5.25, 8.65, 12.05):
        arrow(ax, (x, 6.45), (x, 5.20))
    ax.plot([1.45, 12.25], [2.65, 2.65], color="#000000", linewidth=1.25)
    for x in (1.85, 5.25, 8.65, 12.05):
        arrow(ax, (x, 4.05), (x, 2.65))
    for x in (1.45, 4.15, 6.85, 9.55, 12.25):
        arrow(ax, (x, 2.65), (x, 1.50))
    ax.text(7, 7.9, "Authenticated role-specific input", ha="center", fontsize=8.2, color="#000000")
    ax.text(7, 2.83, "Validated writes and authorized reads through RPC/RLS", ha="center", fontsize=8.0, color="#000000",
            bbox=dict(facecolor="white", edgecolor="none", pad=1.5))
    save_fig(fig, path)


def ui_wireframe(path: Path) -> None:
    fig, ax = setup_plot(14, 8)
    ax.text(7, 7.75, "Representative Input Screen Layouts", ha="center", va="top", fontsize=15,
            fontweight="bold", color="#000000")
    panels = [
        (0.35, "Client Event Setup", ["Event name", "Event type", "Date and time", "Guest count", "Venue status/location", "Continue"]),
        (3.8, "Budget Allocation", ["Total budget", "Category amounts", "Remaining budget", "Locked selected cost", "Save allocations"]),
        (7.25, "Service Selection", ["Provider option/package", "Catering menu", "Venue option", "Booking hours", "Calculated total", "Select service"]),
        (10.7, "Provider Listing", ["Category and name", "Description/images", "Pricing/options", "Capacity/rules", "Availability", "Review and submit"]),
    ]
    for x, title, fields in panels:
        ax.add_patch(FancyBboxPatch((x, 0.65), 2.95, 6.25, boxstyle="round,pad=0.05,rounding_size=0.18", facecolor="#FFFFFF", edgecolor="#000000", linewidth=1.5))
        ax.add_patch(Rectangle((x, 6.25), 2.95, 0.65, facecolor="#000000", edgecolor="#000000"))
        ax.text(x + 1.475, 6.57, title, ha="center", va="center", fontsize=8.3, fontweight="bold", color="white")
        y = 5.72
        for idx, field in enumerate(fields):
            if idx == len(fields) - 1:
                ax.add_patch(FancyBboxPatch((x + 0.35, y - 0.05), 2.25, 0.55, boxstyle="round,pad=0.03,rounding_size=0.12", facecolor="#000000", edgecolor="#000000"))
                ax.text(x + 1.475, y + 0.22, field, ha="center", va="center", fontsize=7.3, fontweight="bold", color="white")
            else:
                ax.text(x + 0.25, y + 0.43, field.upper(), ha="left", va="bottom", fontsize=6.2, color="#000000")
                ax.add_patch(FancyBboxPatch((x + 0.22, y - 0.05), 2.5, 0.40, boxstyle="round,pad=0.02,rounding_size=0.06", facecolor="white", edgecolor="#000000", linewidth=0.8))
            y -= 0.82
    save_fig(fig, path)


def make_diagrams(directory: Path) -> dict[str, Path]:
    directory.mkdir(parents=True, exist_ok=True)
    makers = {
        "architecture": architecture_diagram,
        "network": network_diagram,
        "erd_marketplace": erd_marketplace_diagram,
        "erd_planning": erd_planning_diagram,
        "erd_booking": erd_booking_diagram,
        "modules": modules_diagram,
        "security": security_diagram,
        "deployment": deployment_diagram,
        "use_case": use_case_diagram,
        "dfd_context": dfd_context_diagram,
        "dfd_level1": dfd_level1_diagram,
        "ui_wireframe": ui_wireframe,
    }
    paths = {}
    for name, maker in makers.items():
        path = directory / f"{name}.png"
        maker(path)
        paths[name] = path
    return paths


def add_front_matter(document: Document) -> None:
    document.core_properties.title = "MULTIVENT Programmer’s Chapter Manuscript"
    document.core_properties.subject = "System architecture, design, interface, testing, and evaluation"
    document.core_properties.author = "MULTIVENT Capstone Team"
    document.core_properties.keywords = "MULTIVENT, architecture, ERD, DFD, use case, ISO 25010, sentiment analysis"

    document.add_paragraph("\n\n")
    title = document.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.add_run("MULTIVENT")
    subtitle = document.add_paragraph(style="Subtitle")
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.add_run("Programmer’s Chapter Manuscript — Black-and-White Print Edition")
    descriptor = document.add_paragraph()
    descriptor.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = descriptor.add_run("System Architecture, System Design, User Interface,\nTesting, and Evaluation")
    run.bold = True
    run.font.size = Pt(16)
    run.font.color.rgb = hex_rgb(WINE_DARK)
    document.add_paragraph("\n")
    scope = document.add_paragraph()
    scope.alignment = WD_ALIGN_PARAGRAPH.CENTER
    scope.add_run("Implementation-grounded manuscript draft\n").bold = True
    scope.add_run("Prepared from the current MULTIVENT source code, database migrations,\nSupabase functions, and sentiment-training artifacts")
    document.add_paragraph("\n")
    date = document.add_paragraph()
    date.alignment = WD_ALIGN_PARAGRAPH.CENTER
    date.add_run("Repository evidence reviewed: October 8, 2026\n")
    date.add_run("Application workspace: D:\\Multivent\\Project-CaPoy\\Capstone\n")
    date.add_run("ML workspace: D:\\Sentiment Training\\multivent-sentiment")
    document.add_paragraph("\n")
    note = document.add_paragraph()
    note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    note.add_run("For manuscript integration by the programmer/researcher").italic = True
    document.add_page_break()

    document.add_heading("Document Scope and Evidence Rule", level=1)
    document.add_paragraph(
        "This manuscript answers every item assigned in HARVEY&CAANG.pdf that concerns the programmer: "
        "system architecture and its network, database, module, security, integration, and deployment views; "
        "system design; user-interface and input-screen layout; and system testing and evaluation. The text "
        "describes the system as implemented in the reviewed repository. Proposed features, live-service claims, "
        "and evaluation scores that are not supported by stored evidence are intentionally excluded."
    )
    add_callout(
        document,
        "Important reporting boundary",
        "The repository implements an internal payment-record and accounting workflow, but the reviewed code uses generated demo payment references rather than a confirmed external payment-gateway integration. Likewise, the Azure container files establish a deployment target for the sentiment service; they do not, by themselves, prove that a production instance is currently online. UAT, Lighthouse, and ISO/IEC 25010 instruments are provided, but their scores must be filled only after actual evaluation.",
        LIGHT_GOLD,
    )
    document.add_heading("System Overview", level=1)
    document.add_paragraph(
        "MULTIVENT is a role-based event-services marketplace and planning application implemented with "
        "React Native/Expo and Supabase. Clients create events, distribute a budget, browse budget-aware "
        "recommendations, select one active service per category, optionally engage a paid event coordinator "
        "or a coordinator-curated package, submit booking requests, record payments, communicate, and review "
        "completed services. Providers manage listings, packages, availability, booking decisions, earnings, "
        "and payout requests. Coordinators operate as independently bookable providers and manage profiles, "
        "curated packages, assignments, tasks, and remittance views. Authorized staff manage accounts, access, "
        "listings, support, finance, audit, and configuration through role and permission controls."
    )
    document.add_paragraph(
        "The current revision centralizes event-aware pricing. Catering uses a provider-defined menu option and "
        "the event guest count. Venue selection uses provider-defined venue options and the client’s requested "
        "booking hours while enforcing capacity, minimum/maximum duration, schedule, setup, and operating rules. "
        "Selected values and calculated amounts are snapshotted so later listing edits do not silently rewrite "
        "the transaction history."
    )
    document.add_page_break()
    add_toc(document)


def add_architecture_sections(document: Document, diagrams: dict[str, Path]) -> None:
    document.add_heading("3.6 System Architecture", level=1)
    document.add_paragraph(
        "MULTIVENT follows a layered client–backend–service architecture. A single Expo codebase supplies the "
        "mobile and web interface, while Supabase supplies authentication, PostgreSQL persistence, RPCs, Row "
        "Level Security (RLS), Edge Functions, object storage, and realtime-capable communication. A separate "
        "FastAPI sentiment service performs NLP inference and is reached only through server-side Edge Functions. "
        "This separation keeps role-specific presentation, transactional business rules, durable data, and "
        "machine-learning inference in independently controlled layers."
    )
    add_figure(document, diagrams["architecture"], "Figure 3.6-1. High-level architecture of the implemented MULTIVENT system.")
    add_table(document, ["Layer", "Implemented responsibility", "Principal technology"], [
        ["Presentation", "Responsive client, provider, coordinator, and staff screens; validation feedback and state", "React Native 0.86, React 19, Expo 57, React Native Web"],
        ["Application access", "Session handling, role routing, data requests, Edge Function invocation", "TypeScript, Supabase JavaScript client"],
        ["Business/data", "RLS, transactional RPCs, constraints, triggers, snapshots, audit and notification records", "Supabase PostgreSQL"],
        ["Serverless integration", "Privileged account tasks and secure review/feedback analysis orchestration", "Supabase Edge Functions (Deno/TypeScript)"],
        ["NLP service", "Normalization, LDA topic inference, FAISS retrieval, structured sentiment and summaries", "Python, FastAPI, scikit-learn, Sentence Transformers, FAISS, OpenAI API"],
    ], widths=[1.25, 3.5, 2.15])

    document.add_heading("3.6.1 Network Architecture", level=2)
    document.add_paragraph(
        "The client communicates with Supabase through its hosted HTTPS interfaces. Authentication produces a "
        "session/JWT used by PostgREST, RPC, Storage, and Edge Function calls. PostgreSQL applies the token’s user "
        "identity to RLS and function-level ownership tests. The application never receives the service-role key, "
        "sentiment-service URL secret, or analysis API key. For comment analysis, an authenticated client invokes "
        "an Edge Function; the function validates the user and record, calls the protected Python service with an "
        "X-Analysis-Key header, validates the JSON result, and writes the approved fields back to PostgreSQL."
    )
    add_figure(document, diagrams["network"], "Figure 3.6.1-1. Network paths, trust boundaries, and data exchange.")
    document.add_paragraph("Connectivity, performance, and security are addressed as follows:")
    add_bullets(document, [
        "Connectivity: the Expo application can run on Android, iOS, and the web and uses environment-configured Supabase endpoints.",
        "Performance: targeted RPCs and database indexes reduce client round trips; review summaries are cached and analysis exposes explicit pending/failed/completed states.",
        "Security: authenticated requests carry user identity; RLS and owner-aware RPCs limit records; privileged secrets remain in Edge Function or container configuration.",
        "Consistency: pricing, booking responses, package application, financial allocation, and category locking execute in database transactions rather than independent browser writes.",
        "Failure handling: application modules return explicit errors, sentiment calls record retry/failure state, and financial actions either commit together or roll back."
    ])

    document.add_heading("3.6.2 Database Model", level=2)
    document.add_paragraph(
        "The relational model organizes users, marketplace supply, event demand, selections, bookings, finance, "
        "communication, governance, and review analysis. UUID primary keys identify major records. Foreign keys "
        "define ownership and lifecycle rules; unique and check constraints prevent invalid states; indexes support "
        "owner, status, schedule, and category access paths. JSONB is used only for structured category-specific "
        "details, immutable option/pricing snapshots, analysis metadata, and extensible audit payloads. Core identity, "
        "ownership, status, amounts, and relationships remain relational."
    )
    add_table(document, ["Domain", "Principal tables", "Purpose"], [
        ["Identity and access", "profiles, roles, permissions, role_permissions, user_roles, user_permissions", "Accounts, status, role assignment, and fine-grained staff authorization"],
        ["Marketplace", "provider_profiles, service_categories, services, service_packages, service_package_items", "Provider identity, listings, category details, provider packages, and composed services"],
        ["Planning", "events, event_requirements, event_budget_items, event_service_selections, event instructions/schedule checks", "Event specification, category budgets, one-per-category choices, instructions, and conflict checks"],
        ["Coordinator", "coordinator_service_profiles, coordinator_availability, coordinator_packages/items, assignment_attempts", "Paid coordinator profiles, availability, curated packages, and explicit accept/reject attempts"],
        ["Booking and finance", "bookings, payments, financial_transactions, cash_remittances, payout accounts/requests", "Booking state, payment snapshots, held/earned/released amounts, remittance, and payout workflow"],
        ["Communication", "conversations, participants, messages, notifications, support_tickets/messages", "In-app communication, alerts, and scoped customer support"],
        ["Quality and governance", "reviews, event_feedback, service_review_summaries, audit_logs, system_settings", "Ratings/comments, NLP outputs, cached summaries, audit trail, and configuration"],
    ])
    document.add_paragraph(
        "A typical data flow begins with a client-owned event. Category allocations are attached to the event. A "
        "service selection references the real provider listing and captures selected catering or venue options. A "
        "booking then preserves the financial and option snapshots. Payment records feed the ledger, which keeps "
        "platform revenue, held provider funds, earned provider balance, and externally released payout values "
        "separate. Reviews are accepted only for qualifying booking relationships and may receive sentiment/topic "
        "metadata through the protected analysis workflow."
    )
    document.add_paragraph(
        "Integrity and consistency are enforced through foreign keys, status and non-negative amount checks, unique "
        "indexes, one-service-per-category triggers, budget-total validation, event-aware quote RPCs, row locks, and "
        "versioned immutable snapshots. Security is enforced through RLS and explicit grants; sensitive administrative "
        "or financial mutations are exposed through authorized functions rather than unrestricted table writes."
    )

    document.add_heading("3.6.2.1 Entity–Relationship Diagram", level=3)
    document.add_paragraph(
        "The implemented schema is divided into three ERD views so every foreign-key path and cardinality remains "
        "readable in print. Repeated entities represent the same physical table. Connector ends use both crow's-foot "
        "symbols and explicit minimum..maximum labels. All connector routes use horizontal and vertical segments."
    )
    add_figure(document, diagrams["erd_marketplace"],
               "Figure 3.6.2.1-1. Marketplace and provider-package ERD with implemented cardinalities.", width=6.75)
    add_figure(document, diagrams["erd_planning"],
               "Figure 3.6.2.1-2. Event planning and service-selection ERD.", width=6.75)
    add_figure(document, diagrams["erd_booking"],
               "Figure 3.6.2.1-3. Booking, payment, ledger, and review ERD.", width=6.75)
    add_table(document, ["Relationship", "Cardinality", "Implementation meaning"], [
        ["Profile — Provider profile", "1 : 0..1", "A user account may own one provider business profile."],
        ["Provider profile — Service", "1 : 0..*", "Every service has one provider; a provider may publish many service listings."],
        ["Service category — Service", "0..1 : 0..*", "The category FK is nullable; a category may group many services."],
        ["Client profile — Event", "1 : 0..*", "Each event is owned by one client; a client may plan multiple events."],
        ["Event — Budget item", "1 : 0..*", "An event may have category allocations; Phase 7/9 keeps one versioned allocation per category."],
        ["Event — Service selection", "1 : 0..*", "An event may select services across categories; active Phase 9 choices are unique per category."],
        ["Service — Event selection", "0..1 : 0..*", "The selection FK may be cleared when a listing is removed; a service may appear in many selections."],
        ["Event — Booking", "1 : 0..*", "A booking belongs to exactly one event; an event may create multiple booking records."],
        ["Service — Booking", "1 : 0..*", "Every booking references one service; a service may be booked many times."],
        ["Booking — Payment", "0..1 : 0..*", "A payment may reference one booking or use event scope; a booking may have multiple payment attempts."],
        ["Payment — Financial transaction", "0..1 : 0..*", "A ledger row may retain one payment reference; a payment may produce multiple classified ledger entries."],
        ["Coordinator — Curated package", "1 : 0..*", "A coordinator may own multiple packages that reference actual provider services."],
        ["Curated package — Service", "many : many through items", "Package items reference listings without copying provider ownership."],
        ["Booking — Review", "1 : 0..1 per allowed review context", "A completed relationship can yield a rating/comment with optional analysis."],
    ])

    document.add_heading("3.6.3 Application/Module Architecture", level=2)
    document.add_paragraph(
        "The application is organized around role-aware screens and shared TypeScript data libraries. App.tsx owns "
        "session-level navigation and routes users into client, provider, coordinator, or staff experiences. Screen "
        "components collect input and present states; library modules call Supabase tables, RPCs, and functions; SQL "
        "functions remain authoritative for cross-record rules and financial calculations. This design prevents a "
        "visual client from becoming the sole enforcement point."
    )
    add_figure(document, diagrams["modules"], "Figure 3.6.3-1. Functional modules and their shared application/data services.")
    add_table(document, ["Module", "Responsibilities", "Key interaction"], [
        ["Client planning", "Create event; specify schedule, guests, venue status; allocate budget", "Feeds event-aware recommendation and pricing RPCs"],
        ["Marketplace and selection", "Browse categories/details, view provider options, choose one service per category", "Stores option IDs, calculated totals, and immutable snapshots"],
        ["Coordinator marketplace", "Optional coordinator choice, fee preview, package selection", "Creates explicit assignment request; providers still decide individually"],
        ["Booking and payment", "Review selections, record required downpayment, create requests, show receipt/status", "Uses 5% fee, 35% downpayment, 30% provider allocation and held-fund rules"],
        ["Provider operations", "Manage service listings/packages/availability, respond to requests, track earnings", "Atomic response RPC credits only the accepting provider’s eligible initial share"],
        ["Coordinator operations", "Manage paid profile/packages, accept/reject assignments, view event tasks", "Uses the same notification, financial, and event records"],
        ["Communication/support", "Chat, notifications, instructions, support tickets", "Scopes participants and related event/booking references"],
        ["Reviews and NLP", "Submit ratings/comments, display sentiment metadata and summaries", "Edge Functions mediate the external Python service"],
        ["Staff governance", "Account/RBAC, listing review, finance/remittance, support, audit", "Permission-checked functions and views expose only authorized operations"],
    ])
    document.add_paragraph(
        "Data security is maintained by using the current authenticated identity in database policies and RPCs. "
        "Network security is maintained by hosted TLS endpoints and by keeping privileged keys outside the client. "
        "The application layer displays authorization-aware navigation, but database enforcement remains the final "
        "control even if a client screen is bypassed."
    )

    document.add_heading("3.6.4 Security Architecture", level=2)
    add_figure(document, diagrams["security"], "Figure 3.6.4-1. Implemented defense-in-depth controls.")
    add_table(document, ["Security objective", "Implemented controls", "Effect"], [
        ["Confidentiality", "Supabase authentication; RLS; owner/participant tests; RBAC; server-side service-role and analysis secrets; audit redaction", "Limits personal, financial, message, support, and analysis data to appropriate users and services"],
        ["Integrity", "Foreign keys; check/unique constraints; transactional security-definer RPCs with restricted grants; immutable snapshots; audit triggers", "Prevents malformed relationships, unauthorized state changes, duplicate category choices, and silent historical repricing"],
        ["Availability", "Hosted Supabase services; indexed queries; explicit retry/failure states for NLP; container health endpoint; retained transaction history", "Supports recovery and diagnosis while allowing core ratings to exist even if optional text analysis fails"],
        ["Accountability", "User IDs on writes, audit logs, timestamps, assignment attempts, payment/ledger references, notifications", "Connects consequential actions to actors and preserves an inspectable history"],
        ["Least privilege", "Client uses anon/session credentials; elevated operations run only in Edge Functions or narrowly granted RPCs", "Reduces exposure of administrative or service credentials"],
    ])
    add_callout(document, "Security limitation to report honestly", "The repository demonstrates application/database controls, but a full security assessment still requires deployed-environment configuration review, dependency scanning, penetration testing, backup/restore testing, and operational incident procedures.", LIGHT_GOLD)

    document.add_heading("3.6.5 Integration Architecture", level=2)
    document.add_paragraph(
        "MULTIVENT integrates components through typed JSON/HTTPS calls and relational RPCs. The Expo client uses "
        "the Supabase JavaScript SDK for authentication, database, storage, and Edge Function operations. SQL RPCs "
        "provide authoritative calculations and multi-table transactions. Review and feedback Edge Functions convert "
        "application records into the Python API contract, attach server-held credentials, validate the response, "
        "and persist only expected analysis fields. The Python service loads versioned local LDA, encoder, and FAISS "
        "artifacts and calls the configured pre-trained model provider for schema-constrained sentiment or summaries."
    )
    add_table(document, ["Integration", "Exchange", "Interoperability / protection"], [
        ["Expo ↔ Supabase Auth", "Credentials, session, recovery/verification state", "Supabase SDK and JWT session; password values are not stored in public profile tables"],
        ["Expo ↔ PostgreSQL", "Typed records and RPC parameters/results", "PostgREST/SQL types, RLS, UUID keys, JSONB only where flexible structure is necessary"],
        ["Expo ↔ Storage", "Service cover/gallery images", "Image picker uploads and policy-controlled object access"],
        ["Expo ↔ Edge Functions", "Review/feedback analysis requests and privileged user creation", "Authenticated invocation; service role remains server-side"],
        ["Edge Functions ↔ Python API", "Comment text and structured analysis/summary JSON", "Protected endpoint with X-Analysis-Key; response shape validation"],
        ["Python API ↔ OpenAI", "Prompt context and schema-constrained result", "Server-side API credential; no direct device access"],
        ["Offline data sources ↔ ML build", "Pinned/source-registered HiliSenti, MAMS, Booking, and UCI files", "Checksums, licenses, manifests, deterministic splits, and leakage guards"],
    ])
    document.add_paragraph(
        "No confirmed live PayMongo or equivalent payment-processor call was found in the reviewed runtime. The current "
        "payment flow creates internal records and a generated demo reference, then exercises allocation, hold, "
        "acceptance, balance, remittance, and payout-request logic inside MULTIVENT."
    )

    document.add_heading("3.6.6 Deployment Architecture", level=2)
    document.add_paragraph(
        "The application can be built for Android, iOS, or the web through Expo/EAS profiles. The managed backend is "
        "a Supabase project to which ordered SQL migrations and Edge Functions are deployed. The NLP service has a "
        "Dockerfile configured for Python 3.13, CPU PyTorch, FastAPI/Uvicorn, packaged model/data/vector-store artifacts, "
        "and a configurable PORT defaulting to 8080. The repository documents Azure Container Apps as the intended "
        "container target. Secrets and endpoint values must be supplied as deployment configuration rather than "
        "embedded in the client bundle."
    )
    add_figure(document, diagrams["deployment"], "Figure 3.6.6-1. Runtime and release/deployment topology.")
    add_table(document, ["Node", "Minimum software / service", "Configuration responsibility"], [
        ["User device", "Supported Android/iOS device or modern browser; network connection", "Install/open built application; grant selected media permissions"],
        ["Application build", "Node/npm, Expo CLI/EAS-compatible environment", "Supply public Supabase URL/anon configuration; build profile"],
        ["Supabase", "Auth, PostgreSQL, Storage, Edge Functions", "Apply migrations in order; deploy functions; configure policies and server secrets"],
        ["Sentiment container", "Docker-compatible runtime; CPU/memory sufficient for encoder/index", "Mount packaged artifacts; set provider/API secrets and analysis key; expose health/analyze endpoints"],
        ["External provider", "Reachable OpenAI API account and model access", "Store API key only in server environment; monitor provider errors and quotas"],
    ])


def add_system_design(document: Document, diagrams: dict[str, Path]) -> None:
    document.add_page_break()
    document.add_heading("3.8 System Design", level=1)
    document.add_paragraph(
        "Both permitted design views are included because they answer different questions. The use case diagram "
        "defines what each actor can do, while the data flow diagrams show how information moves through major "
        "processes and stores."
    )
    document.add_heading("3.8.1 Use Case Diagram", level=2)
    add_figure(document, diagrams["use_case"], "Figure 3.8.1-1. Role-oriented use cases within the MULTIVENT boundary.", width=6.75)
    add_table(document, ["Actor", "Implemented use cases", "Authorization boundary"], [
        ["Client", "Account access; event and budget planning; coordinator/service selection; payment records; messaging; instructions; reviews/feedback; support", "Owned events, bookings, conversations, tickets, and allowed marketplace reads"],
        ["Service Provider", "Provider profile; service/package creation; calendar/hours; booking acceptance/rejection; payment confirmation; earnings/payout account/request; messages/reviews", "Records linked to the authenticated provider profile"],
        ["Event Coordinator", "Paid profile; availability; assignment response; package curation; accepted-event details/tasks; remittance and communications", "Pending/accepted assignments and coordinator-owned packages/profile"],
        ["Authorized Staff", "Accounts, roles/permissions, listing moderation, support, finance/remittance, audit and settings", "Permission-based staff operations; no blanket client-side privilege"],
        ["NLP/model service", "Analyze comments; infer topic; retrieve examples; produce binary sentiment and grounded summaries", "Reached by server-side functions, not directly by end-user devices"],
    ])

    document.add_heading("3.8.2 Data Flow Diagram", level=2)
    document.add_heading("Level 0: Context Diagram", level=3)
    add_figure(document, diagrams["dfd_context"], "Figure 3.8.2-1. Level 0 context diagram.")
    document.add_paragraph(
        "At Level 0, MULTIVENT is treated as one process. Clients submit planning, service, payment, and review data "
        "and receive plans, quotes, booking states, receipts, and notifications. Providers and coordinators exchange "
        "marketplace definitions, availability, requests, decisions, balances, and event information. Staff receive "
        "controlled operational queues and submit authorized governance actions."
    )
    document.add_heading("Level 1: Major Processes and Data Stores", level=3)
    add_figure(document, diagrams["dfd_level1"], "Figure 3.8.2-2. Level 1 processes and logical data stores.", width=6.75)
    add_table(document, ["Process", "Input", "Output / store"], [
        ["1.0 Identity and Access", "Registration, login, verification, role choice", "Authenticated profile and role/permission relationships (D1)"],
        ["2.0 Event Planning", "Event details, guest count, date/time, budget allocations", "Event, requirements, schedule and category budget records (D2)"],
        ["3.0 Marketplace and Selection", "Category, budget, option/package, catering menu, venue hours", "Calculated quote and snapshotted event selection (D2/D3)"],
        ["4.0 Booking and Payment", "Reviewed selections and payment choice", "Booking requests, payment snapshot, held/provider/platform ledger entries (D4)"],
        ["5.0 Provider/Coordinator Operations", "Listings, availability, accept/reject, packages, payout data", "Marketplace changes, decisions, balances, tasks and payouts (D3/D4)"],
        ["6.0 Messaging and Support", "Participant messages, instructions, support concerns", "Scoped conversations, notifications and tickets (D5)"],
        ["7.0 Reviews and NLP", "Rating and optional comment", "Review, sentiment/topic metadata, references and cached summary (D5)"],
        ["8.0 Staff Governance", "Permission-checked moderation and operational actions", "Account/listing/support/finance state changes and redacted audit records (D1–D5)"],
    ])


def add_ui_design(document: Document, diagrams: dict[str, Path]) -> None:
    document.add_page_break()
    document.add_heading("3.9 User Interface Design", level=1)
    document.add_paragraph(
        "MULTIVENT uses a shared visual system across client, provider, coordinator, and staff experiences. The "
        "interface is implemented with React Native components that also render on the web. Screens use cards, "
        "step indicators, bottom or role-specific navigation, clear primary actions, inline validation, empty/loading/"
        "error states, and responsive spacing. Wine and gold brand colors identify primary actions and headings while "
        "neutral surfaces preserve readability."
    )
    add_table(document, ["Design principle", "Implemented application of the principle"], [
        ["Role relevance", "After authentication, navigation exposes the client, provider, coordinator, or authorized staff workflow appropriate to the active role."],
        ["Progressive disclosure", "Event planning, service listing, payment, and package configuration use steps or focused screens rather than one unbounded form."],
        ["Input prevention", "Pickers, switches, modals, date/time controls, category options, numeric keyboards, limits, and disabled actions reduce invalid submission."],
        ["Immediate feedback", "Helper text, loading states, conflict screens, unavailability reasons, price breakdowns, confirmations, and toast/error messages explain the result of an action."],
        ["Financial clarity", "Service subtotal, 5% platform fee, client total, 35% downpayment, 30% provider allocation, direct 70% provider balance and payout status are labeled separately."],
        ["Responsive presentation", "The shared React Native codebase adapts to handheld and web surfaces, with compact cards and scrollable forms."],
        ["Historical clarity", "Booking, payment, option, and provider snapshots display the values accepted at transaction time rather than silently adopting current listing values."],
    ])

    document.add_heading("3.9.1 Input Screens Layout", level=2)
    add_figure(document, diagrams["ui_wireframe"], "Figure 3.9.1-1. Representative layout pattern derived from implemented input screens.", width=6.75)
    document.add_paragraph(
        "The wireframes summarize the actual input hierarchy rather than replacing the detailed application screens. "
        "Each form starts with a descriptive header, groups related inputs, presents validation close to the field, "
        "shows a calculated summary when money or schedule is affected, and ends with one clear primary action."
    )
    add_table(document, ["Input screen", "Principal implemented fields/controls", "Validation and usability behavior"], [
        ["Client registration/login", "Full name, email, phone, password/confirmation; email/password login; recovery code/new password", "Email/password checks, secure entry toggles, verification and recovery states"],
        ["Provider registration", "Business/contact names, category/service interests, email, phone, password", "Role-specific approval state and field-level validation"],
        ["Event creation", "Event name/type, date, time, expected guests, venue status/location", "Step presentation, date/time validation, guest-dependent downstream pricing"],
        ["Budget allocation", "Total budget and amounts for venue, catering, coordinator, photo/video, attire, host, sound/lights, floral", "Running allocated/remaining total; selected-service category values become locked to the calculated amount"],
        ["Coordinator choice/details", "Browse/skip, coordinator profile, fee, packages; package-specific catering and venue options/hours", "Availability and event-type checks; conflict confirmation before replacement"],
        ["Service details/selection", "Provider package, catering menu, venue option, venue booking hours, instructions", "Central quote RPC validates capacity, guest range, hours, operating window, availability, one-per-category, and budget"],
        ["Provider service listing", "Category, service name/description/images, price/packages, category-specific details, availability", "Multi-selection modals reduce tag clutter; pending-review workflow preserves staff moderation"],
        ["Provider booking response", "Event facts, service/request details, accept or decline, optional response note", "Only the owning provider may respond; eligible held allocation moves atomically on acceptance"],
        ["Coordinator profile/package", "Coordination fee, description, specializations, accepting status; package name/type/description/services/status", "References only active real services; duplicate/unavailable package content is rejected or deactivated"],
        ["Payment", "Initial or full option and payment summary", "Separate service subtotal, platform fee, client total, provider allocation, held/unallocated value and receipt reference"],
        ["Reviews and feedback", "Rating, optional comment, service/event/coordinator feedback", "Comment analysis is optional/asynchronous; rating persists independently"],
        ["Support and account", "Ticket subject/description/reply/context; profile/contact; password; payout account", "Length limits, scoped related records, sensitive-number masking, current/new password checks"],
    ], font_size=7.8)
    add_callout(document, "Detailed-screen appendix guidance", "For the final bound manuscript, place exported screenshots of the running application after Appendix F using the same screen order shown above. Screenshots should use non-sensitive demonstration data. This DOCX includes the implemented field inventory and layout diagram without fabricating runtime screenshots.", LIGHT_GOLD)


def add_testing(document: Document) -> None:
    document.add_page_break()
    document.add_heading("3.10 System Testing and Evaluation", level=1)
    document.add_paragraph(
        "Testing and evaluation are reported in two layers. First, repository evidence verifies implemented rules, "
        "types, migrations, and the reproducible NLP evaluation. Second, standardized instruments are supplied for "
        "respondent acceptance, deployed-web Lighthouse measurement, and ISO/IEC 25010 quality assessment. No score "
        "is inserted without an actual run or completed response set."
    )
    add_table(document, ["Evaluation layer", "Current evidence", "Required final evidence"], [
        ["Application correctness", "TypeScript compiler/lint scripts; database constraints/triggers/RPCs; explicit UI error states", "Executed regression cases in the final configured Supabase environment and recorded pass/fail evidence"],
        ["NLP pipeline", "Generated manifests, leakage checks, tests, LDA/FAISS artifacts and held-out evaluation report", "Full held-out and production-representative MULTIVENT comment validation"],
        ["UAT", "Instrument and task scenarios included below", "Signed/completed respondent forms and summarized results"],
        ["Web performance", "Expo web build path and responsive implementation", "Lighthouse runs against a deployed production build under documented conditions"],
        ["System quality", "Evidence mapping and ISO/IEC 25010 instrument", "Qualified evaluator/user responses and computed characteristic means"],
    ])

    document.add_heading("3.10.1 User Acceptance Evaluation", level=2)
    document.add_paragraph(
        "User Acceptance Testing (UAT) should use role-based task completion followed by a five-point questionnaire. "
        "Suggested participants are actual or representative clients, service providers, event coordinators, and "
        "authorized staff. Each participant should test only the workflows relevant to the assigned role."
    )
    add_table(document, ["Role", "Acceptance tasks", "Observable success criterion"], [
        ["Client", "Register/sign in; create event; allocate budget; optionally choose coordinator; select catering/venue options; review quote; record payment; inspect booking; submit review", "Task completes with the correct event, one active service per category, matching option/hours snapshot, total and status"],
        ["Provider", "Create/edit a listing; set availability; inspect request; accept/decline; view credited/held amounts; submit payout request", "Only owned records change; acceptance credits only the eligible share; rejection does not credit provider"],
        ["Coordinator", "Configure profile/fee; create package; answer assignment; inspect accepted event/tasks", "Package references valid provider services; assignment remains explicit; fee and status match the client record"],
        ["Authorized staff", "Review listing/account; use permission-based operations; handle support/finance item; inspect audit", "Allowed task succeeds and disallowed task remains unavailable/denied; audit avoids sensitive free text"],
    ])
    document.add_paragraph("Response scale: 5 – Strongly Agree, 4 – Agree, 3 – Neutral, 2 – Disagree, 1 – Strongly Disagree.")
    add_table(document, ["No.", "UAT statement", "Quality focus"], [
        ["1", "I could complete my assigned role’s main task without assistance.", "Effectiveness"],
        ["2", "The labels, instructions, and navigation made the next action clear.", "Learnability"],
        ["3", "Required fields and validation messages helped me correct invalid input.", "Error prevention"],
        ["4", "Event, service, provider/coordinator, date, time, guest, and option details were accurate.", "Functional correctness"],
        ["5", "The displayed service subtotal, platform fee, payment requirement, held amount, and balance were understandable.", "Financial clarity"],
        ["6", "Catering price changed correctly according to the chosen menu and guest count.", "Domain correctness"],
        ["7", "Venue price and schedule reflected the chosen venue option and booking hours.", "Domain correctness"],
        ["8", "The system prevented or clearly explained schedule, capacity, budget, availability, and category conflicts.", "Safety / feedback"],
        ["9", "Booking and assignment states clearly showed who still needed to respond.", "Workflow visibility"],
        ["10", "Notifications/messages gave enough information without exposing unrelated records.", "Communication / privacy"],
        ["11", "The interface remained readable and usable on the device or browser I tested.", "Accessibility / responsiveness"],
        ["12", "I trust that my role can access only the functions and records it should use.", "Perceived security"],
        ["13", "The system responded within an acceptable time for the tested tasks.", "Performance perception"],
        ["14", "Errors or unavailable states explained what I could do next.", "Recoverability"],
        ["15", "Overall, MULTIVENT is acceptable for managing the tested event-service workflow.", "Overall acceptance"],
    ], widths=[0.45, 5.45, 1.25], font_size=7.8)
    document.add_paragraph(
        "For analysis, compute each item’s frequency and weighted mean, then group means by role and quality focus. "
        "Report the sample size, role distribution, device/browser, test date, and any task failures. The researchers "
        "must define and obtain adviser approval for the final verbal interpretation and acceptance threshold before "
        "collecting responses. Open comments should be coded separately and must not be converted into invented scores."
    )

    document.add_heading("3.10.2 Performance Evaluation", level=2)
    document.add_paragraph(
        "Google Lighthouse should be executed against the deployed production web build, not the Metro development "
        "server. Record at least three runs under the same desktop and mobile profiles, clear the cache or use an "
        "incognito profile as required by the protocol, and report the median. Because no reproducible Lighthouse "
        "report was present in the reviewed repository, the matrix below is intentionally unscored."
    )
    add_table(document, ["Lighthouse area / metric", "Target or interpretation", "Desktop median", "Mobile median", "Evidence/status"], [
        ["Performance score", "Report 0–100; project target to be adviser-approved", "To be measured", "To be measured", "Attach HTML/JSON report"],
        ["Accessibility score", "Report 0–100 and failed audits", "To be measured", "To be measured", "Attach report and remediation notes"],
        ["Best Practices score", "Report 0–100 and failed audits", "To be measured", "To be measured", "Attach report"],
        ["SEO score", "Report 0–100 for public/deployed web surface", "To be measured", "To be measured", "Attach report"],
        ["First Contentful Paint", "Lower is better; compare with Lighthouse classification", "To be measured", "To be measured", "Milliseconds/seconds"],
        ["Largest Contentful Paint", "Lower is better; identify the dominant element", "To be measured", "To be measured", "Milliseconds/seconds"],
        ["Total Blocking Time", "Lower is better; investigate long JavaScript tasks", "To be measured", "To be measured", "Milliseconds"],
        ["Cumulative Layout Shift", "Lower is better; identify unstable elements", "To be measured", "To be measured", "Unitless"],
        ["Speed Index", "Lower is better; compare same deployment/network profile", "To be measured", "To be measured", "Milliseconds/seconds"],
    ], font_size=7.5)
    add_numbered(document, [
        "Export the Expo production web bundle and deploy it to the intended HTTPS host.",
        "Document URL, commit/release, browser/Lighthouse version, device profile, network/CPU throttling, and run time.",
        "Run Lighthouse three times for the login/onboarding surface and representative authenticated routes that the test setup can access.",
        "Store the HTML or JSON reports, compute the median, list failed audits, and connect remediation work to a tracked issue.",
        "Repeat after material performance changes; do not combine results from different builds or profiles as one sample.",
    ])

    document.add_heading("3.10.3 System Quality", level=2)
    document.add_paragraph(
        "The recommended evaluation model is ISO/IEC 25010 because its product-quality characteristics align with "
        "the implemented application and the adviser’s requirement for a recognized quality standard. Respondents "
        "should use the same five-point scale, while technical evaluators should attach evidence for claims that end "
        "users cannot directly observe."
    )
    add_table(document, ["ISO/IEC 25010 characteristic", "Implemented evidence to inspect", "Evaluation statement"], [
        ["Functional suitability", "Role workflows, central quote/payment RPCs, constraints, snapshots", "The system provides the functions needed for the assigned event-service task and produces correct results."],
        ["Performance efficiency", "Indexed queries, targeted RPCs, summary cache, measured Lighthouse/API behavior", "The system uses time and resources acceptably for the tested workload."],
        ["Compatibility", "Expo Android/iOS/web targets; JSON/HTTPS and SQL interfaces", "The system operates and exchanges data correctly in the tested device/browser and service environment."],
        ["Usability", "Progressive forms, helper text, conflict explanations, responsive cards", "The interface is understandable, learnable, operable, and prevents common errors."],
        ["Reliability", "Transactions, row locks, retries/failure states, retained history", "The system maintains correct state and recovers or explains failure during tested operations."],
        ["Security", "Auth, RBAC, RLS, grants/revokes, secret isolation, redacted audit", "The system protects records and actions according to identity and role."],
        ["Maintainability", "TypeScript modules, ordered migrations, centralized calculations, versioned artifacts", "The implementation is modular, analyzable, and can be changed without duplicating critical rules."],
        ["Portability", "Expo targets, environment configuration, Dockerized sentiment API", "The system can be built or deployed to the documented supported environments with configuration changes."],
    ], font_size=7.5)
    document.add_paragraph(
        "Compute a mean per characteristic and an overall descriptive mean only after completed forms are collected. "
        "Keep user-perception responses separate from objective test evidence such as Lighthouse output, database "
        "authorization tests, and ML metrics. Include evaluator role, environment, sample size, and limitations in the "
        "final chapter."
    )


def add_appendices(document: Document) -> None:
    document.add_page_break()
    document.add_heading("Appendix A. Implementation Traceability Matrix", level=1)
    add_table(document, ["Manuscript claim", "Implementation evidence", "Status"], [
        ["Cross-platform role-aware application", "package.json; app.json; src/App.tsx; src/screens", "Implemented"],
        ["Supabase relational backend and RLS", "database/initial_supabase_schema.sql; security and role migrations", "Implemented"],
        ["Optional paid coordinator with explicit response", "database/53_coordinator_marketplace.sql; coordinator screens/libraries", "Implemented"],
        ["Coordinator-curated packages reference real services", "database/54_coordinator_packages.sql; 23.3-CoordinatorPackages.tsx", "Implemented"],
        ["Guest-aware catering options and snapshots", "database/55_catering_pricing_revision.sql; service details/listing screens", "Implemented"],
        ["5% fee, 35% downpayment, 30% provider allocation", "database/56_payment_revenue_revision.sql; database/65_downpayment_split_correction.sql; 12-Payment.tsx", "Implemented in internal accounting workflow"],
        ["Funds held until individual provider/coordinator acceptance", "database/57_payment_hold_provider_acceptance.sql; booking request and earnings screens", "Implemented"],
        ["Category budget allocations", "database/58_budget_allocation_revision.sql; 05-BudgetAllocation.tsx", "Implemented"],
        ["Budget/guest/availability-aware recommendations", "database/59_budget_aware_recommendations.sql; browse flow", "Implemented"],
        ["One service per category; venue option/hours; locked category amount", "database/60_service_selection_revision.sql; 08-ServiceDetails.tsx", "Implemented"],
        ["Messaging, notifications, instructions and support", "conversation/message/notification/support schema; screens 03, 10, 22.5, 25", "Implemented"],
        ["Sentiment/topic/RAG integration", "Supabase analyze/summarize functions; sentiment API workspace and artifacts", "Implemented; optional comment analysis"],
        ["Live external payment gateway", "src/lib/planning.ts uses generated demo reference", "Not confirmed / must not be claimed"],
        ["Production Azure sentiment deployment", "deployment/sentiment/Dockerfile.azure and deployment documentation", "Configured target; live deployment not proven by repository"],
        ["Completed UAT/Lighthouse/ISO results", "No completed response set or Lighthouse report found", "Instrument supplied; results pending actual evaluation"],
    ], font_size=7.5)

    document.add_heading("Appendix B. Programmer Responsibility and Deliverables", level=1)
    add_table(document, ["Responsibility", "Concrete deliverable reflected in the manuscript"], [
        ["Requirements translation", "Converted coordinator, pricing, payment, budget, recommendation, venue, security, and ML rules into application/database behavior"],
        ["Architecture", "Defined and implemented the Expo–Supabase–PostgreSQL–Edge–FastAPI component boundaries"],
        ["Database engineering", "Maintained normalized relationships, RLS, transactional RPCs, triggers, indexes, snapshots, audit and ordered migrations"],
        ["Application engineering", "Implemented role-aware screens and data libraries for clients, providers, coordinators and staff"],
        ["Financial correctness", "Centralized versioned fee/payment/allocation logic and separated held, earned, released and revenue amounts"],
        ["ML/NLP integration", "Connected reviews/feedback to protected server-side analysis and preserved provenance and failure state"],
        ["Verification", "Provided type/lint/build commands, role-based UAT cases, Lighthouse procedure and ISO quality instrument"],
        ["Documentation", "Produced architecture, ERD, use case, DFD, deployment, UI and traceability descriptions based on source evidence"],
    ])

    document.add_heading("Appendix C. Sentiment Training and Evaluation Evidence", level=1)
    document.add_paragraph(
        "The NLP feature analyzes optional written comments. It does not train or fine-tune a supervised sentiment "
        "classifier. The local corpus fits an unsupervised LDA topic model and builds a training-only FAISS retrieval "
        "index. The active configuration records the pre-trained OpenAI model name gpt-5.6-terra, which produces the final schema-constrained positive/negative verdict "
        "using the original comment, LDA context, and retrieved labeled examples. Star ratings remain separate."
    )
    add_table(document, ["Artifact / population", "Recorded value", "Meaning"], [
        ["Original source records examined", "31,704", "Registered records across HiliSenti, MAMS, Booking Hotel Reviews and UCI restaurant subset"],
        ["Neutral records excluded", "7,154", "Excluded from the binary experiment; never relabeled"],
        ["Valid deduplicated binary units", "23,171", "All-binary processed corpus"],
        ["Realized corpus split", "18,411 train; 2,376 validation; 2,384 test", "79.46% / 10.25% / 10.29%; publisher HiliSenti partitions are preserved"],
        ["Domain-filtered units", "5,649", "Event/service-relevant examples"],
        ["LDA fitting rows", "4,462", "Training-only text; sentiment label not used to fit topics"],
        ["FAISS/RAG rows", "3,050", "Balanced: 1,525 positive and 1,525 negative"],
        ["Encoder", "paraphrase-multilingual-MiniLM-L12-v2", "Frozen pretrained multilingual, 384-dimensional embeddings"],
        ["LDA", "10 topics; max 10,000 features; min_df 2; max_df 0.95; 20 iterations; seed 42", "Current saved topic configuration; labels remain Topic 0–9 pending human naming"],
    ], font_size=7.8)
    add_table(document, ["Held-out sample", "N", "Accuracy", "Macro F1", "Confusion matrix [negative, positive]"], [
        ["HiliSenti", "100", "0.9500", "0.9494", "[[53, 4], [1, 42]]"],
        ["Hospitality/restaurant domain proxy", "100", "0.9400", "0.9400", "[[48, 2], [4, 46]]"],
    ])
    document.add_paragraph(
        "The recorded report states that leakage checks passed. These results are promising but preliminary: each set "
        "contains only 100 evaluated records, the domain set is a proxy rather than native MULTIVENT feedback, and "
        "some hotel labels are weakly supervised. The feature must not control ranking, penalties, or other high-impact "
        "decisions until a manually labeled production-representative MULTIVENT set is evaluated."
    )

    document.add_heading("Appendix D. Core Database Entity Data Dictionary", level=1)
    add_table(document, ["Entity", "Selected key attributes", "Data retained for correctness"], [
        ["profiles", "id, full_name, email, phone, default_role, account_status", "Application identity linked to auth.users"],
        ["provider_profiles", "id, user_id, business_name, contact/location, verification", "Provider business identity and moderation state"],
        ["services", "id, provider_id, category_id, name, base_price, pricing model/unit, category_details, status", "Provider-controlled listing and configurable options"],
        ["events", "id, client_id, coordinator IDs/status, name/type/date/time, guest_count, total_budget", "Client plan and coordinator pricing snapshot"],
        ["event_budget_items", "event_id, category_key, allocated_amount, lock/selection ID, version", "Category ceiling and committed selected cost"],
        ["event_service_selections", "event/service/package/provider/category, amount, catering/venue IDs and snapshots, status", "Event-specific option and calculated-price commitment"],
        ["bookings", "event/client/provider/service, date/time, amount/provider/platform snapshots, status", "Provider request and immutable transaction terms"],
        ["payments", "booking/event/coordinator, scope, subtotal/fee/initial/held allocations, status/reference", "Payment attempt and versioned financial breakdown"],
        ["financial_transactions", "booking/payment/event/provider/coordinator, platform revenue, provider net/held/released, status", "Internal ledger that separates custody, earnings and payout"],
        ["coordinator_packages/items", "coordinator, name/type/status; package/service/position", "Curated references to real services"],
        ["reviews/event_feedback", "booking/event/service/coordinator, rating/comment, sentiment/topic/metadata", "User feedback and optional analysis provenance"],
        ["audit_logs", "actor, action, resource, redacted before/after, timestamp", "Accountability without copying designated sensitive content"],
    ], font_size=7.4)

    document.add_heading("Appendix E. Verification Checklist for Final Submission", level=1)
    add_numbered(document, [
        "Apply database migrations in documented order through 60_service_selection_revision.sql to a clean staging project and retain the execution log.",
        "Run npm run typecheck, npm run lint, and npm run build:web; record command, date, environment and result.",
        "Run the sentiment service test suite and compare artifact hashes/evaluation report with the deployed container image.",
        "Execute role-isolation tests for client, provider, coordinator and each staff permission set; attempt both allowed and denied operations.",
        "Complete the UAT scenarios and questionnaire with representative respondents; compute descriptive results without fabricating missing answers.",
        "Deploy the production web build and capture three Lighthouse runs per documented profile; attach HTML/JSON reports.",
        "Complete the ISO/IEC 25010 evaluation, keeping user perception, technical tests and NLP metrics as separate evidence sources.",
        "Replace demonstration names/contact/payment references in screenshots and reports with non-sensitive test data.",
        "Update this manuscript’s status statements if a live payment gateway or production sentiment deployment is later verified.",
    ])

    document.add_heading("Appendix F. Repository Evidence Reviewed", level=1)
    add_table(document, ["Evidence path", "Purpose in this manuscript"], [
        ["HARVEY&CAANG.pdf", "Required manuscript sections and evaluation items"],
        ["package.json, app.json, eas.json", "Application stack, targets and build profiles"],
        ["src/App.tsx; src/screens; src/lib", "Implemented role navigation, screens, inputs and application data flows"],
        ["database/initial_supabase_schema.sql", "Foundational relational entities and relationships"],
        ["database/30–60 migrations", "RBAC, support, finance, security hardening, coordinator, package, catering, payment, budget, recommendation and selection revisions"],
        ["supabase/functions/*", "Privileged account and sentiment integration boundaries"],
        ["deployment/sentiment/Dockerfile.azure", "Container software and intended Azure deployment target"],
        ["docs/ML_METHODOLOGY_IMPLEMENTATION.md", "Current, reconciled ML methodology and recorded metrics"],
        ["D:\\Sentiment Training\\multivent-sentiment", "Source registration, processed corpus, LDA/encoder/FAISS artifacts, API code, tests, manifests and reports"],
    ], font_size=7.7)

    document.add_heading("Appendix G. Detailed Input-Screen Layout Specification", level=1)
    add_table(document, ["Screen", "Header/top region", "Body order", "Bottom/terminal action", "Responsive and feedback behavior"], [
        ["Login / registration", "Brand/title and role context", "Identity/contact fields → password fields → terms/verification context", "Sign in / create account / recovery link", "Keyboard-aware scrolling, secure-entry toggle, inline helper/error text"],
        ["Create Event", "Back navigation, step label, Create Event title", "Name/type → date/time → guest count → venue status/location", "Continue to budget", "Scrollable step form; invalid schedule/input blocks progression"],
        ["Budget", "Budget step and event context", "Total budget → category allocation cards → allocated/remaining summary", "Save/continue", "Currency formatting, running totals, locked selected-cost explanation"],
        ["Coordinator Choice", "Optional coordinator prompt", "Browse coordinators/packages or explanatory skip path", "Select coordinator/package or continue without", "Choice is not forced; unavailable reasons remain visible"],
        ["Category Browse", "Category or replacement context and search", "Recommendation/filter controls → service cards → budget/availability indicators", "Open service details", "Loading/empty/error states; replacement context is explicit"],
        ["Service Details", "Service/provider identity and media", "Description → provider options/packages → catering/venue configuration → quote → instructions", "Select or replace service", "Guest/capacity/hour/schedule/budget errors appear before commit"],
        ["Review Services", "Event and review-step context", "One card per selected category → option snapshots → coordinator → totals", "Proceed to booking/payment", "Selection changes return to the relevant category without losing event context"],
        ["Payment", "Event summary", "Payment mode → subtotal → 5% fee → client total → held/provider allocation explanation", "Record payment", "Disabled while processing; confirmation shows generated reference and status"],
        ["Provider Listing Wizard", "Step indicator and category context", "Basic details/images → pricing/packages/options → category-specific fields → review", "Save draft / submit for review", "Compact multi-select dialogs, field validation, review before submission"],
        ["Booking Request", "Request status and event/service title", "Client event facts → selected options/instructions → financial share/status", "Accept or decline with optional note", "Atomic response, progress state, ownership error handling"],
        ["Coordinator Package", "Package-management context", "Name/type/status → description → marketplace-service selector → selected list", "Save package / activate/deactivate", "Unavailable services cannot be activated; references stay linked to provider listings"],
        ["Support Ticket", "Ticket list/detail context", "Subject → description → optional event/booking reference → threaded replies", "Create ticket / send reply", "Length limits, closed-state notice, role-scoped related records"],
    ], font_size=7.1)

    document.add_paragraph()
    closing = document.add_paragraph()
    closing.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = closing.add_run("End of implementation-grounded programmer manuscript")
    run.bold = True
    run.font.color.rgb = hex_rgb(WINE)


def build_document(diagrams: dict[str, Path]) -> Document:
    document = Document()
    configure_document(document)
    add_front_matter(document)
    add_architecture_sections(document, diagrams)
    add_system_design(document, diagrams)
    add_ui_design(document, diagrams)
    add_testing(document)
    add_appendices(document)
    return document


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temp_dir = Path(tempfile.mkdtemp(prefix="multivent_manuscript_"))
    try:
        diagrams = make_diagrams(temp_dir)
        document = build_document(diagrams)
        document.save(OUTPUT)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
