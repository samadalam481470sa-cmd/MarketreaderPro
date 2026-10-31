import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
import importlib.util
SPEC=importlib.util.spec_from_file_location('house_parser',str(Path(__file__).resolve().parents[1]/'scripts'/'parse-house-index.py'))
PARSER=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARSER)

class HouseIndexTests(unittest.TestCase):
 def test_parse_index(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'2026.zip'
   with zipfile.ZipFile(path,'w') as f:
    f.writestr('2026FD.txt','DocID\tFilingType\tFirstName\tLastName\tFilingDate\n10001\tP\tAda\tExample\t10/30/2026\n')
   rows=list(PARSER.parse_house_archive(path,2026))
   self.assertEqual(len(rows),1)
   self.assertEqual(rows[0]['filerName'],'Ada Example')
   self.assertIn('ptr-pdfs',rows[0]['documentUrl'])
 def test_reject_bad_zip_index(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'bad.zip'
   with zipfile.ZipFile(path,'w') as f:f.writestr('x.txt','Bad\nhi')
   with self.assertRaises(ValueError):list(PARSER.parse_house_archive(path,2026))
if __name__=='__main__':unittest.main()
