import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardMembersService } from './board-members.service';
import { BoardsController } from './boards.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthorizationModule } from '../common/authz/authorization.module';

@Module({
  imports: [PrismaModule, AuthorizationModule],
  controllers: [BoardsController],
  providers: [BoardsService, BoardMembersService],
  /**
   * 匯出 BoardsService，讓 ColumnsModule / TasksModule 可以注入
   * 並呼叫 assertNotArchived() / assertColumnBelongsToBoard() 等看板輔助方法。
   */
  exports: [BoardsService],
})
export class BoardsModule {}
