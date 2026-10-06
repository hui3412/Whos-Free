# Who's Free? — Web App v8

A privacy-first static web app for comparing Omnivox schedules.

Import compatible Omnivox timetable PDFs or screenshots from your school, or enter schedules manually. PDF recognition depends on the timetable format; always review imported times before saving.

## Fork updates — last updated October 5, 2026

Fork improvements by **Hui En Qian**. Open the [live fork](https://hui3412.github.io/Whos-Free/).

### Summary

- **Cleaner design:** Subtle filled backgrounds, compact mobile controls and automatic scrolling to newly opened panels.
- **Image recognition:** On-device English/French OCR for timetable screenshots, with warnings for uncertain detections.
- **Timetable editor:** Create schedules manually or correct imported and saved schedules in a seven-day grid.
- **Availability:** Check now or preview another time, including weekends, with real breaks and next-class details.
- **Groups:** Overlapping memberships, live free counts, shared-break suggestions and weekly availability.
- **Saved ordering:** Independent person orders for each list, pinned people first, and **Send group to top**.
- **Undo:** Reverse schedule and order changes during the current page session.
- **Sharing:** PDF/JSON imports, JSON backups, self-contained share codes and duplicate handling.
- **Semester labels:** Identify older timetables and update their term without changing classes.

### Import and edit schedules

Import JPG/JPEG, PNG or WebP pictures, or choose **Enter schedule manually**. Select grid blocks to edit their text, day or times; add missing classes or remove incorrect blocks. Course names, codes, rooms and instructors are optional. Reopen saved timetables with **Edit**.

Crop pictures around the full, upright timetable, keeping grid borders, times and day headings. Review detected times before saving, especially blocks marked **⚠**. Recognition can make mistakes. For image-only PDFs, use the picture importer.

Same-name picture uploads offer **Replace**, **Keep both** or **Cancel**. Matching ignores case and repeated spaces. Replace keeps existing preferences; Keep both adds a numbered name.

### Availability and groups

Editing the weekday or time switches to a manual preview. **Use current time** restores live updates; **All/Free** remembers your selection after reloads. Gaps of **10 minutes or less** count as passing time, not breaks. Availability depends on occupied times, including athlete/conflict blocks, not course wording.

Manage groups in **Schedules → Manage groups**. People can belong to several groups. **Hide/Show** collapses members while retaining the name, free count and **…** menu. The combined status counts people in expanded groups once, even with overlapping memberships.

The **…** menu offers **Send group to top** and **Weekly availability**. Group order and collapse states persist locally. The weekly grid covers **8:15 AM–8:05 PM**, adds weekend columns when needed, and uses darker blocks for more free people. Select a block for exact times and names. Short transitions are merged for display; shared-break suggestions use the original times.

### Reordering and Undo

Drag cards with a mouse, hold briefly before dragging on phones, or use **Alt + Up/Down** on a focused card. Ordinary swipes still scroll. The main list, each group and Ungrouped save separate orders across filters and reloads, without losing hidden people. Pinned people always stay first; reorder within the pinned or unpinned section. Groups use **Send group to top**, not dragging.

**Undo** reverses saves, edits, renames, imports, removals and order changes. It retains **20 changes per page session**; reloading clears history, not saved data. Finish or cancel an editor or code panel before undoing. Order Undo affects only that order; schedule Undo restores affected preferences and memberships without reversing unrelated changes.

### Semester labels

New and previously unlabeled schedules receive an automatic Fall/Winter label. Change it in the editor or choose **Not set**. Only older semesters appear on main-page cards, greyed out; all labels remain visible in schedule details. **Use current semester**, then **Save schedule**, updates an older label without altering classes.

Defaults use Winter from December 23–May 31 and Fall from June 1–December 22. These are fixed, approximate yearly windows, not a live school-calendar lookup. Labels persist locally, through Undo, and in JSON and new share codes.

### Sharing and privacy

Export selected schedules as JSON or a self-contained share code; paste codes into **Import**. Copy the complete code, including special characters. For matching names, **more than 50% overlap** in weekly busy times skips a duplicate; otherwise it imports under a numbered name. Existing schedules remain unchanged.

Earlier alphanumeric codes must be regenerated. Unlabeled Unicode codes still work; semester-aware codes require an updated app.

Picture OCR runs locally, without an OCR server or AI API. Orders, groups and Undo history are not exported. JSON retains recognition warnings; share codes retain schedules and semester labels, not review markers. Browser-storage failures show a warning when changes cannot be saved.

### Running the fork

Deploy the root app files and complete `assets/ocr/` folder over HTTPS or `http://localhost`; opening `index.html` directly may block recognition. OCR files load on first use and can work offline afterward on supported browsers while cached files and storage remain available.

### Improvement checklist

- Replaced outlined containers with cleaner filled backgrounds throughout the app.
- Kept the existing layout, Settings, themes, notifications and personalization features.
- Made the main weekday and time controls compact and placed them on the same row.
- Removed the visible weekday and time field labels.
- Made the time box the same height as the weekday box, including on iPhone.
- Allowed weekday and time edits while live mode is active, automatically switching to a manual preview.
- Made Use current time restore the actual weekday and time and continue updating.
- Moved Use current time beside the All/Free and Groups controls.
- Removed the separate Refresh button.
- Combined the in-class and free/total counts below the view controls.
- Kept the selected All/Free view after page reloads.
- Added local timetable-picture import for JPG/JPEG, PNG and WebP.
- Added on-device English/French OCR without uploading pictures to an OCR server or AI API.
- Bundled OCR files and cached them for later offline use on supported browsers.
- Added an editable seven-day timetable review grid.
- Added manual schedule creation without running OCR.
- Allowed saved timetables to be reopened and edited.
- Allowed class blocks to be added, corrected or removed before saving.
- Made course labels, codes, rooms and instructors optional for manual entries.
- Kept the saved timetable unchanged when an edit is canceled.
- Preserved occupied times even when course text is unfamiliar or unreadable.
- Improved recognition of faint JPEG grid borders and narrow time labels.
- Preserved numeric and wrapped room labels and wrapped instructor names.
- Corrected common OCR confusion between I, 1 and | after explicit room labels.
- Retained athlete and conflict blocks as occupied time.
- Kept merged course detections as editable busy spans rather than discarding them.
- Added Saturday and Sunday support to recognition, editing and availability.
- Showed breaks between classes in the review grid.
- Merged overlapping busy spans to prevent false breaks.
- Excluded gaps of 10 minutes or less from free-time breaks.
- Showed the next real break time on person cards.
- Added groups with overlapping memberships.
- Added group free counts and next shared-break suggestions.
- Added a weekly group-availability grid with darker blocks for more free people.
- Showed exact free and busy names when selecting a group-availability block.
- Limited the group grid to 8:15 AM–8:05 PM and included weekends when needed.
- Smoothed short group-grid transitions while preserving exact intervals for inspection.
- Removed the group visibility checklist.
- Made Hide collapse group members without removing the group's header.
- Kept each collapsed group's name, free count, Show button and three-dot menu visible.
- Added collapse and expand controls for Ungrouped people.
- Saved group collapse states across reloads.
- Added Send group to top without adding group drag-and-drop.
- Saved group order across reloads.
- Counted overlapping group members only once in the combined availability status.
- Fixed three-dot menus being clipped when all groups are collapsed.
- Added drag-and-drop person reordering on computers.
- Added hold-and-drag person reordering on touch screens.
- Removed the six-dot drag grips.
- Kept ordinary phone swipes and short taps from starting a reorder.
- Added Alt + Up/Down keyboard reordering.
- Saved separate person orders for the main list, each group and Ungrouped.
- Preserved person order across All/Free filters and page reloads.
- Kept filtered-out people in the saved order when moving visible people.
- Preserved saved positions when people are renamed.
- Kept pinned people above unpinned people even in manually reordered lists.
- Allowed pinned people to be reordered among themselves.
- Blocked moves across the pinned/unpinned boundary with an explanatory message.
- Added Undo for schedule saves, edits and renames.
- Added Undo for PDF batches, JSON imports and share-code imports.
- Added Undo for removing one person or all local schedules.
- Added Undo for person reordering and Send group to top.
- Kept up to 20 Undo entries during the current page session.
- Restored affected preferences and group memberships when undoing schedule changes.
- Kept order Undo separate from schedules, other lists and group collapse states.
- Excluded canceled, invalid and unchanged operations from Undo history.
- Added selected-schedule export and pasted-code import.
- Shortened share codes with compact times, compression and dense Unicode encoding.
- Compared same-name shared schedules by weekly busy-time overlap rather than course wording.
- Skipped same-name imports with more than 50% overlap and numbered distinct schedules.
- Reported renamed imported schedules so their names can be corrected.
- Added Replace, Keep both and Cancel for same-name picture uploads.
- Made picture-name matching ignore letter case and repeated spaces.
- Added automatic Fall/Winter semester labels to new schedules.
- Assigned semester labels to previously unlabeled saved and imported schedules.
- Allowed semester labels to be changed or cleared in the editor.
- Showed semester labels on main cards only for older timetables.
- Greyed out older-semester schedules while keeping their details accessible.
- Added Use current semester to update an older timetable's label without changing classes.
- Preserved semester labels through saving, Undo, JSON and new share codes.
- Added compact warning markers for uncertain picture recognition.
- Retained recognition warnings after saving, reopening and Undo.
- Included recognition metadata in JSON while keeping local review markers out of share codes.
- Automatically revealed newly opened manual editors and completed picture reviews.
- Automatically revealed saved-schedule editors, block editors, import/export panels and group details.
- Respected reduced-motion preferences when scrolling to newly opened content.
- Reorganized Schedules so picture/manual entry and sharing appear before PDF/JSON imports.
- Optimized availability calculations, duplicate comparisons and group-calendar processing.
- Updated service-worker caches to deliver app changes while retaining cached OCR assets.
- Warned when reordered positions could not be saved on the device.
- Added fork-improvement credit alongside the original creator.
- Added the Omnivox optimization sentence to the header description.
- Replaced school-specific wording with school-neutral Omnivox wording.
- Added a feature summary and shortened the fork's README usage notes.
- Expanded automated regression coverage for recognition, editing, groups, ordering, Undo and offline caching.

The original version and deployment notes follow below.

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

- The browser PDF parser now recognizes Omnivox schedules in **English or French**.
  - Weekdays such as `Monday` / `Lundi`, `Tuesday` / `Mardi`, `Wednesday` / `Mercredi`, `Thursday` / `Jeudi`, and `Friday` / `Vendredi` are normalized to the same internal weekday names.
  - Room labels accept English `Classroom` plus French forms such as `Local`, `Classe`, and `Salle de classe`.
  - Section labels accept `sec.`, `sect.`, and `section`.
  - Time text accepts both `08:15` and French-style `08 h 15`, including ranges using `à`.
- Shared `schedules.json` files now carry the Who's Free? website URL (`https://xander444.github.io/Whos-Free/`).
- On devices with the Web Share API, the share sheet includes the website link alongside the JSON file.
