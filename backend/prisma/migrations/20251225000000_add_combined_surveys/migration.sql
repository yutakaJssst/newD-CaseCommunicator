-- Add combined survey mode, audience separation, and expert public token
ALTER TABLE "surveys" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'single';
ALTER TABLE "surveys" ADD COLUMN "publicTokenExpert" TEXT;
ALTER TABLE "survey_questions" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "survey_responses" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'general';

-- Backfill audience for existing expert-only surveys
UPDATE "survey_questions"
SET "audience" = 'expert'
WHERE "surveyId" IN (SELECT "id" FROM "surveys" WHERE "audience" = 'expert');

UPDATE "survey_responses"
SET "audience" = 'expert'
WHERE "surveyId" IN (SELECT "id" FROM "surveys" WHERE "audience" = 'expert');

-- Ensure unique expert public tokens
CREATE UNIQUE INDEX "surveys_publicTokenExpert_key" ON "surveys"("publicTokenExpert");
