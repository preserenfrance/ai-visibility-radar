UPDATE "Brand" AS b
SET
  "recurringScanActive" = true,
  "recurringScanCadence" = 'weekly',
  "recurringScanPlan" = o."plan",
  "recurringScanActivatedAt" = COALESCE(b."recurringScanActivatedAt", NOW()),
  "recurringScanNextRunAt" = CASE
    WHEN b."recurringScanActive" = true AND b."recurringScanNextRunAt" IS NOT NULL
      THEN b."recurringScanNextRunAt"
    ELSE NOW()
  END,
  "recurringScanProviderVariants" = '[{"provider":"openai","searchEnabled":true},{"provider":"google","searchEnabled":true},{"provider":"anthropic","searchEnabled":true}]'::jsonb
FROM "Organization" AS o
WHERE b."organizationId" = o.id
  AND o."plan" IN ('free', 'starter', 'growth');
