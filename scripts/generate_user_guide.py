from __future__ import annotations

from datetime import date
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
SCREEN_DIR = ROOT / "assets" / "user-guide"
OUTPUT_PATH = ROOT / "Freshli_User_Guide.pdf"
ICON_PATH = ROOT / "public" / "icons" / "icon-512x512.png"

APP_VERSION = "1.0.0"
TEAM_MEMBERS = "Kyle Kim, Laura Tan, Jazmyn Zhang, Gia Xie"
INSTRUCTOR = "Not listed in repository materials"
SPONSOR = "Not applicable"
SUBMISSION_DATE = date(2026, 3, 13).strftime("%B %d, %Y")
LIVE_URL = "https://foodies-dusky-pi.vercel.app"

CREAM = colors.HexColor("#f7f6ef")
WHITE = colors.white
DEEP_GREEN = colors.HexColor("#073d35")
MINT = colors.HexColor("#d3e2d0")
LIGHT_MINT = colors.HexColor("#e3e9e3")
SOFT_LINE = colors.HexColor("#d9d7cb")
MUTED = colors.HexColor("#666666")


def screen(name: str) -> Path:
    path = SCREEN_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Missing user-guide image: {path}")
    return path


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="Body",
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            textColor=colors.black,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Small",
            fontName="Helvetica",
            fontSize=8.1,
            leading=11,
            textColor=MUTED,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionTitle",
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=DEEP_GREEN,
            spaceBefore=2,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubTitle",
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            textColor=colors.black,
            spaceBefore=4,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName="Times-Bold",
            fontSize=28,
            leading=32,
            alignment=TA_CENTER,
            textColor=DEEP_GREEN,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverMeta",
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.black,
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ScreenTitle",
            fontName="Helvetica-Bold",
            fontSize=8.8,
            leading=11,
            alignment=TA_CENTER,
            textColor=colors.black,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ScreenCaption",
            fontName="Helvetica",
            fontSize=7.4,
            leading=9.6,
            alignment=TA_CENTER,
            textColor=MUTED,
            spaceAfter=0,
        )
    )
    return styles


STYLES = build_styles()


def fit_image(path: Path, max_width: float, max_height: float) -> Image:
    with PILImage.open(path) as im:
        width_px, height_px = im.size

    scale = min(max_width / width_px, max_height / height_px)
    draw_width = width_px * scale
    draw_height = height_px * scale
    image = Image(str(path), width=draw_width, height=draw_height)
    image.hAlign = "CENTER"
    return image


def screen_panel(
    filename: str,
    title: str,
    caption: str,
    max_width: float = 2.55 * inch,
    max_height: float = 5.35 * inch,
):
    panel = Table(
        [
            [fit_image(screen(filename), max_width, max_height)],
            [Spacer(1, 5)],
            [Paragraph(title, STYLES["ScreenTitle"])],
            [Paragraph(caption, STYLES["ScreenCaption"])],
        ],
        colWidths=[max_width + 0.1 * inch],
    )
    panel.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return panel


def screen_grid(rows, col_widths):
    table = Table(rows, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return table


def requirements_table():
    header_style = ParagraphStyle(
        "ReqHeader",
        parent=STYLES["Body"],
        fontName="Helvetica-Bold",
        fontSize=8.4,
        leading=10.5,
        spaceAfter=0,
    )
    cell_style = ParagraphStyle(
        "ReqCell",
        parent=STYLES["Body"],
        fontName="Helvetica",
        fontSize=8.4,
        leading=11,
        spaceAfter=0,
        wordWrap="CJK",
    )
    raw_rows = [
        ["Category", "Requirement"],
        ["Supported platforms", "Recommended on current Safari for iPhone/iPad and Chrome for Android. Desktop Chrome, Safari, or Edge can be used for review, but the UI is optimized for portrait mobile use."],
        ["Hardware", "A camera-enabled phone or tablet is recommended for receipt scanning. Any device that can run a modern browser and upload clear photos is sufficient."],
        ["Internet", "Freshli requires an internet connection for Google sign-in, Firebase sync, push notification setup, receipt parsing, and recipe recommendations."],
        ["Dependencies", "End users do not install local packages. The app runs in the browser or as an installed PWA after visiting the public URL."],
        ["User accounts", "A Google account is required. Camera, photo library, and notification permissions are optional but needed for the full experience."],
        ["Package contents", "Not applicable. Freshli is a software-only product with no physical package components."],
    ]
    data = []
    for row_index, row in enumerate(raw_rows):
        style = header_style if row_index == 0 else cell_style
        data.append([Paragraph(row[0], style), Paragraph(row[1], style)])
    table = Table(data, colWidths=[1.75 * inch, 5.45 * inch], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), MINT),
                ("BOX", (0, 0), (-1, -1), 0.6, SOFT_LINE),
                ("GRID", (0, 0), (-1, -1), 0.6, SOFT_LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
            ]
        )
    )
    return table


def build_story():
    s = STYLES
    story = []

    # Cover
    story.append(Spacer(1, 0.3 * inch))
    icon = Image(str(ICON_PATH), width=0.95 * inch, height=0.95 * inch)
    icon.hAlign = "CENTER"
    story.append(icon)
    story.append(Spacer(1, 0.16 * inch))
    story.append(Paragraph("Freshli User Guide", s["CoverTitle"]))
    cover_lines = [
        f"<b>Team Members:</b> {TEAM_MEMBERS}",
        f"<b>Public App URL:</b> <font color='#073d35'>{LIVE_URL}</font>",
    ]
    story.append(Spacer(1, 0.45 * inch))
    for line in cover_lines:
        story.append(Paragraph(line, s["CoverMeta"]))
    story.append(PageBreak())

    # Overview
    story.append(Paragraph("1. Product Overview", s["SectionTitle"]))
    story.append(
        Paragraph(
            "Freshli is a mobile-first grocery tracking web app that helps households see what food is at home before it goes to waste. "
            "The app lets users sign in with Google, complete onboarding preferences, add items from receipt scans or manual input, "
            "track food by storage location, and browse recipes that use what is already available.",
            s["Body"],
        )
    )
    story.append(
        Paragraph(
            "The UI images supplied for this guide show five major product areas: onboarding, add item, inventory management, recipe discovery, and profile/settings. "
            "Those flows are organized below in the same task order a first-time user would follow.",
            s["Body"],
        )
    )
    story.append(
        screen_grid(
            [[
                screen_panel("iPhone 13 & 14 - 209.png", "Home Dashboard", "The home screen summarizes locations and urgent items at a glance.", 2.2 * inch, 4.8 * inch),
                screen_panel("iPhone 13 & 14 - 224.png", "Recipe Tab", "Curated recipes, Magic Kitchen, and Collection are grouped together.", 2.2 * inch, 4.8 * inch),
                screen_panel("Mobile Settings Experience.png", "Profile / Settings", "Impact metrics, food rules, notifications, and sign-out live here.", 2.2 * inch, 4.8 * inch),
            ]],
            [2.35 * inch, 2.35 * inch, 2.35 * inch],
        )
    )
    story.append(Spacer(1, 0.08 * inch))
    story.append(Paragraph("2. System Requirements", s["SectionTitle"]))
    story.append(requirements_table())
    story.append(PageBreak())

    # Installation and onboarding
    story.append(Paragraph("3. Installation and First-Time Setup", s["SectionTitle"]))
    install_steps = [
        "1. Open the production URL on a supported mobile browser. Install the PWA to the home screen if you want the app to behave like a native app.",
        "2. Launch Freshli and sign in with Google.",
        "3. Complete the onboarding questions so recipe and reminder behavior can be personalized.",
        "4. Choose whether Freshli should notify you before items expire, then begin stocking the kitchen by scanning a receipt or typing items manually.",
    ]
    for step in install_steps:
        story.append(Paragraph(step, s["Body"]))
    story.append(
        screen_grid(
            [[
                screen_panel("iPhone 13 & 14 - 193.png", "Splash", "Brand entry screen.", 1.55 * inch, 3.2 * inch),
                screen_panel("iPhone 13 & 14 - 194.png", "Login", "Google sign-in screen.", 1.55 * inch, 3.2 * inch),
                screen_panel("iPhone 13 & 14 - 207.png", "Home", "At Home dashboard after setup.", 1.55 * inch, 3.2 * inch),
            ]],
            [2.3 * inch, 2.3 * inch, 2.3 * inch],
        )
    )
    story.append(Spacer(1, 0.12 * inch))
    story.append(
        screen_grid(
            [
                [
                    screen_panel("iPhone 13 & 14 - 194.png", "Step 1 - Sign In", "Google sign-in is the first required step.", 2.45 * inch, 5.2 * inch),
                    screen_panel("iPhone 13 & 14 - 195.png", "Step 2 - Food Rules", "Users select dietary preferences, allergies, and ingredient exclusions.", 2.45 * inch, 5.2 * inch),
                ],
                [
                    screen_panel("iPhone 13 & 14 - 196.png", "Step 3 - Notifications", "Users choose when reminders should arrive.", 2.45 * inch, 5.2 * inch),
                    screen_panel("iPhone 13 & 14 - 197.png", "Step 4 - Stock Up", "Onboarding ends by guiding the user into the add-item flow.", 2.45 * inch, 5.2 * inch),
                ],
            ],
            [3.45 * inch, 3.45 * inch],
        )
    )
    story.append(PageBreak())

    # Scan flow
    story.append(Paragraph("4. Add Item Flow - Scan Receipt", s["SectionTitle"]))
    story.append(
        Paragraph(
            "The scan-based add-item flow is designed for fast inventory creation. Users photograph a receipt, wait for processing, then correct the result before saving it into inventory.",
            s["Body"],
        )
    )
    story.append(
        screen_grid(
            [
                [
                    screen_panel("iPhone 13 & 14 - 202.png", "Capture Receipt", "Take a clear photo of the full receipt.", 2.45 * inch, 5.15 * inch),
                    screen_panel("iPhone 13 & 14 - 201.png", "Processing State", "Freshli shows a processing screen while the receipt is analyzed.", 2.45 * inch, 5.15 * inch),
                ],
                [
                    screen_panel("iPhone 13 & 14 - 198.png", "Move Items", "From scan results, a user can move items between fridge, freezer, and pantry.", 2.45 * inch, 5.15 * inch),
                    screen_panel("iPhone 13 & 14 - 203.png", "Review and Save", "The reviewed list can then be saved into inventory.", 2.45 * inch, 5.15 * inch),
                ],
            ],
            [3.45 * inch, 3.45 * inch],
        )
    )
    story.append(Paragraph("Scan editing and cleanup", s["SubTitle"]))
    story.append(
        Paragraph(
            "Before saving, users can edit item details, delete bad detections, or switch to a bulk-selection mode for multi-item cleanup.",
            s["Small"],
        )
    )
    story.append(
        screen_grid(
            [
                [
                    screen_panel("iPhone 13 & 14 - 204.png", "Swipe Actions", "Swipe left on an item to expose Edit and Delete.", 2.2 * inch, 4.9 * inch),
                    screen_panel("iPhone 13 & 14 - 205.png", "Bulk Edit", "Enter bulk edit mode to select multiple items.", 2.2 * inch, 4.9 * inch),
                    screen_panel("iPhone 13 & 14 - 206.png", "Bulk Actions", "Selected items can be moved or deleted together.", 2.2 * inch, 4.9 * inch),
                ],
                [
                    screen_panel("iPhone 13 & 14 - 199.png", "Delete One", "Single-item deletion requires confirmation.", 2.2 * inch, 4.9 * inch),
                    screen_panel("iPhone 13 & 14 - 200.png", "Delete Many", "Multi-item deletion also requires confirmation.", 2.2 * inch, 4.9 * inch),
                    "",
                ],
            ],
            [2.35 * inch, 2.35 * inch, 2.35 * inch],
        )
    )
    story.append(PageBreak())

    # Manual add flow
    story.append(Paragraph("5. Add Item Flow - Manual Input", s["SectionTitle"]))
    story.append(
        Paragraph(
            "Manual input is available from the home-screen add sheet. It is useful for items bought without a receipt, leftovers, or when a scan result needs an extra item added by hand.",
            s["Body"],
        )
    )
    story.append(
        screen_grid(
            [
                [
                    screen_panel("iPhone 13 & 14 - 210.png", "Add Sheet", "The add button opens a sheet with Scan Receipt and Type It In options.", 2.45 * inch, 5.2 * inch),
                    screen_panel("Mobile Settings Experience-1.png", "Blank Form", "The user can start with an empty manual entry form.", 2.45 * inch, 5.2 * inch),
                ],
                [
                    screen_panel("Mobile Settings Experience-2.png", "Completed Form", "Once filled, the item can be saved directly to inventory.", 2.45 * inch, 5.2 * inch),
                    screen_panel("iPhone 13 & 14 - 222.png", "Empty Home State", "Even an empty kitchen state still exposes the add button for manual entry.", 2.45 * inch, 5.2 * inch),
                ],
            ],
            [3.45 * inch, 3.45 * inch],
        )
    )
    story.append(PageBreak())

    # Inventory
    story.append(Paragraph("6. Inventory and Home Navigation", s["SectionTitle"]))
    story.append(
        Paragraph(
            "Freshli organizes saved items by location and urgency. The home screen highlights what should be used first, while the location pages support search, filters, sorting, and bulk maintenance.",
            s["Body"],
        )
    )
    story.append(
        screen_grid(
            [
                [
                    screen_panel("iPhone 13 & 14 - 207.png", "Home Dashboard", "Browse By Location and Use These First are the main inventory entry points.", 2.45 * inch, 5.2 * inch),
                    screen_panel("iPhone 13 & 14 - 211.png", "Location Detail", "Each location page supports category chips and item browsing.", 2.45 * inch, 5.2 * inch),
                ],
                [
                    screen_panel("iPhone 13 & 14 - 212.png", "Sort Options", "Location detail supports sorting by expiry date or date added.", 2.45 * inch, 5.2 * inch),
                    screen_panel("iPhone 13 & 14 - 213.png", "Location Switcher", "Users can jump between fridge, freezer, and pantry counts.", 2.45 * inch, 5.2 * inch),
                ],
            ],
            [3.45 * inch, 3.45 * inch],
        )
    )
    story.append(Paragraph("Search and batch maintenance", s["SubTitle"]))
    story.append(
        screen_grid(
            [
                [
                    screen_panel("iPhone 13 & 14 - 216.png", "Search Results", "Search shows matching items grouped by storage location.", 2.2 * inch, 4.8 * inch),
                    screen_panel("iPhone 13 & 14 - 217.png", "Cross-Location Search", "The same query can return results in multiple locations.", 2.2 * inch, 4.8 * inch),
                    screen_panel("iPhone 13 & 14 - 218.png", "Blank Search", "The search screen starts empty until a query is entered.", 2.2 * inch, 4.8 * inch),
                ],
                [
                    screen_panel("iPhone 13 & 14 - 219.png", "Select Mode", "Inventory supports multi-select actions from the location page.", 2.2 * inch, 4.8 * inch),
                    screen_panel("iPhone 13 & 14 - 220.png", "Selected Items", "Once selected, items are ready for move, used, or trash actions.", 2.2 * inch, 4.8 * inch),
                    screen_panel("iPhone 13 & 14 - 221.png", "Move Selected", "Batch-selected items can be moved between storage locations.", 2.2 * inch, 4.8 * inch),
                ],
            ],
            [2.35 * inch, 2.35 * inch, 2.35 * inch],
        )
    )
    story.append(Spacer(1, 0.08 * inch))
    story.append(
        screen_grid(
            [[
                screen_panel("iPhone 13 & 14 - 223.png", "Item Detail", "Each item detail page includes recipe prompts plus Used and Trash actions.", 2.4 * inch, 5.15 * inch),
                screen_panel("iPhone 13 & 14 - 229.png", "Item Detail Variant", "A second captured state of the same detail flow was also provided.", 2.4 * inch, 5.15 * inch),
            ]],
            [3.45 * inch, 3.45 * inch],
        )
    )
    story.append(PageBreak())

    # Recipes
    story.append(Paragraph("7. Recipe Tab, Collection, and Magic Kitchen", s["SectionTitle"]))
    story.append(
        Paragraph(
            "The recipe experience has three connected areas: the curated recipe feed, the saved Collection page, and Magic Kitchen for more experimental ideas. Detailed recipe pages show timing, servings, ingredient matching, and step-by-step instructions.",
            s["Body"],
        )
    )
    story.append(
        screen_grid(
            [
                [
                    screen_panel("iPhone 13 & 14 - 224.png", "Recipe Home", "The main recipe page combines Magic Kitchen, Collection, category chips, and the curated feed.", 2.45 * inch, 5.2 * inch),
                    screen_panel("iPhone 13 & 14 - 226.png", "Recipe Sorting", "Users can sort recipes by most items used or by quickest.", 2.45 * inch, 5.2 * inch),
                ],
                [
                    screen_panel("iPhone 13 & 14 - 208.png", "Collection", "Saved recipes live in a separate collection view.", 2.45 * inch, 5.2 * inch),
                    screen_panel("iPhone 13 & 14 - 230.png", "Magic Kitchen Intro", "Magic Kitchen starts with a dedicated landing page.", 2.45 * inch, 5.2 * inch),
                ],
            ],
            [3.45 * inch, 3.45 * inch],
        )
    )
    story.append(Spacer(1, 0.08 * inch))
    story.append(
        screen_grid(
            [[
                screen_panel("iPhone 13 & 14 - 227.png", "Curated Recipe Feed", "A long-scroll version of the curated recipe list was provided for the guide.", 2.2 * inch, 6.2 * inch),
                screen_panel("iPhone 13 & 14 - 12.png", "Magic Kitchen Result", "Magic Kitchen can generate a single bold concept recipe card.", 2.2 * inch, 6.2 * inch),
                screen_panel("iPhone 13 & 14 - 13.png", "Recipe Detail", "Detailed recipe pages include description, ingredients, and steps.", 2.2 * inch, 6.2 * inch),
            ]],
            [2.35 * inch, 2.35 * inch, 2.35 * inch],
        )
    )
    story.append(Spacer(1, 0.08 * inch))
    story.append(
        screen_grid(
            [[
                screen_panel("iPhone 13 & 14 - 228.png", "Inventory-Aware Recipe Detail", "A second recipe detail state shows ingredient availability such as In fridge or Unstocked.", 2.45 * inch, 5.3 * inch),
                screen_panel("iPhone 13 & 14 - 224.png", "Curated Feed Reference", "Recipe cards show prep time, how many items are used, and whether a recipe is saved.", 2.45 * inch, 5.3 * inch),
            ]],
            [3.45 * inch, 3.45 * inch],
        )
    )
    story.append(PageBreak())

    # Settings
    story.append(Paragraph("8. Settings and Impact Tracking", s["SectionTitle"]))
    story.append(
        Paragraph(
            "The profile area combines account details, waste-reduction impact metrics, food rules, collected recipes, notification settings, and sign-out. "
            "The supplied UI set also includes a modal that explains how impact is calculated for the current month.",
            s["Body"],
        )
    )
    story.append(
        screen_grid(
            [[
                screen_panel("Mobile Settings Experience.png", "Profile Settings", "Users can open Food Rules, Collected Recipes, Notification, and Sign Out from one place.", 2.45 * inch, 5.55 * inch),
                screen_panel("Group 297.png", "Impact Explanation", "The modal explains what 'items wasted' and 'estimated value saved' mean.", 2.45 * inch, 5.55 * inch),
            ]],
            [3.45 * inch, 3.45 * inch],
        )
    )
    story.append(PageBreak())

    # Technical
    story.append(Paragraph("9. Technical Specifications", s["SectionTitle"]))
    tech_points = [
        "<b>Application type:</b> Progressive Web App built with React 19, TypeScript, Vite, and React Router.",
        "<b>Core modules:</b> Login, onboarding, add-item flows, scan-result review, location inventory, recipe feed, Magic Kitchen, collection, item detail, and settings.",
        "<b>Data storage:</b> Firebase Firestore stores receipts, items, user preferences, saved recipes, and item status fields such as active, used, or trashed.",
        "<b>Authentication:</b> Google sign-in through Firebase Authentication and Google Identity Services.",
        "<b>Notifications:</b> Firebase Cloud Messaging powers push notifications when browser and OS support them.",
        "<b>Receipt processing:</b> Receipt images are analyzed through the app's AI-assisted parsing and verification pipeline before items are shown on the scan result screen.",
        "<b>Recipe integrations:</b> Curated recipes and item-aware suggestions depend on live recommendation services and saved inventory data.",
    ]
    for point in tech_points:
        story.append(Paragraph(point, s["Body"]))

    story.append(Paragraph("10. Data Privacy, Security, and Known Operational Limits", s["SectionTitle"]))
    privacy_points = [
        "<b>Personal data:</b> Freshli stores signed-in identity, saved food items, recipe preferences, and notification settings in cloud services tied to the user's Google account.",
        "<b>Receipt handling:</b> Users should only upload receipts they are comfortable sending through cloud-backed recognition and recommendation services.",
        "<b>Security warning:</b> Sign out on shared devices. Push notifications may reveal that food is expiring, so users should enable them only on devices they control.",
        "<b>Operational warning:</b> Expiry estimates are decision aids only. Users must still inspect food and follow package labels for food safety.",
        "<b>Platform limit:</b> Some notification and login behaviors vary by browser. The UI and flows in this guide are clearly optimized for portrait mobile use.",
    ]
    for point in privacy_points:
        story.append(Paragraph(point, s["Body"]))

    story.append(Paragraph("11. Troubleshooting", s["SectionTitle"]))
    trouble_points = [
        "<b>Cannot sign in:</b> confirm internet access and retry in Safari on iPhone/iPad or Chrome on Android.",
        "<b>Scan returns wrong items:</b> retake the receipt photo in better lighting and clean up the result before saving.",
        "<b>Notifications do not arrive:</b> check browser and device notification permissions. On iOS, install the app to the home screen first.",
        "<b>No recipes appear:</b> make sure items are saved in inventory. Recipe results depend on live recommendation services.",
        "<b>Inventory looks outdated:</b> wait for save actions to finish, then reopen or refresh the page once connectivity is stable.",
    ]
    for point in trouble_points:
        story.append(Paragraph(point, s["Body"]))

    story.append(Paragraph("12. Limitations", s["SectionTitle"]))
    limitation_points = [
        "Scan quality still depends on the receipt photo. Wrinkles, blur, glare, and store-specific abbreviations can require manual correction.",
        "The provided UI set contains a few repeated capture states. This guide keeps the repeated screens only when they help explain a distinct task or state change.",
        "Magic Kitchen is intentionally experimental and may generate interesting but unconventional recipe ideas.",
        "The repository did not include official instructor or sponsor metadata, so those cover-page fields are labeled transparently instead of being guessed.",
    ]
    for point in limitation_points:
        story.append(Paragraph(point, s["Body"]))

    return story


def draw_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, letter[0], letter[1], stroke=0, fill=1)
    canvas.restoreState()


def draw_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, letter[0], letter[1], stroke=0, fill=1)
    canvas.setStrokeColor(SOFT_LINE)
    canvas.line(doc.leftMargin, 0.52 * inch, letter[0] - doc.rightMargin, 0.52 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 0.33 * inch, f"Freshli User Guide v{APP_VERSION}")
    canvas.drawRightString(letter[0] - doc.rightMargin, 0.33 * inch, f"Page {doc.page}")
    canvas.restoreState()


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=letter,
        leftMargin=0.65 * inch,
        rightMargin=0.65 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.75 * inch,
        title="Freshli User Guide",
        author=TEAM_MEMBERS,
        subject="User manual for Freshli using supplied UI screens",
    )
    doc.build(build_story(), onFirstPage=draw_cover, onLaterPages=draw_page)
    print(f"Generated {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
