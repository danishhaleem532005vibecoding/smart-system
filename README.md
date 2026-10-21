# Student Barcode Attendance Management System

A complete, functional, easy-to-use, and client-side **Student Barcode Attendance Management System**. 

Built entirely in HTML, CSS, and JavaScript. **No local server or hosting required** — simply double-click `index.html` to run in any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, Safari, etc.).

---

## Features & Modules

### 1. Student Attendance Through Barcode Scanning
- **Dual Scanner Support (USB Barcode Scanner & Device Camera)**:
  - **USB Hardware Barcode Scanner**: Automatically captures barcode scans from any standard USB keyboard-emulation barcode scanner, or via manual input.
  - **Live Device Camera / Webcam Scanner**: Uses your computer webcam, laptop camera, or mobile device camera to scan barcode cards optically in real-time with an animated laser viewfinder.
  - **Camera Switcher & Auto-Start**: Choose between multiple cameras and toggle "Auto-start camera on page load".
- **Instant Student Identification**: Identifies the student and records attendance date, time, and status.
- **Feedback & Chimes**: Built-in audio chimes (Web Audio API) and visual banners for success, duplicate detection, and invalid barcodes.
- **Duplicate Prevention**: Strictly prevents duplicate attendance entries for the same student on the same calendar day.
- **Invalid Barcode Alert**: Shows an error banner and audible buzz when an unregistered barcode is scanned.
- **Webcam Photo Snapshots**: Allows taking a student's photo directly using your webcam during Student Registration or ID Card Generation.

### 2. Live Attendance Monitoring Screen
- **Full-Screen Distance-Readable Interface**: Designed for high-contrast viewing on school monitors and TVs across a room.
- **Live Displays**:
  - Live digital clock and current date.
  - Student photo / avatar, full name, student ID, class, attendance time, and status badge.
  - **Total Students Marked Present Today** live counter.
  - **Live Scan Stream** displaying recent scan logs.
  - **1-Click Test Chips**: Test valid and invalid scans with a single click.

### 3. Generate Student ID Cards With Barcodes
- **Standard CR80 ID Card Layout** (85.6mm × 53.98mm physical standard).
- **Form Fields**:
  - Student Full Name
  - Student ID / Registration Number
  - Class
  - Optional Student Photo (Upload image or use auto-generated avatar)
  - Institution Name (editable)
- **Code128 Barcodes**: Generates crisp, high-resolution barcodes readable by any standard USB scanner.
- **Live Preview**: Updates in real-time as you type or pick a student.
- **Download as PDF**: Generates a high-resolution, print-ready PDF card.
- **Print ID Card**: Direct browser print functionality formatted specifically for ID card printers or cardstock paper.

### 4. Student Registration
- Simple registration form with unique Student ID and unique Barcode validation.
- Searchable and filterable student directory table.
- Direct "ID Card" button to instantly generate/recreate an ID card for any student.
- Direct "Scan" button to simulate attendance marking.
- Pre-populated with 5 sample students for immediate testing.

### 5. Attendance Records
- Comprehensive tabular log: `#`, `Student Name`, `Student ID`, `Class`, `Date`, `Time`, and `Status`.
- **Filtering**:
  - Filter by Date (Date picker, "Today", or "All Dates").
  - Filter by Class (dynamic dropdown).
  - Search by Student Name or ID.
- **Export to PDF**: Produces a clean, formatted, official attendance PDF report with school header, date/class filters, and totals.
- **Print Table**: Direct print option.

---

## Technical Details

- **No Local Server Required**: Runs entirely client-side as pure HTML/CSS/JS.
- **Offline Capable**: All libraries (`JsBarcode`, `jsPDF`, `html2canvas`) are stored locally in the `libs/` folder.
- **Persistent Database**: Uses browser `IndexedDB` with `localStorage` fallback so all registered students and attendance records persist across restarts.
- **Audio Synthesis**: Uses browser Web Audio API for offline sound chimes with zero external audio assets.

---

## How to Run

1. Navigate to the project folder:
   ```
   school management soft barcode scanner/
   ```
2. Double-click [index.html](file:///c:/Users/Hack3r/Documents/school%20management%20soft%20barcode%20scanner/index.html) to open it in your browser.
3. Plug in your USB barcode scanner and start scanning!
