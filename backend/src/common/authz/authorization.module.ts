import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthorizationService } from './authorization.service';

/**
 * 授權模組：提供 AuthorizationService 給所有需要權限判斷的模組。
 */
@Module({
  imports: [PrismaModule],
  providers: [AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
