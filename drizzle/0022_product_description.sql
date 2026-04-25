-- Migration: products.description (AI-generated or manual product description)

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description" text;
