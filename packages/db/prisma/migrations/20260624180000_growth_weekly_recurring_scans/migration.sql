UPDATE "Brand" AS b
SET
  "recurringScanActive" = true,
  "recurringScanCadence" = 'weekly',
  "recurringScanPlan" = 'growth',
  "recurringScanActivatedAt" = COALESCE(b."recurringScanActivatedAt", NOW()),
  "recurringScanNextRunAt" = CASE
    WHEN b."recurringScanActive" = true AND b."recurringScanNextRunAt" IS NOT NULL
      THEN b."recurringScanNextRunAt"
    ELSE NOW()
  END,
  "recurringScanProviderVariants" = '[{"provider":"openai","searchEnabled":true},{"provider":"google","searchEnabled":true},{"provider":"anthropic","searchEnabled":true}]'::jsonb
FROM "Organization" AS o
WHERE b."organizationId" = o.id
  AND o."plan" = 'growth';

UPDATE "Brand" AS b
SET
  "recurringScanActive" = false,
  "recurringScanPlan" = NULL,
  "recurringScanCadence" = NULL,
  "recurringScanNextRunAt" = NULL
FROM "Organization" AS o
WHERE b."organizationId" = o.id
  AND o."plan" <> 'growth'
  AND b."recurringScanActive" = true;
