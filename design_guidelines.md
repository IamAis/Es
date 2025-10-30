# Design Guidelines: FatturaPA Local Invoice Manager

## Design Approach

**System-Based with Custom Italian Flair**: Combining Fluent Design's productivity focus with Italian government portal sensibility. A desktop-first application optimized for efficient invoice processing with warm, professional aesthetics that reflect Italian design heritage.

**Design Principles**:
- Single-window workflow efficiency
- Immediate visual feedback for all actions
- Professional government-grade reliability with modern polish
- Split-pane layout for simultaneous file list and preview

---

## Color System (User Theme)

**Light Mode**:
- Background: hsl(0 0% 94.12%) - warm light gray
- Card surfaces: hsl(0 0% 98.82%) - nearly white
- Primary accent: hsl(342 85.11% 52.55%) - vibrant pink-red
- Secondary: hsl(0 0% 76.86%) - medium gray
- Foreground text: hsl(0 0% 10.2%) - near black
- Muted text: hsl(0 0% 12.94%)
- Border: hsl(0 0% 90.98%)

**Dark Mode**:
- Background: hsl(20 14% 4%) - deep warm charcoal
- Card surfaces: hsl(20 14% 8%)
- Primary accent: hsl(9 75% 61%) - warm coral-red
- Muted: hsl(20 14% 15%)
- Foreground text: hsl(45 25% 91%) - warm off-white
- Border: hsl(20 14% 15%)

---

## Typography System

**Primary Font**: Poppins (sans-serif)
- Window title: 24px/700
- Section headers: 18px/600
- Table headers: 13px/600 uppercase, letter-spacing 0.5px
- Body text: 14px/400
- Invoice metadata: 12px/500
- Status labels: 11px/600 uppercase

**Monospace Font**: Menlo
- File names: 12px/400
- XML technical data: 11px/400

---

## Layout System

**Spacing Primitives**: Tailwind units 2, 3, 4, 6, 8, 12
- Window padding: p-6
- Card padding: p-6
- Component gaps: gap-4 to gap-6
- Table cell padding: px-4 py-3

**Application Structure**:
- **Three-column layout** for desktop window:
  - Left sidebar (240px): Quick filters and file import zone
  - Center panel (flex-1, min 400px): Invoice table/grid
  - Right panel (480px, resizable): PDF preview + invoice details
- Splitter handles between panels (w-1, draggable)
- Minimum window size: 1200x700px

---

## Component Library

### Main Window Layout

**Title Bar** (custom, height 48px):
- App icon + "FatturaPA Manager" (left, px-4)
- Search bar (center, max-w-md)
- Theme toggle + Settings icon button (right, px-4)
- Subtle bottom border for depth

**Left Sidebar**:
- Drag-and-drop import zone at top (p-6, border-dashed, rounded-lg)
  - Upload icon (w-12 h-12, primary color)
  - "Trascina XML/P7M" heading (16px/600)
  - "oppure clicca per selezionare" subtext (12px/400)
  - Supported formats indicator
- Quick filters section (mt-6):
  - "Tutte le fatture" count badge
  - "Da pagare" with count
  - "Pagate" with count
  - "Anno corrente" / "Anno precedente"
  - Custom date range picker trigger
- Storage stats at bottom (p-4, border-top):
  - "456 fatture" count
  - "2.3 GB utilizzati" size indicator

### Invoice Table (Center Panel)

**Table Structure**:
- Sticky header with sort icons
- Columns: Checkbox (32px) | Numero (100px) | Fornitore (flex-1) | Data (90px) | Importo (110px) | Stato (90px) | Azioni (60px)
- Row height: h-12
- Alternating row background (subtle)
- Hover state: slight elevation, primary border-left (4px)
- Selected state: primary background at 8% opacity

**Status Badges**:
- Rounded-full, px-3 py-1, 11px/600 uppercase
- "RICEVUTA" - green variant
- "DA PAGARE" - amber variant  
- "PAGATA" - primary color variant
- "SCADUTA" - red variant

**Empty State** (when no invoices):
- Centered illustration (w-64 h-64): Italian invoice document with checkmark
- "Nessuna fattura importata" heading (20px/600)
- "Trascina file XML nella zona di caricamento" instruction
- Primary CTA button: "Seleziona File"

### PDF Preview Panel (Right Side)

**Tab System** (height 44px):
- Three tabs: "Anteprima PDF" | "XML Originale" | "Dettagli Fattura"
- Active tab: primary border-bottom (3px), primary text color
- Tab icons prefix each label

**PDF Viewer Tab**:
- Embedded PDF (full height minus tabs and toolbar)
- Floating toolbar overlay (top-right, p-2, backdrop-blur, rounded-lg):
  - Zoom controls (+/- buttons)
  - Download PDF button
  - Print button
  - Close preview (X icon)
- Page indicator (bottom-center): "Pagina 1 di 3"

**XML Tab**:
- Syntax-highlighted XML display
- Line numbers (muted color, right-aligned)
- Collapsible sections for major XML nodes
- Copy XML button (top-right)
- Monospace font throughout

**Dettagli Tab**:
- Structured invoice information display:
  - **Emittente section**: Logo placeholder + denomination + P.IVA
  - **Destinatario section**: Company name + address
  - **Documento section**: Numero, Data, Importo totale (large, 24px/700)
  - **Dettaglio Righe**: Expandable list of line items
  - **Pagamento section**: Modalità, scadenza, importo
- Edit status dropdown
- Add note textarea
- Tag selector (multi-select chips)

### Action Components

**Toolbar** (below table, sticky):
- Batch actions when items selected (slide-up animation):
  - Selected count: "3 fatture selezionate"
  - Download XML button
  - Download PDF button
  - Marca come pagata
  - Elimina (destructive variant)
  - Deseleziona tutto (text button)
- Search/filter controls when nothing selected:
  - Global search input (icon-prefix)
  - Date range filter dropdown
  - Amount range filter
  - Status filter (multi-select)
  - Clear filters button

**Context Menu** (right-click on table row):
- Visualizza PDF
- Scarica XML originale
- Scarica PDF
- Stampa
- Marca come pagata/non pagata
- Aggiungi nota
- Divider
- Elimina fattura (red text)

**Buttons**:
- Primary: px-6 py-2, rounded-md, primary background, white text
- Secondary: px-6 py-2, rounded-md, border variant
- Destructive: px-6 py-2, rounded-md, red background
- Icon-only: w-9 h-9, rounded-md
- On hero/images: backdrop-blur-md, semi-transparent background

### Modals & Dialogs

**Delete Confirmation**:
- Centered modal (max-w-md)
- Warning icon (amber color, w-12 h-12)
- "Elimina fattura?" heading
- File name + date display
- Warning text: "Verranno eliminati sia l'XML che il PDF generato"
- Buttons: "Annulla" (secondary) + "Elimina" (destructive)

**Import Progress**:
- Toast notification (bottom-right)
- Progress bar with percentage
- "Importazione in corso..." message
- File name being processed
- Success state with checkmark animation

**Settings Dialog**:
- Tabs for: Generale | Cartella Storage | Preferenze PDF
- Storage path selector with browse button
- Auto-backup toggle
- PDF generation options (page size, font, margins)
- Dark/light theme toggle
- Language selector (Italian default)

---

## Images

**Empty State Illustration**:
- Line art style illustration of Italian electronic invoice (fattura elettronica)
- Shows stylized XML document with Italian flag colors accent
- Dimensions: 256x256px
- Placement: Center of invoice table when empty
- Style: Minimal, professional, single-color line art with primary accent color

**No large hero image** - this is a productivity desktop application focused on efficiency.

---

## Interactions & Animations

**File Import**:
- Drag-over state: dashed border animates, scale(1.02) on drop zone
- Drop feedback: success pulse animation (200ms)
- Processing indicator: skeleton loader in table row

**Table Interactions**:
- Row hover: 100ms ease transition, subtle elevation
- Row selection: checkbox fade-in on hover (150ms)
- Sort animation: rows slide with 200ms stagger effect

**Panel Resizing**:
- Splitter handle hover: primary color highlight
- Resize cursor on handle hover
- Smooth panel width transition (disabled during drag)

**PDF Loading**:
- Skeleton loader with shimmer effect
- Fade-in when loaded (300ms)

**Minimal Purposeful Motion**:
- Modal/dialog: 200ms fade + scale(0.95 to 1)
- Toast notifications: slide-in-right 250ms
- Dropdown menus: 150ms fade + y-translate
- No page transitions (instant navigation)

---

## Responsive Behavior

**Large Desktop (1600px+)**: Full three-column layout, wider panels
**Standard Desktop (1200-1599px)**: Balanced three-column layout
**Small Desktop (1024-1199px)**: Narrower sidebar, resizable panels more important
**Tablet/Fallback (<1024px)**: Two-column (collapsible sidebar), PDF preview as overlay modal

---

## Accessibility

- Keyboard shortcuts for all primary actions (displayed in tooltips)
- Focus indicators: 2px primary color outline, offset 2px
- Skip navigation for keyboard users
- ARIA labels for all icon-only buttons
- Screen reader announcements for file import success/failure
- High contrast mode support
- Scalable font sizes (respect OS settings)