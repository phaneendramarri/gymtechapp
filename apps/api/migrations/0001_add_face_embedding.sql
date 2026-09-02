-- Migration 0001: Add face_embedding column to members table
-- Stores serialized 64-element spatial luminance grid, dHash, and skin-tone chrominance
-- Enables zero-download, instant biometric Face ID recognition on the floor terminal.

ALTER TABLE members ADD COLUMN face_embedding TEXT;
