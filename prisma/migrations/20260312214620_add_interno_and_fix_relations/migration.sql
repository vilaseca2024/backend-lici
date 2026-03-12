-- CreateTable
CREATE TABLE "folder" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "url" TEXT,
    "softwareUrl" TEXT,
    "driveUrl" TEXT,
    "client" TEXT,
    "parentId" INTEGER,
    "userId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "updatedBy" INTEGER,

    CONSTRAINT "folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "type" TEXT,
    "reference" TEXT,
    "comment" TEXT,
    "status" TEXT,
    "url" TEXT,
    "softwareUrl" TEXT,
    "driveUrl" TEXT,
    "folderId" INTEGER,
    "solicitudId" INTEGER,
    "userId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "updatedBy" INTEGER,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "type" TEXT,
    "reference" TEXT,
    "comment" TEXT,
    "status" TEXT,
    "page" TEXT,
    "url" TEXT,
    "softwareUrl" TEXT,
    "driveUrl" TEXT,
    "folderId" INTEGER,
    "solicitudId" INTEGER,
    "userId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "updatedBy" INTEGER,

    CONSTRAINT "fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud" (
    "id" SERIAL NOT NULL,
    "type" TEXT,
    "reference" TEXT,
    "comment" TEXT,
    "status" TEXT,
    "interno" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "updatedBy" INTEGER,

    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interno" (
    "id" SERIAL NOT NULL,
    "interno" TEXT NOT NULL,
    "validado" BOOLEAN NOT NULL DEFAULT false,
    "cliente" TEXT,
    "estado" TEXT,
    "userId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "updatedBy" INTEGER,

    CONSTRAINT "interno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "folder_slug_key" ON "folder"("slug");

-- CreateIndex
CREATE INDEX "folder_parentId_idx" ON "folder"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "folder_parentId_name_key" ON "folder"("parentId", "name");

-- CreateIndex
CREATE INDEX "file_folderId_idx" ON "file"("folderId");

-- CreateIndex
CREATE INDEX "file_userId_idx" ON "file"("userId");

-- CreateIndex
CREATE INDEX "file_solicitudId_idx" ON "file"("solicitudId");

-- CreateIndex
CREATE INDEX "fotos_folderId_idx" ON "fotos"("folderId");

-- CreateIndex
CREATE INDEX "fotos_userId_idx" ON "fotos"("userId");

-- CreateIndex
CREATE INDEX "fotos_solicitudId_idx" ON "fotos"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_interno_key" ON "solicitud"("interno");

-- CreateIndex
CREATE INDEX "solicitud_userId_idx" ON "solicitud"("userId");

-- CreateIndex
CREATE INDEX "solicitud_status_idx" ON "solicitud"("status");

-- CreateIndex
CREATE UNIQUE INDEX "interno_interno_key" ON "interno"("interno");

-- CreateIndex
CREATE INDEX "interno_userId_idx" ON "interno"("userId");

-- CreateIndex
CREATE INDEX "interno_estado_idx" ON "interno"("estado");

-- CreateIndex
CREATE INDEX "interno_interno_idx" ON "interno"("interno");

-- AddForeignKey
ALTER TABLE "folder" ADD CONSTRAINT "folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder" ADD CONSTRAINT "folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitud"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitud"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interno" ADD CONSTRAINT "interno_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
