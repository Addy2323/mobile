ALTER TABLE payment_destinations DROP CONSTRAINT IF EXISTS payment_destinations_type_check;
ALTER TABLE payment_destinations ADD CONSTRAINT payment_destinations_type_check
  CHECK (type IN ('PHONE','LIPA_NUMBER','BANK_ACCOUNT','QR','CARD',
                  'VERIFIED_MERCHANT','EXTERNAL_RECIPIENT','LIPA_CONTROL'));
