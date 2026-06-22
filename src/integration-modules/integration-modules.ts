import { ConditionalModule } from '@nestjs/config';
import { Module } from '@nestjs/common';

import { isProcessor } from '@common/utils/startup-app';

import { TelegramBotModule } from './notifications/telegram-bot/telegram-bot.module';
import { WebhookModule } from './notifications/webhook-module/webhook.module';

@Module({
    imports: [
        ConditionalModule.registerWhen(
            TelegramBotModule,
            (env) =>
                env['IS_TELEGRAM_NOTIFICATIONS_ENABLED']?.toLowerCase() !== 'false' &&
                isProcessor(),
        ),
        ConditionalModule.registerWhen(WebhookModule, 'WEBHOOK_ENABLED'),
    ],
})
export class IntegrationModules {}
