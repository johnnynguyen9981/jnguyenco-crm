"""
Extracts form field values from JNguyen Co enquiry form PDFs.
Usage: python extract_enquiry.py <path_to_pdf>
Outputs JSON to stdout.
"""
import sys
import json
from pypdf import PdfReader

def extract(path):
    reader = PdfReader(path)
    fields = reader.get_fields() or {}
    data = {}
    for k, v in fields.items():
        raw = v.get('/V', '')
        if isinstance(raw, bytes):
            raw = raw.decode('utf-8', errors='ignore')
        else:
            raw = str(raw)
        # checkbox values come as '/Yes' or '/Off'
        if raw.startswith('/'):
            raw = raw[1:]  # strip leading slash
        data[k] = raw.strip()
    return data

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No file path provided'}))
        sys.exit(1)
    try:
        result = extract(sys.argv[1])
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
