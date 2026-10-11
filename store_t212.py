#!/usr/bin/env python3
"""Sealed-card consumer: store Trading 212 API credentials for Stock Tracker's daily job.

Reads {"key": ..., "secret": ..., "env": "live"|"demo"} on stdin, writes them to
/data/.stock-tracker/t212.json with 0600 permissions, never prints them.
"""
import json, os, sys

data = json.load(sys.stdin)
key = (data.get('key') or '').strip()
if not key:
    sys.exit('missing key')
env = (data.get('env') or (sys.argv[1] if len(sys.argv) > 1 else 'live')).strip().lower()
cred = {'key': key, 'secret': (data.get('secret') or '').strip(), 'env': 'demo' if env.startswith('d') else 'live'}
os.makedirs('/data/.stock-tracker', mode=0o700, exist_ok=True)
path = '/data/.stock-tracker/t212.json'
fd = os.open(path + '.tmp', os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as f:
    json.dump(cred, f)
os.replace(path + '.tmp', path)
