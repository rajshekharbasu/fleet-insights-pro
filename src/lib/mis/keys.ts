export function tripKey(scheduleCode: string, tripNumber: number | string): string {
  return `${scheduleCode}::${tripNumber}`;
}

export function scheduleKey(scheduleCode: string, shift: string): string {
  return `${scheduleCode}::${shift}`;
}

export function parseTripKey(key: string): { scheduleCode: string; tripNumber: string } {
  const i = key.indexOf("::");
  return {
    scheduleCode: key.slice(0, i),
    tripNumber: key.slice(i + 2),
  };
}

/** Virtual extra trip numbers per schedule */
export function extraTripNumber(index: number): number {
  return 9000 + index;
}
