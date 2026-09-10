-- ============================================================================
-- OPTIONAL: Seed the 15 pilot students (run manually after the main migration).
-- Teachers and core team (Dr. Demssie, Eng. Abiy, Dr. Betel) sign up through
-- the app; the Super Admin assigns their roles in Dashboard -> My profile.
-- ============================================================================

insert into public.students
  (first_name, last_name, gender, grade, section, guardian_name, guardian_phone, address, birth_date, math_score, logic_score, language_score)
values
  ('Abel', 'Tesfaye',  'male',   '1', 'A', 'Tesfaye Worku',   '+251911000001', 'Zereyakob kebele', '2017-03-12', 92, 88, 95),
  ('Birtukan', 'Mekonnen', 'female', '1', 'A', 'Mekonnen Assefa', '+251911000002', 'Zereyakob kebele', '2018-01-25', 85, 90, 91),
  ('Chala', 'Girma',   'male',   '2', 'A', 'Girma Tadesse',   '+251911000003', 'Near the market',   '2016-07-08', 78, 74, 81),
  ('Dagmawit', 'Takele', 'female', '2', 'A', 'Takele Kassa',   '+251911000004', 'Kebele office road', '2017-11-19', 95, 92, 97),
  ('Eyob', 'Alemu',    'male',   '3', 'B', 'Alemu Getachew',  '+251911000005', 'School area',       '2016-02-14', 88, 81, 76),
  ('Fikerte', 'Hailu', 'female', '3', 'B', 'Hailu Bekele',    '+251911000006', 'Zereyakob kebele', '2015-10-02', 91, 89, 93),
  ('Girmachew', 'Desta', 'male', '4', 'B', 'Desta Fikadu',    '+251911000007', 'River side',        '2015-05-21', 67, 72, 70),
  ('Hiwot', 'Solomon', 'female', '4', 'B', 'Solomon Nigussie','+251911000008', 'Kebele two',        '2014-09-30', 96, 94, 98),
  ('Ibrahim', 'Yusuf', 'male',   '5', 'A', 'Yusuf Ahmed',     '+251911000009', 'Near clinic',       '2014-04-17', 82, 86, 79),
  ('Jemila', 'Kedir',  'female', '5', 'A', 'Kedir Mohammed',  '+251911000010', 'Bus station area',  '2013-12-05', 90, 87, 92),
  ('Kalkidan', 'Negash', 'female', '1', 'A', 'Negash Tulu',    '+251911000011', 'Zereyakob center',  '2018-06-11', 84, 91, 88),
  ('Luel', 'Aschalew','male',   '2', 'A', 'Aschalew Bekele',  '+251911000012', 'Kebele three',      '2016-08-23', 73, 76, 80),
  ('Mahlet', 'Birhanu','female', '3', 'B', 'Birhanu Alemu',    '+251911000013', 'Upper hill',        '2015-03-09', 94, 88, 96),
  ('Natnael', 'Mengistu','male', '4', 'B', 'Mengistu Berhe',   '+251911000014', 'School compound',   '2014-07-27', 79, 84, 75),
  ('Omer', 'Abdela',   'male',   '5', 'A', 'Abdela Seid',      '+251911000015', 'Lowland area',      '2013-01-15', 87, 90, 85)
on conflict do nothing;