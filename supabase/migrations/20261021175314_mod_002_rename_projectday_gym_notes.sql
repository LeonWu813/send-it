-- AC-200 (Rev 48, MOD-002): Rename "Send It" → "ProjectDay" in gyms.bouldering_only_note.
-- The spec's AC-200 references this column as "notes"; the actual column is bouldering_only_note.
-- Safe to re-run: only rows whose bouldering_only_note contains "Send It" are updated.
-- Never edit 20260920000002_mod_002_gym_directory.sql.
-- Requires: supabase db push (Leon's step — see setup.md 11.7).

UPDATE gyms
SET bouldering_only_note = replace(bouldering_only_note, 'Send It', 'ProjectDay')
WHERE bouldering_only_note LIKE '%Send It%';
