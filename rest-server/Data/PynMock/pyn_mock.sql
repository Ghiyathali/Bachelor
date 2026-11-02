-- =====================================================================
-- MOCK of Pangaea Youth Network's database (#69) - INVENTED DATA ONLY.
--
-- PYN gives database access only at handover. Until then the sync reads
-- this mock, which copies the structure of PYN's real tables (from their
-- schema_export.sql) and the anonymising views from the design document
-- "PYN Data Integration" (Appendix A).
--
--   pyn_mock            = PYN's raw tables (like their "public" schema)
--   pyn_mock_analytics  = the views the sync reads (like their "analytics")
--
-- Safe to run again: it drops and recreates ONLY these two mock schemas.
-- It never touches our own tables. Run it on our database, never on PYN's.
-- =====================================================================

DROP SCHEMA IF EXISTS pyn_mock_analytics CASCADE;
DROP SCHEMA IF EXISTS pyn_mock CASCADE;
CREATE SCHEMA pyn_mock;
CREATE SCHEMA pyn_mock_analytics;

-- ---------- PYN's tables (only the columns relevant to us) ----------

CREATE TABLE pyn_mock.events (
    id          uuid PRIMARY KEY,
    slug        text NOT NULL UNIQUE,
    title       text NOT NULL DEFAULT '',
    status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'archived')),
    city        text,
    start_date  text,              -- text, as in PYN's real table
    finish_date text,
    topic       text,              -- free text, used as event type
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pyn_mock.event_registrations (
    id                  bigint PRIMARY KEY,
    event_name          text NOT NULL,  -- the event's title (no foreign key, like PYN)
    full_name           text NOT NULL,
    email               text NOT NULL,
    phone               text NOT NULL,
    age                 integer,
    city                text NOT NULL,
    attended_before     text,
    heard_about         text,
    allergies           text,
    dietary             text,
    media_consent       text,
    subscribe_updates   text,
    status              text NOT NULL DEFAULT 'Pending',
    submitted_at        timestamptz NOT NULL DEFAULT now(),
    event_date          date,
    gender              text,
    fewer_opportunities text,
    nationality         text
);

-- ---------- Invented events ----------
-- Fixed ids, so every run and every test produces the same data.

INSERT INTO pyn_mock.events (id, slug, title, status, city, start_date, finish_date, topic) VALUES
('00000000-0000-4000-8000-000000000001', 'reggaeton-workshop-sep', 'Reggaeton Dance Workshop', 'published', 'Horsens', '2026-09-10', '2026-09-10', 'Workshop'),
('00000000-0000-4000-8000-000000000002', 'running-club-sep',       'Running Club',             'published', 'Horsens', '2026-09-15', '',           'Sports'),
('00000000-0000-4000-8000-000000000003', 'hungarian-evening',      'Hungarian Evening',        'published', 'Horsens', '2026-09-24', '2026-09-24', 'Cultural evening'),
('00000000-0000-4000-8000-000000000004', 'drama-lab',              'Drama Lab',                'published', 'Horsens', '2026-10-07', '2026-10-07', 'Creative arts'),
('00000000-0000-4000-8000-000000000005', 'board-game-night',       'Board Game Night',         'published', 'Horsens', '2026-10-14T18:00', NULL,   'Social meetup'),
('00000000-0000-4000-8000-000000000006', 'language-cafe',          'Language Café',            'published', 'Aarhus',  '2026-10-21', '2026-10-21', 'Language café'),
('00000000-0000-4000-8000-000000000007', 'reggaeton-workshop-oct', 'Reggaeton Dance Workshop', 'published', 'Horsens', '2026-10-28', '2026-10-28', 'workshop'),
('00000000-0000-4000-8000-000000000008', 'halloween-party',        'Halloween Party',          'draft',     'Horsens', '2026-10-31', '2026-10-31', 'Social meetup'),
('00000000-0000-4000-8000-000000000009', 'summer-picnic',          'Summer Picnic',            'archived',  'Vejle',   '2026-06-20', '2026-06-20', 'Social meetup');

-- ---------- Invented sign-ups ----------
-- "Test Person <id>" / test<id>@example.invalid: obviously fake, and present
-- on purpose so the demo can show that the views and the sync drop them.

INSERT INTO pyn_mock.event_registrations
    (id, event_name, event_date, full_name, email, phone, age, city, nationality, gender,
     attended_before, heard_about, fewer_opportunities, allergies, dietary, media_consent,
     subscribe_updates, status, submitted_at)
SELECT
    e.base_id + g,
    e.title,
    e.event_date,
    'Test Person ' || (e.base_id + g),
    'test' || (e.base_id + g) || '@example.invalid',
    '+45 0000 ' || lpad((e.base_id + g)::text, 4, '0'),
    (ARRAY[16, 17, 18, 19, 21, 23, 24, 25, 27, 30, 31, 35, 22, 20, NULL])[(g % 15) + 1],
    (ARRAY['Horsens', 'horsens ', '  aarhus', 'Vejle', 'Copenhagen', 'Horsens', 'Odense'])[(g * 3 % 7) + 1],
    (ARRAY['Danish', 'danish ', 'Hungarian', 'Spanish', 'Ukrainian', 'Syrian', 'German', NULL])[(g * 5 % 8) + 1],
    (ARRAY['Female', 'Male', 'Non-binary', 'Other', 'Prefer not to say', 'Female', 'Male', NULL])[(g * 7 % 8) + 1],
    (ARRAY['Yes', 'No', 'No', '', NULL])[(g % 5) + 1],
    (ARRAY['Instagram', 'Facebook', 'Friend', 'LinkedIn', 'Poster', 'Other', 'Instagram', NULL])[(g * 3 % 8) + 1],
    (ARRAY['No fewer opportunities', 'No fewer opportunities', 'No fewer opportunities',
           'No fewer opportunities', 'No fewer opportunities', 'No fewer opportunities',
           'Disabilities', 'Health problems', 'Geographical barriers',
           'Cultural differences', '', NULL])[(g * 5 % 12) + 1],
    (ARRAY['None', 'Nuts', '', 'Lactose'])[(g % 4) + 1],
    (ARRAY['No preference', 'Vegetarian', 'Vegan'])[(g % 3) + 1],
    (ARRAY['Yes', 'No'])[(g % 2) + 1],
    'No',
    (ARRAY['Accepted', 'Accepted', 'Accepted', 'Pending', 'Waiting', 'Rejected'])[(g % 6) + 1],
    e.event_date - make_interval(days => (g % 14) + 1)
FROM (VALUES
    ('Reggaeton Dance Workshop', DATE '2026-09-10', 1000, 18),
    ('Running Club',             DATE '2026-09-15', 2000, 14),
    ('Hungarian Evening',        DATE '2026-09-24', 3000, 22),
    ('Drama Lab',                DATE '2026-10-07', 4000, 12),
    ('Board Game Night',         DATE '2026-10-14', 5000, 20),
    ('Language Café',            DATE '2026-10-21', 6000, 16),
    ('Reggaeton Dance Workshop', DATE '2026-10-28', 7000, 24),
    ('Summer Picnic',            DATE '2026-06-20', 8000, 15)
) AS e(title, event_date, base_id, how_many)
CROSS JOIN LATERAL generate_series(1, e.how_many) AS g;

-- Edge cases the sync must skip and report
INSERT INTO pyn_mock.event_registrations
    (id, event_name, event_date, full_name, email, phone, age, city, status, submitted_at)
VALUES
    -- typo, like on PYN's website: matches no event
    (9001, 'Raggeaton Dance Workshop', DATE '2026-10-28', 'Test Person 9001', 'test9001@example.invalid', '+45 0000 9001', 22, 'Horsens', 'Accepted', '2026-10-20'),
    -- no date, and two events share this title: ambiguous
    (9002, 'Reggaeton Dance Workshop', NULL,              'Test Person 9002', 'test9002@example.invalid', '+45 0000 9002', 24, 'Horsens', 'Pending',  '2026-10-20'),
    -- belongs to a draft event, which is not synced
    (9003, 'Halloween Party',          DATE '2026-10-31', 'Test Person 9003', 'test9003@example.invalid', '+45 0000 9003', 19, 'Horsens', 'Pending',  '2026-10-25');

-- ---------- The views the sync reads (design document, Appendix A) ----------
-- Anonymisation happens HERE: names, contact details, exact age, allergies,
-- consents and the fewer-opportunities reason never leave these views.

CREATE VIEW pyn_mock_analytics.events AS
SELECT id, title, status, city, start_date, finish_date, topic
FROM pyn_mock.events
WHERE status IN ('published', 'archived');

CREATE VIEW pyn_mock_analytics.event_registrations AS
SELECT id, event_name, event_date, status, submitted_at,
    CASE WHEN age IS NULL THEN NULL
         WHEN age < 18  THEN 'Under18'
         WHEN age <= 24 THEN 'From18To24'
         WHEN age <= 30 THEN 'From25To30'
         ELSE 'Over30' END AS age_band,
    city, nationality, gender, heard_about,
    CASE WHEN attended_before = 'Yes' THEN true
         WHEN attended_before = 'No'  THEN false END AS attended_before,
    CASE WHEN coalesce(fewer_opportunities, '') = '' THEN NULL
         WHEN fewer_opportunities = 'No fewer opportunities' THEN false
         ELSE true END AS fewer_opportunities
FROM pyn_mock.event_registrations;
