/**
 * RFC 4180-compatible small CSV parser, client-side only.
 * No data is uploaded until the user explicitly runs the simulation.
 */
export function parseCsvRows(input) {
  if (typeof input !== 'string' || input.length > 160000) throw Error('CSV must be a text file under 160 KB');
  const text = input.replace(/^\uFEFF/, '');
  const rows = [];
  let field = '', row = [], quote = false, closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quote = false; closedQuote = true; }
      else field += c;
      continue;
    }
    if (c === '"' && !field && !closedQuote) { quote = true; continue; }
    if (c === ',') { row.push(field); field = ''; closedQuote = false; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = []; field = ''; closedQuote = false;
      continue;
    }
    if (closedQuote && c !== ' ' && c !== '\t') throw Error('Unexpected characters after CSV quote');
    if (c === '"' && field) throw Error('Malformed quote in CSV field');
    field += c;
  }
  if (quote) throw Error('Unclosed quote in CSV');
  row.push(field);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  if (rows.length < 2) throw Error('CSV must include a header and at least one historical bar');
  if (rows.length > 701) throw Error('Maximum 700 price bars');
  return rows;
}
export function parseOhlcvCsv(text) {
  const [headers, ...records] = parseCsvRows(text);
  const names = headers.map(s => s.trim().toLowerCase().replace(/\s+/g,''));
  const idx = key => names.indexOf(key);
  const dateCol = idx('date') >= 0 ? idx('date') : idx('time');
  const required = [dateCol, idx('open'), idx('high'), idx('low'), idx('close')];
  if (required.some(x => x < 0)) throw Error('CSV needs date, open, high, low and close columns');
  if (new Set(required).size !== required.length) throw Error('Duplicate required CSV headers');
  const num = (value, name, line) => {
    if (!value?.trim()) throw Error('Missing '+name+' on row '+line);
    const valueNumber=Number(value.trim());
    if (!Number.isFinite(valueNumber)) throw Error('Invalid '+name+' on row '+line);
    return valueNumber;
  };
  return records.map((record, index) => {
    if (record.length !== names.length) throw Error('Row '+(index+2)+' has '+record.length+' columns, expected '+names.length);
    const line=index+2;
    return {
      date:record[dateCol]?.trim(),
      open:num(record[idx('open')],'open',line),
      high:num(record[idx('high')],'high',line),
      low:num(record[idx('low')],'low',line),
      close:num(record[idx('close')],'close',line),
      volume:idx('volume')>=0 && record[idx('volume')]?.trim()
        ? num(record[idx('volume')],'volume',line) : null
    };
  });
}
