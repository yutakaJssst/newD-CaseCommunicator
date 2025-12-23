-- CreateTable
CREATE TABLE "diagram_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diagramId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "commitMessage" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diagram_versions_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "diagrams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "diagram_versions_diagramId_idx" ON "diagram_versions"("diagramId");

-- CreateIndex
CREATE UNIQUE INDEX "diagram_versions_diagramId_versionNumber_key" ON "diagram_versions"("diagramId", "versionNumber");
