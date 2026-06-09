import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 保護需要登入才能存取的路由。
 * 只需在 Controller 方法上加 @UseGuards(JwtAuthGuard)，
 * Passport 會自動呼叫 JwtStrategy.validate() 並把結果掛在 req.user。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
