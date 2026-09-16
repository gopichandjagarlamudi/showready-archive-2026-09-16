"""Authenticate and decrypt a ShowReady backup. Requires: pip install cryptography."""
import argparse
from pathlib import Path
from cryptography.fernet import Fernet
p=argparse.ArgumentParser()
p.add_argument('--key',required=True,type=Path)
p.add_argument('--input',required=True,type=Path)
p.add_argument('--output',required=True,type=Path)
a=p.parse_args()
plaintext=Fernet(a.key.read_bytes().strip()).decrypt(a.input.read_bytes())
# Exclusive creation protects an existing file from accidental overwrite.
import os
fd=os.open(a.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'wb') as out:out.write(plaintext)
print('Authenticated backup decrypted to',a.output)
