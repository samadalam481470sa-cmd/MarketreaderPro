"""Offline House yearly bulk ZIP index parser; does NOT extract PDF trades.

Input must be an operator-downloaded official annual House ZIP. This tool does
not access the House website or defeat access controls. Use requires legal review,
especially for commercial products. Only public filing metadata is emitted.
"""
import argparse
import csv
import io
import json
import re
import zipfile
from pathlib import Path

def parse_house_archive(path, year):
    if not (2008 <= year <= 2100):
        raise ValueError("Invalid filing year")
    if Path(path).stat().st_size > 60_000_000:
        raise ValueError("ZIP exceeds 60 MB")
    with zipfile.ZipFile(path) as archive:
        candidates=[n for n in archive.namelist() if re.fullmatch(r"[^/\\]+(?:FD)?\.txt", n, re.I)]
        if len(candidates)!=1:
            raise ValueError("Expected one annual FD tab-delimited index in archive")
        meta=archive.getinfo(candidates[0])
        if meta.file_size>12_000_000:
            raise ValueError("Decompressed index too large")
        data=archive.read(meta).decode('utf-8-sig',errors='replace')
    reader=csv.DictReader(io.StringIO(data),delimiter='\t')
    keys={k.casefold().strip():k for k in reader.fieldnames or [] if k}
    for required in ('docid','filingtype'):
        if required not in keys:raise ValueError('Unsupported House index format')
    for row in reader:
        doc=(row.get(keys['docid']) or '').strip()
        if not re.fullmatch(r'\d{4,12}',doc):continue
        t=(row.get(keys['filingtype']) or '').strip()
        if t.upper() not in ('P','PTR','A','F','C'):continue
        name=' '.join((row.get(keys.get(k,'')) or '').strip() for k in ('firstname','lastname')).strip()
        file_date=(row.get(keys.get('filingdate','')) or '').strip()
        # House index year and filing document ID are public record metadata,
        # but PDF contents have not been transaction-verified.
        url=f'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{doc}.pdf' if t.upper() in ('P','PTR') else f'https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}/{doc}.pdf'
        yield {'source':'house','sourceId':str(year)+':'+doc,
               'filerName':name[:250],'documentType':t[:15],
               'filedDate':file_date if re.fullmatch(r'\d{1,2}/\d{1,2}/\d{4}',file_date) else None,
               'sourceYear':year,'documentUrl':url}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('archive',help='Path to downloaded official House annual ZIP')
    parser.add_argument('--year',type=int,required=True)
    args=parser.parse_args()
    for entry in parse_house_archive(args.archive,args.year):
        print(json.dumps(entry,separators=(',',':')))
if __name__=='__main__':main()
