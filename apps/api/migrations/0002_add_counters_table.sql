-- Migration: 0002_add_counters_table
-- Atomic sequence generator for receipt numbers and member codes.
-- Uses INSERT ... ON CONFLICT DO UPDATE RETURNING to atomically increment
-- and read the next value, eliminating the TOCTOU race condition in
-- getNextReceiptNumber() and getNextMemberCode().

CREATE TABLE IF NOT EXISTS counters (
  gym_id       INTEGER NOT NULL,
  counter_type TEXT NOT NULL,  -- e.g. 'receipt', 'member_code'
  value        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (gym_id, counter_type)
);

-- Seed counters from existing data
INSERT OR IGNORE INTO counters (gym_id, counter_type, value)
SELECT gym_id, 'receipt', COUNT(*) FROM payments GROUP BY gym_id;

INSERT OR IGNORE INTO counters (gym_id, counter_type, value)
SELECT gym_id, 'member_code', COUNT(*) FROM members GROUP BY gym_id;
