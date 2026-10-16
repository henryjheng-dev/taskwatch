import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get(AppController);
  });

  describe('GET /health', () => {
    it('應回傳 status ok 與 ISO 時間戳', () => {
      const result = appController.getHealth();

      expect(result.status).toBe('ok');
      expect(typeof result.timestamp).toBe('string');
    });
  });
});
