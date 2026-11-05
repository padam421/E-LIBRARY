"""Rebuild the proposal and final report with ReportLab (no network access)."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    Image, Flowable, KeepTogether,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf'
OUT.mkdir(parents=True, exist_ok=True)
NAVY = colors.HexColor('#122d40')
TEAL = colors.HexColor('#087d8b')
INK = colors.HexColor('#243a49')
MUTED = colors.HexColor('#5b6d78')
PALE = colors.HexColor('#edf5f6')
LINE = colors.HexColor('#d6e3e7')
PAGE_W, PAGE_H = A4
WIDTH = PAGE_W - 100
FONT_DIR = Path('C:/Windows/Fonts')
if FONT_DIR.exists():
    for name, filename in [('Body', 'calibri.ttf'), ('Strong', 'calibrib.ttf'), ('Italic', 'calibrii.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / filename)))
    pdfmetrics.registerFontFamily('Body', normal='Body', bold='Strong', italic='Italic', boldItalic='Strong')
else:
    for name, base in [('Body', 'Helvetica'), ('Strong', 'Helvetica-Bold'), ('Italic', 'Helvetica-Oblique')]:
        pdfmetrics.registerFont(pdfmetrics.Font(name, base, 'WinAnsiEncoding'))
    pdfmetrics.registerFontFamily('Body', normal='Body', bold='Strong', italic='Italic', boldItalic='Strong')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='Text', fontName='Body', fontSize=10.5, leading=15, textColor=INK, spaceAfter=9))
styles.add(ParagraphStyle(name='SmallText', parent=styles['Text'], fontSize=9, leading=12, spaceAfter=7))
styles.add(ParagraphStyle(name='TinyText', parent=styles['Text'], fontSize=8, leading=10.5, spaceAfter=4))
styles.add(ParagraphStyle(name='SectionTitle', fontName='Strong', fontSize=20, leading=25, textColor=NAVY, spaceBefore=3, spaceAfter=15))
styles.add(ParagraphStyle(name='SubTitle', fontName='Strong', fontSize=12.5, leading=17, textColor=TEAL, spaceBefore=10, spaceAfter=8))
styles.add(ParagraphStyle(name='CoverTitle', fontName='Strong', fontSize=29, leading=34, textColor=NAVY, spaceAfter=16))
styles.add(ParagraphStyle(name='Kicker', fontName='Strong', fontSize=9, leading=13, textColor=TEAL, spaceAfter=12))
styles.add(ParagraphStyle(name='Cell', parent=styles['SmallText'], fontSize=9.2, leading=12.8, spaceAfter=0))
styles.add(ParagraphStyle(name='CellHead', parent=styles['Cell'], fontName='Strong', textColor=colors.white))
styles.add(ParagraphStyle(name='CaptionText', parent=styles['SmallText'], textColor=MUTED, fontSize=8.5, leading=11, spaceAfter=10))

TITLE = 'E-Library: A Smart Digital Library and Online Reading Platform'
REPO = 'https://github.com/padam421/E-LIBRARY'
LIVE = 'https://e-library-c9t.pages.dev/'
DATE = '5 November 2026'
PROBLEM = (
    'Students and readers often rely on scattered PDF/EPUB files, shared links and separate applications '
    'to locate and read learning materials. This makes it difficult to search resources, resume reading '
    'and maintain a consistent digital collection. Library administrators also need a reliable way to '
    'organize book metadata, control visibility and manage access. E-Library addresses these problems '
    'through a centralized, responsive web application that combines searchable book discovery, '
    'browser-based reading, secure sign-in and an administrator dashboard backed by a MySQL database.'
)
OBJECTIVES = [
    'Develop a responsive digital library for desktop and mobile browsers.',
    'Enable book discovery by title, author, category and PDF/EPUB format.',
    'Provide browser-based PDF and EPUB reading with navigation and saved progress.',
    'Implement Google sign-in, authenticated sessions and role-based administrator access.',
    'Support MySQL-backed book creation, viewing, updating, deletion and bulk import.',
    'Apply the course technologies through a small React/Bootstrap catalogue and a supplementary PHP CSV report tool.',
    'Test major workflows and maintain source code, SQL schema and setup instructions on GitHub.',
]
TECH = [
    ('HTML5', 'Semantic structure, forms, tables, book pages and reading interfaces.'),
    ('CSS3', 'Responsive layouts, Flexbox/Grid, media queries, themes and print styles.'),
    ('JavaScript / AJAX / JSON', 'DOM events, validation, Fetch requests and JSON client-server exchange.'),
    ('React 18.3.1', 'Catalogue state, search/category/format filters, statistics and pagination.'),
    ('Bootstrap 5.3.8', 'Catalogue grid, responsive table, forms, buttons and layout utilities.'),
    ('Node.js / Express', 'Primary backend API, routes, middleware, authentication and business logic.'),
    ('PHP 8.1+', 'Supplementary command-line conversion of public catalogue JSON to safe CSV.'),
    ('MySQL', 'Book/user metadata, administrator audit records, payment records and CRUD.'),
    ('Git / GitHub', 'Version control, repository sharing and automated syntax/PHP checks.'),
]
FEATURES = [
    ('Discovery', 'Search books, view covers and metadata, and browse curated categories.'),
    ('React catalogue', 'Filter by title/author/category/format, view counts, paginate and print the current page.'),
    ('Integrated reading', 'PDF and EPUB viewers, page/chapter navigation and saved reading progress.'),
    ('Access management', 'Public previews, Google sign-in, signed sessions and administrator role checks.'),
    ('Administration', 'Book CRUD, bulk import, public/private visibility and activity logs.'),
    ('PHP reports', 'Export catalogue metadata to CSV with Unicode/quoting support and formula escaping.'),
    ('Existing integrations', 'AI reading assistance, configurable premium access and Razorpay support/payments.'),
    ('Usability / discovery', 'Responsive layouts, theme controls and SEO-ready public book pages.'),
]
CONCEPTS = [
    ('HTML semantics and forms', 'Structured pages, labelled filters, admin forms and tabular catalogue data.'),
    ('CSS and responsive design', 'Flexbox/Grid, Bootstrap breakpoints, media queries and horizontal table scrolling.'),
    ('JavaScript and events', 'Reader controls, form handling, filter events and React state updates.'),
    ('AJAX / JSON / REST', 'Fetch-based communication with Express endpoints such as GET /api/pdfs.'),
    ('Backend development', 'Express routes/controllers plus a separate PHP command-line reporting workflow.'),
    ('Database connectivity / CRUD', 'MySQL connection pooling, parameterized operations and schema files.'),
    ('Authentication and access', 'Google token verification, signed sessions, cookies, CSRF and role middleware.'),
    ('Testing and debugging', 'Syntax checks, browser scenarios, CSV tests, API errors and retry states.'),
    ('Version control / deployment', 'GitHub CI, Cloudflare Pages, hosted Express API, SEO metadata and caching.'),
]
REFS = [
    ('Project source code and SQL schema', REPO),
    ('Project setup and architecture notes', REPO + '/tree/main/docs'),
    ('MDN Web Docs - HTML, CSS and JavaScript', 'https://developer.mozilla.org/en-US/docs/Web'),
    ('React - createElement and browser rendering', 'https://react.dev/reference/react/createElement'),
    ('Bootstrap 5.3 - getting started', 'https://getbootstrap.com/docs/5.3/getting-started/introduction/'),
    ('Express - API reference', 'https://expressjs.com/en/4x/api.html'),
    ('PHP - CSV output with fputcsv', 'https://www.php.net/manual/en/function.fputcsv.php'),
    ('MySQL 8.0 Reference Manual', 'https://dev.mysql.com/doc/refman/8.0/en/'),
]

def p(text, style='Text'):
    return Paragraph(text, styles[style])

def section(number, title):
    return [p(f'{number}  /  WEB DEVELOPMENT', 'Kicker'), p(title, 'SectionTitle')]

def bullets(items, numbered=False):
    return [p(f'<font color="#087d8b"><b>{str(i + 1) + "." if numbered else "-"}</b></font>  {escape(item)}') for i, item in enumerate(items)]

def grid(rows, widths=None, header=None):
    content = []
    if header:
        content.append([p(escape(str(item)), 'CellHead') for item in header])
    content.extend([[p(escape(str(item)), 'Cell') for item in row] for row in rows])
    table = Table(content, colWidths=widths or [WIDTH * .30, WIDTH * .70], hAlign='LEFT', repeatRows=1 if header else 0)
    commands = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8), ('LINEBELOW', (0, 0), (-1, -1), .4, LINE)]
    if header:
        commands += [('BACKGROUND', (0, 0), (-1, 0), NAVY), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, PALE])]
    else:
        commands += [('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, PALE])]
    table.setStyle(TableStyle(commands))
    return table

def callout(label, text):
    table = Table([[p(escape(label), 'SubTitle')], [p(text, 'SmallText')]], colWidths=[WIDTH])
    table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), PALE), ('BOX', (0, 0), (-1, -1), .6, LINE),
                               ('LEFTPADDING', (0, 0), (-1, -1), 13), ('RIGHTPADDING', (0, 0), (-1, -1), 13),
                               ('TOPPADDING', (0, 0), (-1, 0), 4), ('BOTTOMPADDING', (0, -1), (-1, -1), 6)]))
    return table

class Architecture(Flowable):
    def __init__(self):
        Flowable.__init__(self)
        self.width, self.height = WIDTH, 223

    def draw(self):
        c = self.canv
        def box(x, y, w, h, title, lines):
            c.setFillColor(PALE); c.setStrokeColor(LINE); c.roundRect(x, y, w, h, 6, fill=1, stroke=1)
            c.setFillColor(NAVY); c.setFont('Strong', 10); c.drawCentredString(x+w/2, y+h-19, title)
            c.setFillColor(MUTED); c.setFont('Body', 8.5)
            for i, text in enumerate(lines): c.drawCentredString(x+w/2, y+h-34-i*12, text)
        def arrow(x1, y1, x2, y2):
            c.setStrokeColor(TEAL); c.setLineWidth(1.2); c.line(x1,y1,x2,y2)
            if y1 == y2:
                c.line(x2-5,y2+3,x2,y2); c.line(x2-5,y2-3,x2,y2)
            else:
                c.line(x2-3,y2+5,x2,y2); c.line(x2+3,y2+5,x2,y2)
        box(0, 138, 145, 72, 'Browser frontend', ['HTML / CSS / JavaScript', 'React + Bootstrap catalogue'])
        box(176, 138, 145, 72, 'Express API', ['Sessions / roles / CRUD', 'Public metadata + readers'])
        box(352, 138, 143, 72, 'MySQL', ['Books / users / audit', 'Orders / entitlements'])
        arrow(145,174,176,174); arrow(321,174,352,174)
        box(176, 13, 145, 74, 'Media + integrations', ['Drive / optional R2 storage', 'Google / AI / Razorpay'])
        arrow(248,138,248,87)
        box(0, 13, 145, 74, 'PHP report tool', ['Public catalogue JSON', 'Offline CSV export'])
        c.setStrokeColor(TEAL); c.setDash(3,3); c.line(72,138,72,87); c.setDash()
        c.setFillColor(MUTED); c.setFont('Italic',7.8); c.drawString(4,112,'Supplementary metadata report')

class ERDiagram(Flowable):
    def __init__(self):
        Flowable.__init__(self)
        self.width, self.height = WIDTH, 330

    def draw(self):
        c = self.canv
        def box(x,y,w,title,fields):
            height = 82
            c.setFillColor(PALE); c.setStrokeColor(LINE); c.roundRect(x,y,w,height,5,fill=1,stroke=1)
            c.setFillColor(NAVY); c.setFont('Strong',10); c.drawString(x+9,y+height-18,title)
            c.setFont('Body',8.4); c.setFillColor(INK)
            for i, field in enumerate(fields): c.drawString(x+9,y+height-35-i*12,field)
        box(0,238,150,'users',['PK id; UNIQUE email','name, role, last_login'])
        box(345,238,150,'books_data',['PK id; title, author, category','visibility; asset references'])
        box(0,116,150,'payment_orders',['PK id; FK user_id','scope, book_id, status'])
        box(172,116,150,'user_entitlements',['PK id; FK user_id','FK source_order_id; expires_at'])
        box(345,116,150,'book_premium_rules',['PK/FK book_id','is_premium, price_paise'])
        box(0,0,150,'support_contributions',['PK id; FK order_id, user_id','supporter, message, status'])
        box(345,0,150,'admin_activity_logs',['PK id; actor_email','action, target_id, created_at'])
        c.setStrokeColor(TEAL); c.setLineWidth(1)
        c.line(75,238,75,198); c.line(150,275,247,275); c.line(247,275,247,198)
        c.line(150,157,172,157); c.line(75,116,75,82); c.line(420,238,420,198)
        c.setFillColor(TEAL); c.setFont('Strong',8)
        c.drawString(82,214,'1 : N'); c.drawString(196,281,'1 : N'); c.drawString(151,165,'1 : N')
        c.drawString(82,93,'1 : 0..1'); c.drawString(428,213,'1 : 0..1')
        c.setFont('Italic',8); c.setFillColor(MUTED)
        c.drawString(177,65,'Solid lines: declared foreign keys.')
        c.drawString(177,51,'Audit actors/targets use logical references.')
        c.drawString(177,37,'Orders/entitlements carry logical book_id values.')

def screenshot(name, caption, max_height=250):
    filename = ROOT / 'docs' / 'screenshots' / name
    from PIL import Image as PILImage
    with PILImage.open(filename) as im:
        w,h = im.size
    scale = min(WIDTH/w, max_height/h)
    image = Image(str(filename), width=w*scale, height=h*scale)
    image.hAlign = 'LEFT'
    return KeepTogether([image, Spacer(1,6), p(caption, 'CaptionText')])

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE); canvas.setLineWidth(.6); canvas.line(50,45,PAGE_W-50,45)
    canvas.setFillColor(MUTED); canvas.setFont('Body',8)
    canvas.drawString(50,31,'Padam Kishore  |  25CS003692  |  E-Library')
    canvas.drawRightString(PAGE_W-50,31,f'{doc.page}')
    if doc.page > 1:
        canvas.setFont('Strong',8); canvas.setFillColor(TEAL)
        canvas.drawString(50,PAGE_H-31,doc.short_title.upper())
        canvas.setStrokeColor(LINE); canvas.line(50,PAGE_H-39,PAGE_W-50,PAGE_H-39)
    canvas.restoreState()

def cover(kind, abstract):
    return [Spacer(1,14), p('SIR PADAMPAT SINGHANIA UNIVERSITY', 'Kicker'),
        p('WEB DEVELOPMENT  /  ' + kind.upper(), 'Kicker'), Spacer(1,15),
        p('E-Library', 'CoverTitle'), p('A Smart Digital Library and<br/>Online Reading Platform', 'SectionTitle'),
        Spacer(1,13), grid([
            ('Student name','Padam Kishore'), ('Enrollment number','25CS003692'),
            ('Programme','B.Tech CSE (AI-ML)'), ('Semester','III'),
            ('University','Sir Padampat Singhania University'), ('Course','Web Development'),
            ('Submission date',DATE),
        ]), Spacer(1,21), p('Project overview', 'SubTitle'), p(abstract),
        Spacer(1,8), p(f'<b>Repository:</b> <link href="{REPO}" color="#087d8b">github.com/padam421/E-LIBRARY</link>', 'SmallText'),
        p(f'<b>Live library:</b> <link href="{LIVE}" color="#087d8b">e-library-c9t.pages.dev</link>', 'SmallText'),
        p('Primary stack: HTML5, CSS3, JavaScript, Node.js/Express and MySQL.<br/>Supplementary module: React, Bootstrap and PHP catalogue reporting.', 'SmallText')]

def reference_blocks():
    blocks = []
    for i,(label,url) in enumerate(REFS,1):
        blocks.append(p(f'<b>{i}. {escape(label)}</b><br/><link href="{escape(url)}" color="#087d8b">{escape(url)}</link>', 'SmallText'))
    blocks.append(p('Academic requirements: the user-supplied Minor Project Guidelines and Google Form screenshots for the Web Development course. No public guideline URL was provided.', 'SmallText'))
    return blocks

def create_pdf(filename, short_title, story):
    doc = SimpleDocTemplate(str(OUT / filename), pagesize=A4, leftMargin=50, rightMargin=50,
        topMargin=60,bottomMargin=61,title=TITLE + ' - ' + short_title,author='Padam Kishore',
        subject='Web Development mini project, enrollment 25CS003692')
    doc.short_title = short_title
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    return OUT / filename

def proposal():
    story = cover('Mini Project Proposal',
        'E-Library brings searchable book discovery, integrated PDF/EPUB reading and administrator-managed '
        'content into one responsive web application. The proposal builds on an existing implementation '
        'and introduces a small catalogue/report module to demonstrate the requested course technologies '
        'without restructuring the main library.')
    story += [PageBreak()] + section('03', 'Problem statement') + [p(PROBLEM),
        p('Intended users', 'SubTitle'), p('Students and general readers use the public catalogue and reading interfaces. Authorized administrators maintain the collection, metadata and visibility settings.'),
        p('04  Objectives of the project','SubTitle')] + bullets(OBJECTIVES, True)
    story += [PageBreak()] + section('05','Proposed solution') + [
        p('Provide a centralized browser-based platform with a public discovery layer, authenticated reading and a protected administrator workspace. The frontend exchanges JSON with an Express API; MySQL stores structured records while book assets remain in configured media storage.'),
        Architecture(), Spacer(1,10),
        grid([('Visitor','Browse public titles, inspect metadata and open permitted previews.'),
              ('Signed-in reader','Read permitted full documents and resume the reading experience.'),
              ('Administrator / owner','Create, update, import and delete book records; manage visibility and authorized administration.')],header=['Role','Main workflow']),
        Spacer(1,13), callout('Small, practical extension', 'A separate React/Bootstrap catalogue reuses the existing public API. A supplementary PHP CLI tool exports public metadata to CSV. The main library interface, reader routes, database schema and primary Express backend are retained.')]
    story += [PageBreak()] + section('06','Key features and functionalities') + [grid(FEATURES,header=['Module','Functionality']),
        Spacer(1,9), p('07  Proposed technologies','SubTitle'),grid(TECH,header=['Technology','Role in this project'])]
    story += [PageBreak()] + section('08','Expected outcomes') + [
        p('Deliver a functional digital library that reduces fragmented resource discovery, supports in-browser reading and gives administrators a consistent content-management workflow. The result should be demonstrable from desktop and mobile browsers with a documented setup and reproducible source code.'),
        p('Acceptance criteria','SubTitle')] + bullets([
            'Readers can locate a title, open its details and use the available PDF/EPUB reading path.',
            'Authorized administrators can maintain book records through the existing MySQL-backed API.',
            'The catalogue filters, paginates and prints correctly; PHP generates a valid CSV report.',
            'Source code, SQL schema, proposal/report PDFs and repository links are available for evaluation.',
        ]) + [p('09  Application of web development concepts','SubTitle'),grid(CONCEPTS,header=['Course concept','Practical application'])]
    story += [PageBreak()] + section('10','References') + reference_blocks() + [Spacer(1,9),
        callout('Feasibility and deployment', 'The existing static frontend targets Cloudflare Pages and the primary Express API uses a separate host. PHP reporting runs locally or on a PHP-capable host. External Google, AI, media and Razorpay integrations depend on their configured credentials and services.'),
        Spacer(1,12),p('Evaluation demonstration','SubTitle'),p('Demonstrate discovery, catalogue filters, one available reader, administrator book management and PHP CSV export. Explain the client-server request flow, database relationships, validation and role checks. The accompanying final report records implementation evidence and the validation completed for this update.')]
    return create_pdf('25CS003692_MiniProjectProposal.pdf','Mini Project Proposal',story)

def report():
    story = cover('Project Report',
        'This report documents the existing E-Library application and a focused catalogue/report extension. '
        'The application combines public book discovery, browser-based PDF/EPUB reading, Google sign-in '
        'and administrator-controlled MySQL records. The extension adds an isolated React/Bootstrap '
        'catalogue and a PHP CSV exporter while preserving the established reading workflow.')
    story += [PageBreak()] + section('02','Problem statement and objectives') + [p(PROBLEM),p('Project objectives','SubTitle')] + bullets(OBJECTIVES,True) + [
        callout('Design rationale','Keep the established architecture and add a useful, limited module. React and Bootstrap improve tabular discovery; PHP supplies an offline metadata report. Adding these technologies does not require replacing the primary web backend.')]
    story += [PageBreak()] + section('03','Scope and requirements') + [
        grid([('Public discovery','Searchable book cards/details, categories, catalogue filters and preview entry points.'),
              ('Reading','PDF/EPUB viewing, navigation and saved progress in the existing reader interfaces.'),
              ('Administration','Role-protected book CRUD, bulk import, visibility management and audit logs.'),
              ('Reporting','Printable catalogue pages and supplementary PHP CSV export of public metadata.'),
              ('Existing optional modules','AI assistance, premium access, support payments and media integration.')],header=['Scope area','Functional requirement']),
        Spacer(1,15),p('Non-functional requirements','SubTitle')] + bullets([
            'Responsive page layouts, labelled controls and usable empty/loading/error states.',
            'Server-side access checks and input handling at existing API boundaries.',
            'No secrets in tracked source; environment-specific service credentials remain outside Git.',
            'Reusable MySQL schema, documented setup and version-controlled source.',
            'Cached public data, paginated rendering and locally served catalogue dependencies.',
        ]) + [p('Execution requirements','SubTitle'),p('A modern browser, Node.js with npm, a MySQL database and the backend environment configuration are required for the core application. PHP 8.1+ is needed only for the supplementary exporter. Provider-backed sign-in, storage, AI and payments require their corresponding credentials.'),
        p('Scope limits','SubTitle'),p('This project is a digital reading platform rather than a physical circulation system. Physical issue/return tracking, barcode scanning and fine calculation are outside the current scope. No database migration was needed for the catalogue/report addition.')]
    story += [PageBreak()] + section('04','System design and architecture') + [Architecture(), Spacer(1,15),
        p('Request flow','SubTitle')] + bullets([
            'The browser loads the frontend and requests public metadata from GET /api/pdfs.',
            'Express routes delegate to controllers and models; MySQL returns the book records.',
            'The catalogue renders escaped text and applies search, category and format filters locally.',
            'Reader endpoints apply session/access checks before serving protected assets.',
            'Administrator mutations pass through role and CSRF middleware before database changes.',
            'The PHP CLI exporter consumes public API JSON or a saved public snapshot and writes CSV.',
        ],True) + [p('Access boundaries','SubTitle'),p('Google tokens are verified by the backend before signed sessions are used. Administrator routes check the session and database role. The new catalogue consumes the existing public metadata contract and introduces no alternate reader or administrator endpoint.'),
        p('Deployment boundary','SubTitle'),p('The static frontend can be served by Cloudflare Pages, with Express and MySQL hosted separately. PHP is a local/server-side reporting utility and is not executed by the static Pages deployment.')]
    story += [PageBreak()] + section('05','Database design') + [
        p('The core catalogue uses books_data and users. Existing extensions store premium rules, payment orders, user entitlements, support contributions and administrator activity. The diagram highlights selected entities; payment_settings is a separate configuration table.'),
        ERDiagram(),Spacer(1,12),
        grid([('books_data','Book ID, title, author, category, description, asset references and is_private.'),
              ('users','Unique email, Google profile fields, role and login timestamps.'),
              ('Payments / access','Orders, entitlements, premium rules and supporter records.'),
              ('Admin activity','Actor email, action, target information and timestamps.')],header=['Data group','Stored information']),Spacer(1,8),
        p('SQL delivery: PDF-Library/sql/001_schema.sql, followed by the documented repair/audit/payment/support scripts. Parameterized database operations are used in the existing backend. The ER view distinguishes declared foreign keys from logical email/book references.', 'SmallText')]
    story += [PageBreak()] + section('06','Implementation and technologies') + [grid(TECH,header=['Technology','Implementation role']),Spacer(1,12),
        p('New module files','SubTitle'),grid([
            ('frontend/catalogue.html','Standalone semantic page; a footer link makes it discoverable.'),
            ('assets/js/catalogue.js','React state/effects, Fetch, filters, counts, pagination, retries and escaped text.'),
            ('assets/css/catalogue.css','Catalogue-specific styles and print rules; Bootstrap remains isolated to this page.'),
            ('php/export-catalogue.php','CLI-only JSON-to-CSV tool, bounded input, validation and safe output creation.'),
            ('Tests and CI','Browser scenarios, 25 PHP checks, HTTP integration tests and CI coverage.')],header=['File / area','Implementation']),Spacer(1,10),
        p('The existing reader, authentication, payment and database modules are retained. Local vendor files keep the catalogue independent of runtime CDN requests. PHP output includes only metadata fields; spreadsheet-sensitive values are escaped and existing output files are not overwritten.', 'SmallText')]
    story += [PageBreak()] + section('07','Screenshots of major modules') + [
        screenshot('home-library.png','Figure 1. Existing public library discovery interface. Source: repository walkthrough screenshot.',255),
        screenshot('pdf-reader-preview.png','Figure 2. Existing PDF reading interface with navigation controls. Source: repository walkthrough screenshot.',255),
        p('These screenshots document the existing interface. They are not new end-to-end authentication, payment or reader test results.', 'SmallText')]
    story += [PageBreak()] + section('07','Administration and catalogue') + [
        screenshot('admin-access.png','Figure 3. Existing administrator dashboard for book management. Source: repository walkthrough screenshot.',245),
        screenshot('catalogue-overview.png','Figure 4. New React/Bootstrap catalogue captured locally using a 128-book database snapshot on 5 November 2026.',300),
        p('The catalogue reuses the public JSON endpoint, supports title/author/category/format filtering and renders at most 20 rows per page. Printing applies to the current page.', 'SmallText')]
    tests = [
        ('Backend syntax','PASS','npm run check completed.'),
        ('Tracked secrets','PASS','No tracked secret files found; local credentials remain ignored.'),
        ('Catalogue desktop/mobile','PASS','Rendering, filters, pagination, book links, print action and mobile overflow checks.'),
        ('Catalogue resilience','PASS','Escaped malicious-looking title; API failure/retry, invalid response and empty catalogue.'),
        ('PHP syntax / behaviour','PASS','Syntax valid; 25 checks for CSV, Unicode, formulas, privacy, invalid input and safe output.'),
        ('PHP HTTP integration','PASS','Successful API export, upstream failure, redirect rejection and invalid response structure.'),
        ('Actual CSV export','PASS','128 local catalogue records exported and verified as a five-column CSV.'),
        ('Database / deployed API','PASS','Read-only database count: 128; deployed public API returned HTTP 200 with 130 books.'),
        ('External full workflows','REVIEWED','OAuth, payments, AI and protected readers inspected in code; not fully exercised in this update.'),
    ]
    story += [PageBreak()] + section('08','Testing and results') + [
        p('Validation was completed on 5 November 2026. Browser checks used deterministic fixtures for error and edge cases; the report screenshot and CSV check also used an actual local database snapshot.'),
        grid(tests,[WIDTH*.25,WIDTH*.14,WIDTH*.61],header=['Check','Result','Evidence / boundary']),
        Spacer(1,15),p('Result interpretation','SubTitle'),p('The tested catalogue and CSV reporting workflows passed. The two book counts refer to separate local and deployed snapshots and may change over time. Syntax checks and code inspection do not establish that every existing provider-backed workflow is operational.'),
        callout('Evaluation checks still required','Before a live demonstration, verify the deployed frontend/API configuration, sign in using the intended Google account, open a permitted PDF/EPUB and demonstrate administrator CRUD on suitable test records. Payment testing should use the appropriate configured test environment; no real purchase was made during this update.')]
    story += [PageBreak()] + section('09','Conclusion and future enhancements') + [
        p('E-Library combines discovery, reading and administrator-managed metadata in a single web application. The focused catalogue/report extension demonstrates React, Bootstrap and PHP alongside the existing HTML/CSS/JavaScript, Express and MySQL stack. The verified additions provide a usable filtered catalogue and a safe, portable metadata export without restructuring the core reading system.'),
        p('Future enhancements','SubTitle')] + bullets([
            'Add server-side catalogue pagination and indexed search as the collection grows.',
            'Expand automated integration coverage for authentication, protected readers and administrator CRUD.',
            'Improve accessibility audits and offer additional interface languages.',
            'Extend reporting with scheduled summaries and richer collection analytics.',
        ]) + [p('10  References','SubTitle')] + reference_blocks()
    return create_pdf('25CS003692_E-Library_ProjectReport.pdf','Project Report',story)

if __name__ == '__main__':
    for document in (proposal(), report()):
        print(document)
