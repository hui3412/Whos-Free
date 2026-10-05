# Who's Free? — Web App v8

A privacy-first static web app for comparing Marianopolis schedules.

## Fork update — October 2, 2026

### Semester labels and recognition warnings — October 5, 2026

Adds automatic, optional semester labels and compact recognition warnings while retaining the current design and automatic panel scrolling.

- **Semester labels:** New manual, picture, PDF, JSON and shared-code schedules receive an automatic Fall or Winter label, such as **Fall 2026** or **Winter 2027**. In the schedule editor, change the term/year or choose **Not set** before saving. Legacy schedules missing a semester are assigned the current semester when loaded or imported. The first assigned label is saved so it remains attached across future term changes. Explicitly cleared labels (**Not set**) stay unset. Only previous-semester labels appear on main-page cards. All labels remain visible in the schedule manager and person details. In an older schedule’s editor, **Use current semester** fills the current term and year; **Save schedule** applies the change without altering its classes. Earlier semesters appear greyed out in the people list and show **Previous semester**; their schedules remain accessible and availability calculations stay unchanged.
- **Term timing:** Suggestions switch to the next semester during the end-of-term break: Winter from December 23 through May 31, and Fall from June 1 through December 22. These defaults follow the end-of-term deadlines in the [Marianopolis 2026–27 academic calendar](https://www.marianopolis.edu/wp-content/uploads/2026/03/academic_calendar_2026-2027.pdf). The app uses those same approximate windows each year, offline; it does not fetch changing school calendars. The label can be overridden or cleared in the editor.
- **Saving and sharing:** Labels persist on the device, through Undo, and in JSON exports/imports and new share codes. Existing unlabeled share codes still work. A code containing semester labels requires this updated app or a later compatible version. The existing duplicate schedule rule is unchanged; importing a duplicate does not relabel the saved schedule.
- **Recognition uncertainty:** Picture recognition retains word confidence and flags a block if its length-weighted mean is below 70, or a word of at least three characters scores below 45. Missing confidence, unreadable text and multiple detected course codes also prompt review. These scores are OCR signals, not calibrated probabilities that a timetable is correct. Occupied times and break detection remain unchanged.
- **Reviewing flags:** A small **⚠** appears immediately before the course name in each uncertain grid block. A short note immediately above **Save schedule** gives the number of uncertain detections and asks the user to double-check the flagged blocks. There are no jump buttons or review checkboxes. Flags remain available after saving and reopening, and Undo restores their previous state. Recognition metadata is preserved in local data and JSON exports; share codes carry schedules and semester labels, not the local review markers.

The current look, existing features and automatic scrolling into newly opened panels are retained.

### Undo update — October 5, 2026

**Undo** in the main header or **Schedules** reverses the last saved schedule change. It covers picture/manual saves, edits and renames, PDF batches, JSON and share-code imports, removing a person, and removing all local schedules. Each import is one change. Undo restores affected nicknames, pins, notification mutes and group memberships without reversing unrelated preference changes.

The last **20 changes** are available for the current page session only; reloading clears the undo history, not the schedules. Canceled edits, invalid imports and imports that don't change schedules aren't recorded. Finish or cancel an open editor or code panel before undoing. Undo saves the restored schedules on this device, with a warning if browser storage is unavailable. History is never included in exports or share codes.

This fork adds on-device schedule picture recognition and an editable weekly grid.

- **Picture import:** JPG/JPEG, PNG and WebP screenshots are read locally with English/French OCR. Pictures and recognized schedule data are not sent to an OCR server or AI API.
- **Editable grid:** Detection fills a seven-day timetable. Select a busy block to correct its wording, day or times, add missing blocks, or remove incorrect ones before saving. Saved schedules can be reopened with **Edit**.
- **Manual entry:** **Enter schedule manually** opens a blank grid without running recognition. Labels, course codes, rooms and instructor names are optional.
- **Break detection:** Availability follows occupied times, so unfamiliar course names do not prevent break detection. Athlete and conflict blocks count as busy time. Gaps of 10 minutes or less are passing time, so people remain unavailable between back-to-back classes. Only longer gaps count as breaks. Overlapping busy spans do not create false breaks; unclear or merged entries remain available for correction.
- **Class and break times:** Cards show **This class ends at**, followed by the next real break’s start time. After the last class, they show when the person becomes free for the day.
- **Share codes:** **Export** lets you select schedules and copy a self-contained code for messages. **Import** opens a pasted code on the recipient’s device. Codes use compressed data and dense Unicode text to keep messages short, require no cloud storage, and compare matching names by the overlap of their weekly busy times. More than 50% overlap skips a duplicate; 50% or less imports as Name 2, Name 3, and so on. Course wording does not affect the comparison, and existing schedules stay unchanged. Imported names can be edited in the people list. Copy the complete code, including its special characters. Older export codes must be regenerated.
- **Groups:** Create or edit groups in **Schedules → Manage groups**. People can belong to several groups; pins still sort them within each group. **Show groups** displays group sections with the next shared break longer than 10 minutes. The compact **All/Free** button comes before the group icon on the same line. Group visibility checkboxes appear on the main page only while groups are shown; a group’s eye icon can also hide it. **Hide groups** restores the usual list and keeps group membership saved. The **…** button opens a weekly availability grid from **8:15 AM to 8:05 PM**, matching the supplied school timetable. Weekend columns appear when group members have weekend classes. Darker blocks mean more people are free. Transitions of 10 minutes or less are absorbed into the neighboring block with the most people free; ties extend the previous block. Select a block for exact time intervals and the available and busy names. Shared-break suggestions continue to use the original times. Groups and visibility preferences stay on this device.
- **Schedules layout:** Picture/manual entry, share codes and the people list come before the PDF and JSON import sections.
- **Weekend support:** Saturday and Sunday entries affect availability and next-class details.

### Using a schedule picture

Crop as tightly as possible around the full timetable. Keep all grid borders, the times on the left and the day headings at the top, including any weekend columns. Remove extra space without cutting off schedule content, and keep the picture upright.

Recognition can make mistakes. Compare the detected busy times with the picture before selecting **Save schedule**. If a PDF contains only an image, use the picture importer instead.

### Running this fork

Deploy the updated app files at the repository root, including `schedule-image-parser.js`, `schedule-availability.js`, `schedule-groups.js`, `schedule-share-code.js` and the complete `assets/ocr/` folder. Use HTTPS hosting such as GitHub Pages, or `http://localhost` for computer testing; opening `index.html` directly from Files may block recognition.

The first import loads bundled recognition files from the website. Later imports can work offline on supported browsers after those files have been cached and browser storage is retained. This pending local update uses the `whos-free-shell-v25` cache; the original deployment and version notes below describe the earlier app.

Three supplied schedules were checked. Automated tests cover short passing gaps, longer breaks and chains of back-to-back classes. Tests cover detection, corrections, manual entry, validation, cancellation and offline caching. The fork has also been reported working on an iPhone.

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

Schedule PDFs and `schedules.json` stay on the user's device. The app stores the local schedule database in IndexedDB (with a localStorage fallback).

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

v8 uses versioned files and `whos-free-shell-v8`, so previous installs should update automatically after GitHub Pages redeploys.

If a device still shows an older version, close the page/Home Screen app completely and reopen it.

## GSAP

GSAP 3.13.0 is loaded from jsDelivr and is used only for small UI transitions. The app still works if GSAP fails to load. Users with **Reduce Motion** enabled do not get the motion effects.

## Sharing

The **Share schedules.json** button shares/downloads only the schedule database. Device-specific preferences such as nicknames, pins, theme, notification settings, muted bells, and notification history are not included.

## v9 changes

- The browser PDF parser now recognizes Marianopolis Omnivox schedules in **English or French**.
  - Weekdays such as `Monday` / `Lundi`, `Tuesday` / `Mardi`, `Wednesday` / `Mercredi`, `Thursday` / `Jeudi`, and `Friday` / `Vendredi` are normalized to the same internal weekday names.
  - Room labels accept English `Classroom` plus French forms such as `Local`, `Classe`, and `Salle de classe`.
  - Section labels accept `sec.`, `sect.`, and `section`.
  - Time text accepts both `08:15` and French-style `08 h 15`, including ranges using `à`.
- Shared `schedules.json` files now carry the Who's Free? website URL (`https://xander444.github.io/Whos-Free/`).
- On devices with the Web Share API, the share sheet includes the website link alongside the JSON file.
