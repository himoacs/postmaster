/**
 * Database test helpers
 * Utilities for testing database operations
 */
import { PrismaClient } from '@prisma/client';

// Create a test-specific Prisma client
export function createTestPrismaClient() {
  // Set up environment for in-memory SQLite if needed
  if (!process.env.DATABASE_URL || process.env.NODE_ENV === 'test') {
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
  }
  
  const prisma = new PrismaClient();
  return prisma;
}

/**
 * Seed database with test data
 */
export async function seedTestDatabase(prisma: PrismaClient, data: {
  apiKeys?: any[];
  generations?: any[];
  syntheses?: any[];
  profiles?: any[];
  knowledge?: any[];
  preferences?: any[];
}) {
  // Clean existing data
  await prisma.generationOutput.deleteMany();
  await prisma.generationCritique.deleteMany();
  await prisma.generation.deleteMany();
  await prisma.synthesisVersion.deleteMany();
  await prisma.synthesizedContent.deleteMany();
  await prisma.aPIKey.deleteMany();
  await prisma.styleProfile.deleteMany();
  await prisma.knowledgeEntry.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.liteLLMConfig.deleteMany();

  // Seed API keys
  if (data.apiKeys) {
    for (const key of data.apiKeys) {
      await prisma.aPIKey.create({ data: key });
    }
  }

  // Seed generations
  if (data.generations) {
    for (const gen of data.generations) {
      await prisma.generation.create({ data: gen });
    }
  }

  // Seed syntheses
  if (data.syntheses) {
    for (const synth of data.syntheses) {
      await prisma.synthesizedContent.create({ data: synth });
    }
  }

  // Seed profiles
  if (data.profiles) {
    for (const profile of data.profiles) {
      await prisma.styleProfile.create({ data: profile });
    }
  }

  // Seed knowledge
  if (data.knowledge) {
    for (const kb of data.knowledge) {
      await prisma.knowledgeEntry.create({ data: kb });
    }
  }

  // Seed preferences
  if (data.preferences) {
    for (const pref of data.preferences) {
      await prisma.userPreferences.create({ data: pref });
    }
  }
}

/**
 * Clean up database after tests
 */
export async function cleanupTestDatabase(prisma: PrismaClient) {
  await prisma.generationOutput.deleteMany();
  await prisma.generationCritique.deleteMany();
  await prisma.generation.deleteMany();
  await prisma.synthesisVersion.deleteMany();
  await prisma.synthesizedContent.deleteMany();
  await prisma.aPIKey.deleteMany();
  await prisma.styleProfile.deleteMany();
  await prisma.knowledgeEntry.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.liteLLMConfig.deleteMany();
  await prisma.$disconnect();
}
