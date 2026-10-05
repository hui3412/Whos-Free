(() => {
  // A gap of ten minutes or less is passing time, not time to meet up.
  const PASSING_MINUTES = 10;
  const minutes = time => {
    if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) return NaN;
    const [hour, minute] = time.split(":").map(Number);
    return hour < 24 && minute < 60 ? hour * 60 + minute : NaN;
  };
  function busyPeriods(classes) {
    // Parse once per class rather than again on every sort comparison.
    const sorted = classes.map(item => ({ item, start: minutes(item.start), end: minutes(item.end) }))
      .filter(({ start, end }) => Number.isFinite(start) && end > start)
      .sort((a, b) => a.start - b.start);
    const periods = [];
    for (const { item, start, end } of sorted) {
      const previous = periods[periods.length - 1];
      if (previous && start - previous.end <= PASSING_MINUTES) {
        if (end > previous.end) { previous.end = end; previous.last = item; }
      } else periods.push({ start, end, first: item, last: item });
    }
    return periods;
  }
  function realBreaks(classes) {
    const periods = busyPeriods(classes);
    return periods.slice(0, -1).map((period, index) => ({
      start: period.end, end: periods[index + 1].start,
      duration: periods[index + 1].start - period.end,
      afterClass: period.last, beforeClass: periods[index + 1].first,
    }));
  }
  function isFree(classes, minute) {
    return !busyPeriods(classes).some(period => period.start <= minute && minute < period.end);
  }
  function nextFreePeriod(classes, minute) {
    const periods = busyPeriods(classes);
    const index = periods.findIndex(period => period.end > minute);
    if (index < 0) return null;
    const next = periods[index + 1];
    return { start: periods[index].end, end: next ? next.start : null, afterClasses: !next };
  }
  globalThis.WhosFreeAvailability = { PASSING_MINUTES, busyPeriods, realBreaks, isFree, nextFreePeriod };
})();
