-- CreateTable
CREATE TABLE "PinnedContext" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "UploadedContextKind" NOT NULL DEFAULT 'OTHER',
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinnedContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "experience" TEXT,
    "additionalInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PinnedContext_userId_createdAt_idx" ON "PinnedContext"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Persona_userId_createdAt_idx" ON "Persona"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PinnedContext" ADD CONSTRAINT "PinnedContext_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
