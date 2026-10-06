from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    ListFlowable,
    ListItem,
    PageTemplate,
    Paragraph,
    Spacer,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "MULTIVENT_FEATURES.md"
OUTPUT = ROOT / "docs" / "MULTIVENT_FEATURES.pdf"

BURGUNDY = colors.HexColor("#7A1831")
DARK_BURGUNDY = colors.HexColor("#541020")
INK = colors.HexColor("#2A2325")
MUTED = colors.HexColor("#6D6467")
LIGHT = colors.HexColor("#F7EFF1")
LINE = colors.HexColor("#D9C9CE")


def inline_markup(value: str) -> str:
    value = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    value = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"`([^`]+)`", r"<font name='Courier'>\1</font>", value)
    return value


styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    "DocumentTitle",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=25,
    leading=30,
    textColor=DARK_BURGUNDY,
    alignment=TA_CENTER,
    spaceAfter=8 * mm,
)
subtitle_style = ParagraphStyle(
    "Subtitle",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=10.5,
    leading=16,
    textColor=MUTED,
    alignment=TA_CENTER,
    spaceAfter=7 * mm,
)
h2_style = ParagraphStyle(
    "Section",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=16,
    leading=20,
    textColor=BURGUNDY,
    spaceBefore=5 * mm,
    spaceAfter=2.5 * mm,
    keepWithNext=True,
)
h3_style = ParagraphStyle(
    "Subsection",
    parent=styles["Heading3"],
    fontName="Helvetica-Bold",
    fontSize=12,
    leading=15,
    textColor=INK,
    spaceBefore=3 * mm,
    spaceAfter=2 * mm,
    keepWithNext=True,
)
body_style = ParagraphStyle(
    "Body",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9.2,
    leading=13,
    textColor=INK,
    alignment=TA_LEFT,
    spaceAfter=2.5 * mm,
)
bullet_style = ParagraphStyle(
    "BulletCopy",
    parent=body_style,
    fontSize=8.8,
    leading=12,
    spaceAfter=0,
)
note_style = ParagraphStyle(
    "Note",
    parent=body_style,
    backColor=LIGHT,
    borderColor=BURGUNDY,
    borderWidth=0.8,
    borderPadding=8,
    textColor=DARK_BURGUNDY,
    leftIndent=4 * mm,
    rightIndent=4 * mm,
    spaceBefore=3 * mm,
    spaceAfter=4 * mm,
)


def page_decoration(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(BURGUNDY)
    canvas.rect(0, height - 9 * mm, width, 9 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(LINE)
    canvas.line(20 * mm, 15 * mm, width - 20 * mm, 15 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 10 * mm, "MULTIVENT Feature Inventory")
    canvas.drawRightString(width - 20 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=20 * mm,
    rightMargin=20 * mm,
    topMargin=18 * mm,
    bottomMargin=21 * mm,
    title="MULTIVENT Feature Inventory",
    author="MULTIVENT",
    subject="Implemented application features and current limitations",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
doc.addPageTemplates([PageTemplate(id="features", frames=[frame], onPage=page_decoration)])

lines = SOURCE.read_text(encoding="utf-8").splitlines()
story = []
paragraph_buffer: list[str] = []
bullet_buffer: list[tuple[int, str]] = []


def flush_paragraph() -> None:
    if not paragraph_buffer:
        return
    text = " ".join(part.strip() for part in paragraph_buffer)
    story.append(Paragraph(inline_markup(text), body_style))
    paragraph_buffer.clear()


def flush_bullets() -> None:
    if not bullet_buffer:
        return
    items = [
        ListItem(
            Paragraph(inline_markup(text), bullet_style),
            leftIndent=level * 7 * mm,
            bulletColor=MUTED if level else BURGUNDY,
        )
        for level, text in bullet_buffer
    ]
    story.append(
        ListFlowable(
            items,
            bulletType="bullet",
            start="circle",
            leftIndent=6 * mm,
            bulletFontSize=6,
            spaceAfter=2 * mm,
        )
    )
    bullet_buffer.clear()


for raw in lines:
    if not raw.strip():
        flush_paragraph()
        flush_bullets()
        continue
    if raw.startswith("# "):
        flush_paragraph()
        flush_bullets()
        story.append(Spacer(1, 18 * mm))
        story.append(Paragraph(inline_markup(raw[2:]), title_style))
        story.append(Paragraph("Implemented mobile, web, data, operations, and AI capabilities", subtitle_style))
        continue
    if raw.startswith("## "):
        flush_paragraph()
        flush_bullets()
        story.append(Paragraph(inline_markup(raw[3:]), h2_style))
        continue
    if raw.startswith("### "):
        flush_paragraph()
        flush_bullets()
        story.append(Paragraph(inline_markup(raw[4:]), h3_style))
        continue
    if raw.startswith("> "):
        flush_paragraph()
        flush_bullets()
        story.append(Paragraph(inline_markup(raw[2:]), note_style))
        continue
    match = re.match(r"^(\s*)-\s+(.+)$", raw)
    if match:
        flush_paragraph()
        bullet_buffer.append((1 if len(match.group(1)) >= 2 else 0, match.group(2)))
        continue
    flush_bullets()
    paragraph_buffer.append(raw)

flush_paragraph()
flush_bullets()
doc.build(story)
print(OUTPUT)
