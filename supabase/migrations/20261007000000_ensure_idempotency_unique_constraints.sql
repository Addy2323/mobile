-- Migration to ensure full UNIQUE constraints on idempotency_key for ON CONFLICT clause

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_intents' AND column_name = 'idempotency_key'
  ) THEN
    BEGIN
      ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_idempotency_key_key UNIQUE (idempotency_key);
    EXCEPTION
      WHEN duplicate_table THEN NULL;
      WHEN invalid_table_definition THEN NULL;
      WHEN others THEN NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_attempts' AND column_name = 'idempotency_key'
  ) THEN
    BEGIN
      ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_idempotency_key_key UNIQUE (idempotency_key);
    EXCEPTION
      WHEN duplicate_table THEN NULL;
      WHEN invalid_table_definition THEN NULL;
      WHEN others THEN NULL;
    END;
  END IF;
END $$;
