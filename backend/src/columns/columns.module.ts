import { Module } from '@nestjs/common';
import { ColumnsService } from './columns.service';
import { ColumnsController } from './columns.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BoardsModule } from '../boards/boards.module';
import { AuthorizationModule } from '../common/authz/authorization.module';

@Module({
  imports: [
    PrismaModule,
    /**
     * 匯入 BoardsModule 才能注入 BoardsService（assertNotArchived 等輔助方法）。
     * 權限判斷改走 AuthorizationModule（Permission 矩陣）。
     */
    BoardsModule,
    AuthorizationModule,
  ],
  controllers: [ColumnsController],
  providers: [ColumnsService],
  exports: [ColumnsService],
})
export class ColumnsModule {}
