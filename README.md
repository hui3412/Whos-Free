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
- **Sharing:** PDF/JSON imports, JSON backups and self-contained codes with exact duplicate checks and a choice for conflicting schedules.
- **Semester labels:** Identify older timetables and update their term without changing classes.

These three milestones group the completed work chronologically; their labels are separate from the app's package and cache versions.

### Version 12.1 — Image recognition and timetable editing

October 2, 2026

- Added on-device English/French OCR for JPG/JPEG, PNG and WebP timetable pictures, without sending pictures to an OCR server or AI API.
- Added a seven-day review grid, manual schedule creation and editing of saved timetables.
- Allowed class blocks to be added, corrected or removed, with course details optional and canceled edits leaving saved data unchanged.
- Improved faint-border and time-column detection, wrapped room/instructor text and common room-label OCR errors.
- Preserved unfamiliar, unreadable and merged entries as editable busy spans, including athlete/conflict blocks and weekend classes.
- Showed breaks in the review grid, merged overlapping busy periods and excluded passing gaps of **10 minutes or less** from free time.
- Added next-real-break times to person cards.
- Bundled and cached OCR files for later offline use on supported browsers.

Use an upright picture cropped around the full timetable, retaining borders, times and headings. Review recognized times before saving; image-only PDFs should use the picture importer. Deploy the root app files and complete `assets/ocr/` folder over HTTPS or `http://localhost`. Offline recognition requires cached OCR files and retained browser storage.

### Version 12.2 — Sharing, groups and schedule Undo

October 2–5, 2026, before the visual overhaul

- Added selected-schedule sharing and pasted-code import, then shortened codes with compact times, compression and dense Unicode encoding.
- Initially compared same-name imports by weekly busy-time overlap; Version 12.3 replaces this rule with exact checks and explicit conflict choices.
- Added overlapping groups, live free counts, shared-break suggestions and weekly availability.
- Added an **8:15 AM–8:05 PM** group grid, weekend columns when needed, darker blocks for more free people and exact names/times on selection.
- Smoothed short group-grid transitions without changing the original intervals used for shared-break suggestions.
- Added **Undo** for saves, edits, renames, imports and removals, restoring affected preferences and memberships.
- Retained **20 changes per page session**, excluding canceled, invalid and unchanged operations.
- Optimized availability calculations, duplicate comparisons and group-calendar processing.
- Added fork-improvement credit beside the original creator.

Copy complete share codes, including special characters. Earlier alphanumeric codes must be regenerated. Reloading clears Undo history, not saved schedules; finish or cancel an editor or code panel before undoing.

### Version 12.3 — Cleaner interface and saved personalization

October 5, 2026, from the visual overhaul onward

- Replaced outlined containers with clean filled backgrounds while retaining the layout, Settings, themes, notifications and personalization.
- Automatically revealed newly opened editors, picture reviews, import/export panels and group details, respecting reduced-motion preferences.
- Placed weekday and time fields side by side without visible labels and matched their heights, including on iPhone.
- Allowed edits during live mode to switch to a manual preview; **Use current time** restores live updates.
- Moved **Use current time** beside All/Free and Groups, removed Refresh, combined the class/free counts and saved the All/Free selection across reloads.
- Added automatic and editable Fall/Winter labels to new and previously unlabeled schedules.
- Showed only older semesters on main cards, greyed them out and added **Use current semester** without changing class times.
- Added compact recognition warnings that survive saving, reopening and Undo.
- Added **Replace**, **Keep both** and **Cancel** for same-name picture uploads, ignoring case and repeated spaces.
- Changed code imports to automatically add different names and skip only identical names and timetables; other same-name schedules offer **Keep both**, **Replace** or **Keep old one**.
- Made code-import choices apply separately to each conflict, with one Undo for the completed batch and no save until all choices are finished.
- Added mouse dragging, touch hold-and-drag and **Alt + Up/Down** person reordering, with independent saved orders for the main list, each group and Ungrouped.
- Preserved hidden people and positions across filters, reloads and renames; kept pinned people above unpinned people while allowing moves within either section.
- Removed drag grips and kept ordinary phone swipes from starting accidental reorders.
- Replaced the group checkbox checklist with **Hide/Show**, retaining collapsed headers, counts and menus.
- Added **Send group to top**, saved group order/collapse states and fixed clipped menus when every group is collapsed.
- Extended Undo to person/group order changes without changing schedules, other orders or collapse states.
- Reorganized Schedules, added the Omnivox optimization note, replaced school-specific wording and improved the fork documentation.
- Updated app caches while retaining OCR assets and added warnings when reordered positions cannot be saved.

Semester defaults use fixed approximate windows: Winter **December 23–May 31**, Fall **June 1–December 22**; labels can be changed or cleared. JSON and new share codes preserve semester labels; semester-aware codes require an updated app. JSON also retains OCR warnings, but share codes omit review markers. Groups, person orders and Undo history remain local and are not exported.

Code-import names are matched without case or repeated spaces. Exact timetable checks compare class days, times, course details and semester labels, ignoring class order, source files and local OCR warnings. **Keep both** adds the next unused numbered name, such as David 2; **Replace** retains the original name and local preferences; **Keep old one** leaves that schedule unchanged. Escape selects **Keep old one** for the current conflict.

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
- Replaced the old share-code overlap rule with exact name-and-timetable duplicate checks.
- Added Keep both, Replace and Keep old one for differing same-name code imports.
- Made Keep both use the next unused numbered name without overwriting other imported names.
- Saved code-import batches only after every conflict choice and made replacements undoable.
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
