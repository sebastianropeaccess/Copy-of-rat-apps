-- Migration: Add multi-photo, timer tracking columns
-- Run this against your Supabase database

-- Feature 2: Multi-photo per defect
-- Stores array of photo URLs; initial_photo_url kept for backward compatibility
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS initial_photo_urls text[] DEFAULT '{}';

-- Feature 5: Timer tracking
-- Stores accumulated seconds for pause/resume timer functionality
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS accumulated_seconds integer DEFAULT 0;
