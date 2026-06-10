-- Purge seeded demo accounts created on 2026-06-07 (20 students + Marcus Reed instructor + Jake Calloway student).
-- Deleting from auth.users cascades to profiles, user_roles, and related rows.
DELETE FROM auth.users
WHERE id IN (
  'f7f34867-9b86-4718-b1e1-789b1b5932f7',
  '2e343a9d-bb25-4b06-8619-3f590a2c80a2',
  '48470d5b-ef5c-40be-9553-3f6da545b585',
  'd616e1c7-002e-4ccc-9b83-5fabd0ef2f0e',
  'be00551e-0756-48d3-a574-35adff5664cc',
  '8c531f4e-492b-44f5-a861-357edb9e3b5e',
  '8518126d-e778-4a68-8cf9-0ee486fe1d68',
  'd4e018c1-47cb-4e81-b3a4-aa8957196475',
  'b4aa87f2-03af-4a07-853d-b9f620b3a01d',
  '0057c86a-eb14-47d1-8594-033463af16b2',
  '1ab1e24f-9500-46d3-8838-4ad9e5efbbac',
  '766ca1c4-4752-4ef4-b6a1-0f8114a8cfd2',
  '14648fd6-4ae4-4c09-99cb-5c7873349c78',
  '810e150a-7749-4087-b106-050e7b3597ba',
  'b17fd3f7-52e3-4345-9d46-fc6c4935f977',
  'e7908dc1-4c06-413f-8790-c0ed44a6b479',
  '85978303-d62f-4a73-8053-dd63989d5793',
  'b4226b25-158c-44fe-b967-d6064b510a5a',
  'c65e80d4-2529-4c76-a008-44d08388ebbd',
  '7cb0a70e-8f4d-457c-bd29-2bd0ad83bc9f',
  '78b4d2d2-44fe-40fd-9f23-306b36e9f456',
  'd56aca53-f846-42a0-8f9f-7ae9120bb2d7'
);