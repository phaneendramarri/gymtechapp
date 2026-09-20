-- Migration 0001: enforce one check-in per member per day at the DB level.
--
-- checkIn() used to read-then-write, so two concurrent desk/kiosk taps for
-- the same member could insert duplicate rows for the same day. The unique
-- index makes the second insert a no-op (the repository uses
-- ON CONFLICT DO NOTHING and reports alreadyCheckedIn).
--
-- The DELETE first collapses any pre-existing duplicates (keeps MIN(id)),
-- so the index creation cannot fail on legacy data. Idempotent: safe to
-- re-run on databases that already satisfy the constraint.
DELETE FROM attendance
WHERE id NOT IN (
  SELECT MIN(id)
  FROM attendance
  GROUP BY gymId, memberId, attendanceDate
);

CREATE UNIQUE INDEX IF NOT EXISTS attendanceGymMemberDayUnique
  ON attendance (gymId, memberId, attendanceDate);
