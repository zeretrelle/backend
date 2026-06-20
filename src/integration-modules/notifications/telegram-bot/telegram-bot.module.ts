import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';

import { TelegramApiService } from './telegram-api.service';
import { TELEGRAM_BOT_EVENTS } from './events';

@Module({
    imports: [ConfigModule],
    controllers: [],
    providers: [TelegramApiService, ...TELEGRAM_BOT_EVENTS],
    exports: [TelegramApiService],
})
export class TelegramBotModule {}
