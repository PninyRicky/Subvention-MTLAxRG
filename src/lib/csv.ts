type CsvRow = string[];

function detectDelimiter(sample: string) {
  const commas = (sample.match(/,/g) ?? []).length;
  const semicolons = (sample.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(text: string) {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(cell);
      cell = "";

      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    cell += character;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);

    if (row.some((value) => value.trim().length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

export function parseCsvRecords(text: string) {
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return [] as Record<string, string>[];
  }

  const [headers, ...body] = rows;

  return body.map((row) => {
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header.trim()] = row[index]?.trim() ?? "";
    });

    return record;
  });
}
