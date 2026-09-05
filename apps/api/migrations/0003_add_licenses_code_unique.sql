-- H-15: Add UNIQUE constraint on licenses.code to prevent duplicate license codes.
CREATE UNIQUE INDEX IF NOT EXISTS licenses_code_unique ON licenses(code);
