import { Module } from '@nestjs/common';
import { LabelsService } from './labels.service';
import { LabelsController } from './labels.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BoardsModule } from '../boards/boards.module';

@Module({
  imports: [PrismaModule, BoardsModule],
  controllers: [LabelsController],
  providers: [LabelsService],
  exports: [LabelsService],
})
export class LabelsModule {}
