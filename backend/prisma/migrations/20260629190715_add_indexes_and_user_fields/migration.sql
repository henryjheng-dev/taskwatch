/*
  Warnings:

  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `users` ADD COLUMN `avatar_url` VARCHAR(500) NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- CreateIndex
CREATE INDEX `tasks_column_id_position_idx` ON `tasks`(`column_id`, `position`);

-- CreateIndex
CREATE INDEX `tasks_due_date_idx` ON `tasks`(`due_date`);

-- RenameIndex
ALTER TABLE `boards` RENAME INDEX `boards_owner_id_fkey` TO `boards_owner_id_idx`;

-- RenameIndex
ALTER TABLE `columns` RENAME INDEX `columns_board_id_fkey` TO `columns_board_id_idx`;

-- RenameIndex
ALTER TABLE `tasks` RENAME INDEX `tasks_created_by_fkey` TO `tasks_created_by_idx`;
