import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(private configService: ConfigService) {
    const nestLogger = new Logger('PrismaService');
    const adapter = new PrismaMariaDb({
      host: configService.get<string>('DB_HOST'),
      user: configService.get<string>('DB_USER'),
      password: configService.get<string>('DB_PASSWORD'),
      database: configService.get<string>('DB_NAME'),
      port: configService.get<number>('DB_PORT'),

      // 在這裡加入允許公鑰檢索的參數，解決連線無聲卡死的問題
      allowPublicKeyRetrieval: true,
      logger: {
        error: (error) => {
          nestLogger.error(
            'PrismaAdapterError: ' +
              (error instanceof Error ? error.message : error),
          );
        },
        warning: (info) => {
          nestLogger.warn('PrismaAdapterWarning: ' + info);
        },
      },
    });
    super({ adapter });
  }
}
