(() => {
  "use strict";
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  // The complete time axis on the supplied Omnivox timetables, not a 24-hour day.
  const SCHOOL_START = 8 * 60 + 15;
  const SCHOOL_END = 20 * 60 + 5;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const membersOf = (group, people) => [...new Set(group.members || [])].filter(name => own(people, name));

  function week(group, people) {
    const members = membersOf(group, people);
    const classes = new Map(members.map(name => [name, Array.isArray(people[name].classes) ? people[name].classes : []]));
    const days = DAYS.filter((day, i) => i < 5 || members.some(name => classes.get(name).some(item => item.day === day)));
    const availability = Object.create(null);
    for (const day of days) {
      const events = new Map([[SCHOOL_START, []], [SCHOOL_END, []]]);
      const addEvent = (minute, name, busy) => {
        if (!events.has(minute)) events.set(minute, []);
        events.get(minute).push({ name, busy });
      };
      for (const name of members) {
        const periods = WhosFreeAvailability.busyPeriods(classes.get(name).filter(item => item.day === day));
        for (const period of periods) {
          const start = Math.max(SCHOOL_START, period.start), end = Math.min(SCHOOL_END, period.end);
          if (end <= start) continue;
          addEvent(start, name, true); addEvent(end, name, false);
        }
      }
      const times = [...events.keys()].sort((a, b) => a - b), busy = new Set(), segments = [];
      for (let i = 0; i < times.length - 1; i++) {
        const start = times[i], end = times[i + 1];
        for (const event of events.get(start)) {
          if (event.busy) busy.add(event.name); else busy.delete(event.name);
        }
        const available = members.filter(name => !busy.has(name));
        const unavailable = members.filter(name => busy.has(name));
        const previous = segments[segments.length - 1];
        if (previous && available.length === previous.available.length && available.every((name, index) => name === previous.available[index])) previous.end = end;
        else segments.push({ start, end, available, unavailable });
      }
      availability[day] = segments;
    }
    return { members, days, start: SCHOOL_START, end: SCHOOL_END, availability };
  }

  function nextShared(weekly, day, minute) {
    if (!weekly.members.length || !DAYS.includes(day) || !Number.isFinite(minute)) return null;
    const index = DAYS.indexOf(day);
    for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
      const candidate = DAYS[(index + daysAhead) % 7];
      for (const segment of weekly.availability[candidate] || []) {
        if (segment.unavailable.length) continue;
        const start = Math.max(segment.start, daysAhead === 0 ? minute : weekly.start);
        // A useful shared break must have more than ten minutes remaining.
        if (segment.end - start <= WhosFreeAvailability.PASSING_MINUTES) continue;
        return { day: candidate, start, end: segment.end, daysAhead, now: daysAhead === 0 && start === minute };
      }
    }
    return null;
  }

  function shade(count, total) {
    const fraction = total ? Math.min(1, Math.max(0, count / total)) : 0;
    const light = [240, 246, 255], dark = [28, 65, 123];
    const rgb = light.map((value, i) => Math.round(value + (dark[i] - value) * fraction));
    const channels = rgb.map(value => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return { background: `rgb(${rgb.join(", ")})`, color: luminance > 0.179 ? "#000" : "#fff" };
  }
  globalThis.WhosFreeGroups = { SCHOOL_START, SCHOOL_END, membersOf, week, nextShared, shade };
})();
