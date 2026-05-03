import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof makeClient> }

function makeClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  }).$extends({
    // Globally hide soft-deleted Transaction rows from app reads.
    // Use prismaRaw (below) when you need to see deleted rows (restore flow,
    // hard-delete admin tools, history audits).
    query: {
      transaction: {
        async findMany({ args, query }) {
          args.where = { deletedAt: null, ...(args.where ?? {}) }
          return query(args)
        },
        async findFirst({ args, query }) {
          args.where = { deletedAt: null, ...(args.where ?? {}) }
          return query(args)
        },
        async count({ args, query }) {
          args.where = { deletedAt: null, ...(args.where ?? {}) }
          return query(args)
        },
        async aggregate({ args, query }) {
          args.where = { deletedAt: null, ...(args.where ?? {}) }
          return query(args)
        },
        async groupBy({ args, query }) {
          args.where = { deletedAt: null, ...(args.where ?? {}) }
          return query(args)
        },
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Raw client without soft-delete filtering — use sparingly for restore /
 * audit / admin paths that genuinely need to see soft-deleted rows.
 */
export const prismaRaw =
  (globalForPrisma as unknown as { prismaRaw?: PrismaClient }).prismaRaw
  ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  ;(globalForPrisma as unknown as { prismaRaw?: PrismaClient }).prismaRaw = prismaRaw
}
