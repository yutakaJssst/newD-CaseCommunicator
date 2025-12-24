-- Add survey audience and question scale type, plus float scores
ALTER TABLE "surveys" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'general';

ALTER TABLE "survey_questions" ADD COLUMN "scaleType" TEXT NOT NULL DEFAULT 'likert_0_3';

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_survey_answers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "responseId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "score" REAL NOT NULL,
  "comment" TEXT,
  CONSTRAINT "survey_answers_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "survey_responses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "survey_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "survey_questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_survey_answers" ("id", "responseId", "questionId", "score", "comment")
SELECT "id", "responseId", "questionId", "score", "comment" FROM "survey_answers";

DROP TABLE "survey_answers";

ALTER TABLE "new_survey_answers" RENAME TO "survey_answers";

CREATE UNIQUE INDEX "survey_answers_responseId_questionId_key" ON "survey_answers"("responseId", "questionId");
CREATE INDEX "survey_answers_questionId_idx" ON "survey_answers"("questionId");

PRAGMA foreign_keys=ON;
