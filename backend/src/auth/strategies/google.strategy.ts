import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      /**
       * scope 只要求最基本的 email + profile。
       * 不索取不必要的 scope 是 OAuth 最小權限原則（Principle of Least Privilege）。
       */
      scope: ['email', 'profile'],
    });
  }

  /**
   * Google 授權成功後，Passport 自動呼叫此方法。
   * 回傳值會掛在 req.user，供 Controller 直接使用。
   *
   * @param _accessToken  Google 的 Access Token（此專案不需要呼叫 Google API，故忽略）
   * @param _refreshToken Google 的 Refresh Token（同上，忽略）
   * @param profile       Google 回傳的使用者資料
   */
  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<{ id: number; email: string }> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      // Google 帳號沒有 Email 的極少數情況（例如：未驗證的帳號）
      throw new UnauthorizedException('Google 帳號未提供有效的 Email');
    }

    const fullName =
      `${profile.name?.givenName ?? ''} ${profile.name?.familyName ?? ''}`.trim();
    const name = profile.displayName ?? (fullName || email);

    return this.authService.validateGoogleUser(profile.id, email, name);
  }
}
