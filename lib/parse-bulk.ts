// Parses the same format as register_to_remindo/main.py:
// - Each non-blank line goes into either the current front or back buffer.
// - A blank line commits the current buffer and toggles between front/back.
// - Multi-line fronts/backs are preserved (joined with \n).
// - Any unpaired trailing buffer is committed at EOF; pairs of unequal length
//   are zipped down to the shorter side (just like Python's zip()).

export type ParsedCard = { front: string; back: string };

export function parseBulkInput(text: string): ParsedCard[] {
  const lines = text.split(/\r?\n/);
  const fronts: string[] = [];
  const backs: string[] = [];
  let currentFront: string[] = [];
  let currentBack: string[] = [];
  let isFront = true;

  for (const line of lines) {
    if (line.trim() === "") {
      if (isFront && currentFront.length > 0) {
        fronts.push(currentFront.join("\n"));
        currentFront = [];
        isFront = false;
      } else if (!isFront && currentBack.length > 0) {
        backs.push(currentBack.join("\n"));
        currentBack = [];
        isFront = true;
      }
    } else {
      if (isFront) {
        currentFront.push(line);
      } else {
        currentBack.push(line);
      }
    }
  }

  if (currentFront.length > 0) fronts.push(currentFront.join("\n"));
  if (currentBack.length > 0) backs.push(currentBack.join("\n"));

  const pairs: ParsedCard[] = [];
  const n = Math.min(fronts.length, backs.length);
  for (let i = 0; i < n; i++) {
    pairs.push({ front: fronts[i], back: backs[i] });
  }
  return pairs;
}
