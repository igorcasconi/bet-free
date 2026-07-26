-- Placeholder RLS: blocks all access via anon/authenticated (PostgREST) roles.
-- Service role bypasses RLS and remains the only access path until real
-- policies are defined (business logic, out of scope here).

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_deny_all ON users FOR ALL TO anon, authenticated USING (false);

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY competitions_deny_all ON competitions FOR ALL TO anon, authenticated USING (false);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY teams_deny_all ON teams FOR ALL TO anon, authenticated USING (false);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY matches_deny_all ON matches FOR ALL TO anon, authenticated USING (false);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY predictions_deny_all ON predictions FOR ALL TO anon, authenticated USING (false);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY achievements_deny_all ON achievements FOR ALL TO anon, authenticated USING (false);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_achievements_deny_all ON user_achievements FOR ALL TO anon, authenticated USING (false);

ALTER TABLE ranking_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY ranking_cache_deny_all ON ranking_cache FOR ALL TO anon, authenticated USING (false);
