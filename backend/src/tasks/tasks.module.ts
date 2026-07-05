import { Module } from '@nestjs/common';
import { LabelsModule } from '../labels/labels.module';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BoardsModule } from '../boards/boards.module';
import { ColumnsModule } from '../columns/columns.module';

@Module({
  imports: [
    PrismaModule,
    BoardsModule, // 注入 BoardsService（assertMember / assertAdmin）
    ColumnsModule, // 注入 ColumnsService（assertColumnBelongsToBoard）
    LabelsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
