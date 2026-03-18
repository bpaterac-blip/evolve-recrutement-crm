-- Mise à jour des profils ayant Lemlist comme source vers Chasse LinkedIn
UPDATE profiles
SET source = 'Chasse LinkedIn'
WHERE LOWER(source) = 'lemlist'
   OR LOWER(source) = 'chasse linkedin (lemlist)';
