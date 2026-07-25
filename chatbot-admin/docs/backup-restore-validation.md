# Backup and Restore Validation

## Backup Policy

- daily PostgreSQL backup
- retain 7 daily backups
- retain 4 weekly backups

## Restore Validation

A backup is only valid if it can be restored.

Recommended cadence:

- run an automated restore validation at least weekly
- restore into an isolated validation database
- run a smoke check after restore

## Validation Steps

1. Restore the latest backup into a temporary PostgreSQL instance.
2. Run Prisma migration status or schema inspection.
3. Start the API against the restored database.
4. Verify:
   - platform owner login works
   - client list loads
   - at least one conversation query works
   - at least one lead export works
5. Record:
   - backup timestamp
   - restore duration
   - validation result
   - operator or automation run ID

## Failure Handling

- mark the backup validation as failed
- do not wait for the next scheduled backup
- investigate immediately:
  - corrupted dump
  - incomplete archive
  - credential mismatch
  - incompatible migration state

## Minimum Automation Target

Automate:

- backup creation
- restore into temporary database
- API smoke test against restored database
- result logging to ops channel or admin dashboard
