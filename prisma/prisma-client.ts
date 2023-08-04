import { PrismaClient } from "@prisma/client";

const prisma = process.env.NODE_ENV == 'PRODUCTION' ? (new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        }
    }
})) : (new PrismaClient({
    datasources: {
        db: {
            url: process.env.DEV_DATABASE_URL
        }
    }
}))

export default prisma;