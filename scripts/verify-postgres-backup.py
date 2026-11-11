"""Restore a fresh NaydiGo dump into a throwaway PostgreSQL database.

Run on the VPS as root after backup-postgres.mjs and before any migration.
This script never restores into the production database.
"""
import hashlib
import json
import pathlib
import re
import secrets
import subprocess
import sys
from urllib.parse import urlparse


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout.strip()


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: verify-postgres-backup.py BACKUP_DIRECTORY')
    root = pathlib.Path('/var/www/naydi-data/backups').resolve()
    backup = pathlib.Path(sys.argv[1]).resolve()
    if root not in backup.parents or not backup.is_dir():
        raise SystemExit('Backup must be an existing child of the NaydiGo backup directory')
    copies = sorted(backup.glob('*/naydigo.dump'))
    if len(copies) != 1 or copies[0].stat().st_size < 1024:
        raise RuntimeError('Expected exactly one nonempty PostgreSQL dump')
    dump = copies[0]
    report = json.loads((dump.parent / 'report.json').read_text())
    if report.get('databaseBytes') != dump.stat().st_size:
        raise RuntimeError('Backup size does not match its report')
    run('pg_restore', '--list', str(dump))

    runtime = pathlib.Path('/var/www/naydi-data/runtime.env').read_text()
    match = re.search(r'^DATABASE_URL=(.+)$', runtime, re.MULTILINE)
    if not match:
        raise RuntimeError('Production database URL is absent')
    value = match.group(1).strip()
    if value.startswith('"'):
        value = json.loads(value)
    database = urlparse(value).path.lstrip('/')
    if not re.fullmatch(r'[a-zA-Z_][a-zA-Z_0-9]*', database):
        raise RuntimeError('Unexpected production database name')
    temporary = 'naydigoverify_' + secrets.token_hex(6)
    run('sudo', '-n', '-u', 'postgres', 'createdb', temporary)
    try:
        with dump.open('rb') as stream:
            subprocess.run(['sudo', '-n', '-u', 'postgres', 'pg_restore', '--no-owner',
                            '--no-acl', '--exit-on-error', '-d', temporary],
                           stdin=stream, check=True, capture_output=True)
        names = run('sudo', '-n', '-u', 'postgres', 'psql', '-d', temporary, '-Atc',
                    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").splitlines()
        required = {'shops', 'products', 'uploads', 'buyer_accounts', 'buyer_sessions',
                    'searches', 'search_metrics', 'api_calls', 'api_budget'}
        if not required.issubset(names):
            raise RuntimeError('Restored database lacks required tables')
        counts = {}
        for name in names:
            if not re.fullmatch(r'[a-z_][a-z_0-9]*', name):
                raise RuntimeError('Unexpected table name in restore')
            counts[name] = int(run('sudo', '-n', '-u', 'postgres', 'psql', '-d', temporary,
                                   '-Atc', f'SELECT count(*) FROM "{name}"'))
        for name in ('shops', 'products'):
            live = int(run('sudo', '-n', '-u', 'postgres', 'psql', '-d', database,
                           '-Atc', f'SELECT count(*) FROM "{name}"'))
            if live and not counts[name]:
                raise RuntimeError(f'Restored {name} unexpectedly empty')
        photos = dump.parent / 'photos'
        source_photos = pathlib.Path('/var/www/naydi-data/bucket')
        if report.get('photosIncluded'):
            if not photos.is_dir():
                raise RuntimeError('Photos are missing from the backup')
            copied = {p.name: digest(p) for p in photos.iterdir() if p.is_file()}
            current = {p.name: digest(p) for p in source_photos.iterdir() if p.is_file()}
            if copied != current:
                raise RuntimeError('Backup photos differ from the source bucket')
        else:
            copied = {}
        verification = {'isolatedRestore': True, 'database': temporary,
                        'tableCounts': counts, 'photoFilesVerified': len(copied),
                        'dumpSha256': digest(dump)}
        (backup / 'verification.json').write_text(json.dumps(verification, indent=2) + '\n')
        print('BACKUP_RESTORE_VERIFIED', len(names), 'tables', len(copied), 'photos')
    finally:
        run('sudo', '-n', '-u', 'postgres', 'dropdb', '--if-exists', '--force', temporary)


if __name__ == '__main__':
    main()
