ALTER TABLE agents ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;
UPDATE agents SET auth_user_id = '7f4dcd04-e8fd-41aa-94c5-54e647eb261e' WHERE email = 'leads@enrollsalud.com';
