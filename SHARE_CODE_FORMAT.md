# Share-code compatibility

New exports use WF3. Import supports WF1, WF2 and WF3. Do not remove an older
decoder when introducing a later version. New versions require an updated app
on the receiving device. No version requires a server lookup or fixed dictionary.

## Envelope

WF3 uses `WF3` followed by one mode character and the existing base-14-bit text
encoding. Text characters are BMP CJK U+4E00 through U+8DFF. The first digit of
the encoded text stores padding in two-bit units. Its decoded bytes start with
the little-endian CRC32 of the remaining bytes, followed by those payload bytes.
CRC32 is for accidental damage detection, not authentication or encryption.

| Mode | Payload | Compression |
| --- | --- | --- |
| J | WF2 compact JSON | None |
| D | WF2 compact JSON | Raw DEFLATE |
| Z | WF2 compact JSON | Zlib-wrapped DEFLATE |
| B | Binary | None |
| R | Binary | Raw DEFLATE |
| S | Binary | Zlib-wrapped DEFLATE |

The encoder tries all three binary layouts and compact JSON. Each candidate is
also compressed when the browser supports it. The smallest byte payload wins.
This guarantees no longer character code than the current WF2 encoder for the
same accepted selection and browser compression support. Unicode encoding,
checksum and prefix overhead have the same lengths in WF2 and WF3.

## Binary payload

Integers use unsigned little-endian base-128 varints with continuation bit 7.
Overlong varints are rejected. Strings are a byte-count varint followed by UTF-8.
Strings preserve leading BOM characters; lone UTF-16 surrogates use JSON instead
of replacement characters. Labels, names and metadata are never normalized by
the binary serializer.

The first byte is `layout | (timeUnitIndex << 2)`. Layouts are 0 (literal labels),
1 (shared labels) and 2 (recurring patterns). Units are `[1, 5, 15, 30, 60]`
minutes. The chosen unit divides every class start and duration.

Layouts 1 and 2 first store a label-table count, then that many strings. Layout 2
then stores a pattern-table count, followed by patterns. Each pattern stores its
start and duration in time units, then its labels and busy-block flag. A pattern
is shared only when start, duration, all five labels and kind match exactly.

All layouts then store the person count and, for each person, the name, semester
integer, class count and class records. Semester integers are 0 (missing), 1
(explicitly not set), or `2 + (year - 2000) * 2 + term`, where term is 0 for Winter
and 1 for Fall. Class order and person order are retained.

Layouts 0 and 1 store each record as:

1. A varint `zigzag(startDelta) * 8 + weekday`. Weekdays are Monday=0 through
   Sunday=6. Each day's previous start begins at 08:00 for each person, then is
   updated after each record. Deltas are in the chosen time unit. Zigzag maps
   nonnegative n to 2n and negative n to -2n-1.
2. The duration as a varint in the chosen time unit.
3. A one-byte field mask: bits 0–4 indicate course, course code, section, room
   and instructor, in that order; bit 5 indicates a busy block. Other bits are
   rejected. Present labels follow in field order as strings in layout 0 or
   zero-based table-index varints in layouts 1 and 2.

Layout 2 class records are varints `patternIndex * 8 + weekday`.

## Limits and older versions

Limits remain 250 people, 500 classes per person, 10,000 classes overall,
200 UTF-16 units per name or label, and 1 MiB per raw or decompressed payload.
Binary parsing also bounds tables, indices, string byte counts, varints and
allocations. Invalid times, invalid flags, truncation and trailing bytes are
rejected before schedules are returned. Person-name uniqueness uses the existing
normalized comparison; exported names and labels themselves stay unchanged.

WF2 modes J/D/Z use the same Unicode envelope and a compact JSON payload.
WF1 modes J/G use the original base32 alphabet, an eight-hex-digit CRC32 before
the body, and full JSON with optional gzip. WF1 is case-insensitive. Its frozen
compatibility fixtures were generated using the original WF1 and WF2 encoders.

Shared fields remain name, optional semester, weekday, exact start/end times,
course, course code, section, room, instructor and kind. Local nicknames, groups,
Undo history, source paths and OCR review markers are not shared.
