import { Prisma, PrismaClient } from "@prisma/client";

/**
 * A PrismaClient OR a transaction client. Every repo function takes one of
 * these as its first arg so it can be composed inside `db.$transaction` calls.
 *
 * Default to passing the global `db` from `lib/db`; pass a `tx` when the call
 * needs to share a transaction with other writes.
 */
export type DBClient =
  | PrismaClient
  | Prisma.TransactionClient
  | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
