# Who's Free? — Web App v12

A privacy-first static web app for comparing Omnivox schedules.

## v12: editable weekly grid and manual schedules

- Picture detection fills a seven-day grid. Select a busy block to edit its
  day, start/end time or wording; the grid and break durations update immediately.
- **Enter schedule manually** opens the same blank grid without running OCR.
  Use the **+** beside a day to add occupied times. Labels and course details
  are optional; only day and valid times affect availability.
- **Edit** beside a saved person reopens their grid. Save applies corrections;
  Cancel leaves the existing database unchanged. An empty schedule is allowed.
- Detection retains occupied cells even when their text has no recognizable
  course code or room. Unreadable text and merged courses are flagged for review
  while keeping their occupied span. Course names never determine breaks.
- Green blocks show gaps between occupied times. Overlapping busy spans are
  combined when calculating gaps and break notifications, preventing false breaks.
- Local OCR was rerun on all three supplied pictures: 20, 16 and 15 occupied
  entries respectively, with all previous day/time/code/section/room results intact.
  Automated checks cover live grid edits, gaps, overlaps, manual entry without
  OCR, optional labels, saved-schedule editing, validation and cancellation.

This version has not been deployed or tested on a real iPhone Safari browser.

## Earlier: additional schedule layouts

- Seven-day timetables retain Saturday and Sunday classes, including their
  day in the editable review and exported database. Weekend classes also
  affect availability, next-class details and break notifications; the app
  no longer assumes everyone is free on weekends.
- Faint JPEG grid borders are detected without treating dense text as a
  border. The full-page time labels are used first to avoid cropping a final
  digit from the narrow time column.
- Athlete and conflict labels are retained as `kind: "busy_block"` entries.
  They count as occupied time for availability; review or remove them when
  the label doesn't represent a real commitment. Their hidden course names
  and details are not inferred.
- Numeric room `900`, wrapped room `D-120B`, and wrapped instructor names
  remain complete.
- A region containing multiple course codes is kept as an uncertain busy
  span for review and splitting in the editor.

Two additional uploaded schedules were processed locally: the first yielded
12 classes and 8 labeled busy blocks; the second yielded 16 classes including
Saturday. All day/start/end times, course codes, sections and rooms matched
the visible images. Text recognition still misread some accents, roman `I`
as `|`, and `Conflict 1` as `Conflict 4`; correct these in review. The original
15-session sample also passed again. Ten automated regression tests pass.
No real iPhone Safari validation or website deployment has been performed.

## New in v10: local picture import

**Schedules → Add schedule picture** accepts JPEG, PNG and WebP screenshots.
Tesseract.js reads English/French text on the device, while a timetable parser
uses visible grid borders and the printed time column to assign each class
to its weekday and time. There is no OCR server or AI API call.

The recognized schedule opens in a review screen. Enter the person's name if
the picture has no name header, compare the extracted classes with the
original picture, correct fields, and add/remove classes before saving.
Recognition never writes the database until **Save schedule** is selected.
Replacing an existing person's schedule requires confirmation.

Use a clear, upright screenshot that includes all five weekday headings,
the left time column and the grid borders. Blurry or tilted camera photos,
cropped headings and different timetable layouts may fail or need manual
corrections. OCR can misread names and codes even in a clear screenshot.
The existing PDF importer still expects a text-based Omnivox PDF; for an
image-only PDF, use the original picture with the new picture importer.

The OCR code and English/French language files are bundled in `assets/ocr/`.
The first picture import downloads these static files from this same website;
no picture bytes are uploaded. On supported browsers, the service worker
caches the files as they are used so later imports can run offline. Offline
recognition requires a completed first import and retained browser storage.
The website's existing analytics and GSAP loading are unchanged; neither
receives the picture or recognized schedule data from the picture importer.

Deploy all app files, including `schedule-image-parser.js` and `assets/ocr/`,
to the existing GitHub Pages repository root. No backend, API key or build
step is needed. The v12 shell cache and asset URLs replace earlier shells.
The optional `package.json`, lockfile and `tests/` are for development only.

### Validation

Run `npm install` and `npm test` with Node.js 20.19 or newer. Tests cover
missing time labels, French weekday headings, review/name/time validation,
correction persistence, cancellation, and lazy offline caching of OCR assets.

The uploaded sample schedule was also processed locally with Tesseract.js
6.0.1 and core 6.0.0: all 15 sessions and their day/start/end times matched
the manual transcription. One instructor name was misread, confirming the
need for review. Real iPhone Safari performance and layout still need device
testing; the automated review tests use a DOM simulation.

## What's new in v8

- Fixed the iPhone time-control overflow by stacking Day and Time on narrow screens and removing Safari's stubborn native minimum width.
- Light/dark controls remain in **Settings → Themes**.
- Five saved full-app theme templates: **Ocean, Lavender, Rose, Forest, and Sunset**. Each recolors backgrounds, panels, cards, inputs, buttons, borders, timelines, badges and accents.
- Per-person **nicknames** that replace the full name throughout the main UI and notifications.
- Per-person **pins** so favorites stay at the top of the list.
- Existing break-notification bells remain available beside pin controls.
- More subtle GSAP polish: app entrance, settings-section stagger, theme selection, refresh feedback, pin interactions, plus the existing card/detail/timeline/toast animations.
- Mobile settings cards now stack cleanly with 44px-ish touch targets and no horizontal page overflow.
- Service-worker cache bumped to **v8**.

## Privacy model

Schedule pictures, PDFs and `schedules.json` stay on the user's device. The app stores the local schedule database in IndexedDB (with a localStorage fallback).

The hosted GitHub Pages site does **not** need a `schedules.json` file.

PDF parsing happens in the browser. PDF.js is loaded from jsDelivr only when a user adds a PDF; the selected PDF itself is not uploaded by the app.

Nicknames, pins, color theme, notification settings, and muted bells are device-specific local preferences. They are **not** included when sharing `schedules.json`.

## People personalization

Open **Settings → People** to:

- type a nickname (clear it to return to the full name),
- tap **📌** to pin or unpin someone,
- tap **🔔 / 🔕** to control only that person's break notifications.

Pinned people appear first. In **Show everyone**, pinned people are kept at the top even if one is currently in class.

## Themes

Open **Settings → Themes** to choose light/dark mode and a full color theme:

- Light or Dark mode
- Ocean
- Lavender
- Rose
- Forest
- Sunset

Theme settings are remembered locally on that device.

## Notifications

When enabled, Who's Free? looks for breaks between two classes where the gap is **more than 10 minutes**. Time before the first class and after the last class is not treated as a break.

If several unmuted people start a qualifying break in the same minute, Who's Free? sends one grouped notification.

### Current limitation

This is still a static GitHub Pages app. Break alerts are checked while the app is open/running. A static site cannot reliably wake itself later after the browser/PWA has been fully closed.

On iPhone, users should add Who's Free? to the Home Screen for the best notification support.

## Files to deploy

Upload these to the **root** of the GitHub repository:

```text
index.html
app.js
schedule-parser.js
schedule-image-parser.js
styles.css
service-worker.js
manifest.webmanifest
assets/
```

Do **not** upload `schedules.json`.

GitHub Pages:

```text
Branch: main
Folder: / (root)
```

## Updating an existing install

v12 uses versioned files and `whos-free-shell-v12`, so previous installs should update automatically after GitHub Pages redeploys.

If a device still shows an older version, close the page/Home Screen app completely and reopen it.

## GSAP

GSAP 3.13.0 is loaded from jsDelivr and is used only for small UI transitions. The app still works if GSAP fails to load. Users with **Reduce Motion** enabled do not get the motion effects.

## Sharing

The **Share schedules.json** button shares/downloads only the schedule database. Device-specific preferences such as nicknames, pins, theme, notification settings, muted bells, and notification history are not included.

## v9 changes

- The browser PDF parser now recognizes Omnivox schedules in **English or French**.
  - Weekdays such as `Monday` / `Lundi`, `Tuesday` / `Mardi`, `Wednesday` / `Mercredi`, `Thursday` / `Jeudi`, and `Friday` / `Vendredi` are normalized to the same internal weekday names.
  - Room labels accept English `Classroom` plus French forms such as `Local`, `Classe`, and `Salle de classe`.
  - Section labels accept `sec.`, `sect.`, and `section`.
  - Time text accepts both `08:15` and French-style `08 h 15`, including ranges using `à`.
- Shared `schedules.json` files now carry the Who's Free? website URL (`https://xander444.github.io/Whos-Free/`).
- On devices with the Web Share API, the share sheet includes the website link alongside the JSON file.
