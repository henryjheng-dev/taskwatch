import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BoardsController],
  providers: [BoardsService],
  /**
   * 匯出 BoardsService，讓 ColumnsModule / TasksModule 可以注入
   * 並呼叫 assertMember() 來驗證使用者是否為看板成員。
   */
  exports: [BoardsService],
})
export class BoardsModule {}
