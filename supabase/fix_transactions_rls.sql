-- Fix Transactions Table Structure and RLS Policies
-- Run this in Supabase SQL Editor to resolve the TX_CREATION_FAILED error

-- 1. Ensure transactions table exists and has correct columns
CREATE TABLE IF NOT EXISTS transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  status text DEFAULT 'completed',
  media_upload_id uuid REFERENCES media_uploads(id),
  owner_commission decimal(10,2),
  platform_commission decimal(10,2)
);

-- Add columns if they are missing (idempotent)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'media_upload_id') THEN
    ALTER TABLE transactions ADD COLUMN media_upload_id uuid REFERENCES media_uploads(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'owner_commission') THEN
    ALTER TABLE transactions ADD COLUMN owner_commission decimal(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'platform_commission') THEN
    ALTER TABLE transactions ADD COLUMN platform_commission decimal(10,2);
  END IF;
END $$;

-- 2. Reset and Fix RLS Policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Public can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Enable insert for public" ON transactions;
DROP POLICY IF EXISTS "Owners can view their transactions" ON transactions;
DROP POLICY IF EXISTS "Enable read for owners" ON transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON transactions;

-- Policy 1: Allow anyone (public/anon) to INSERT transactions
-- This is necessary because the upload page is public
CREATE POLICY "Enable insert for public"
ON transactions FOR INSERT
TO public
WITH CHECK (true);

-- Policy 2: Allow owners to VIEW transactions related to their screens
-- Links transaction -> media_upload -> screen -> owner
CREATE POLICY "Enable read for owners"
ON transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM media_uploads m
    JOIN screens s ON m.screen_id = s.id
    WHERE m.id = transactions.media_upload_id
    AND s.owner_id = auth.uid()
  )
);

-- Policy 3: Allow owners to update/delete if needed (optional, for safety mostly read-only for now)
