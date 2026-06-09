import { Module } from '@nestjs/common';
import { ColumnsService } from './columns.service';
import { ColumnsController } from './columns.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BoardsModule } from '../boards/boards.module';

@Module({
  imports: [
    PrismaModule,
    /**
     * 匯入 BoardsModule 才能注入 BoardsService，
     * 讓 ColumnsService 可呼叫 assertMember() / assertAdmin()。
     */
    BoardsModule,
  ],
  controllers: [ColumnsController],
  providers: [ColumnsService],
  exports: [ColumnsService],
})
export class ColumnsModule {}
