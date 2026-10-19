export function uppercaseDisplay(value: string): string {
  return value.replace(/\S+/g, word =>
    /^(?:https?:\/\/|mailto:|www\.)|@|^(?:[0-9a-f]{24}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.test(word) ? word : word.toUpperCase());
}
