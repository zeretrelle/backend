import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { TypedConfigService } from '@common/config/app-config/typed-config.service';
import { RawCacheService } from '@common/raw-cache';
import { fail, ok, TResult } from '@common/types';
import { ERRORS } from '@libs/contracts/constants';

import {
    IApiTokenDeleteResponse,
    ICreateApiTokenRequest,
    IGroupedScopeCatalog,
} from './interfaces';
import { SignApiTokenCommand } from '../auth/commands/sign-api-token/sign-api-token.command';
import { ApiTokensRepository } from './repositories/api-tokens.repository';
import { FindAllApiTokensResponseModel } from './models/find.model';
import { ScopeCatalogService } from './scope-catalog.service';
import { ApiTokenEntity } from './entities/api-token.entity';

@Injectable()
export class ApiTokensService {
    private readonly logger = new Logger(ApiTokensService.name);
    constructor(
        private readonly rawCacheService: RawCacheService,
        private readonly apiTokensRepository: ApiTokensRepository,
        private readonly commandBus: CommandBus,
        private readonly configService: TypedConfigService,
        private readonly scopeCatalogService: ScopeCatalogService,
    ) {}

    public async create(body: ICreateApiTokenRequest): Promise<TResult<ApiTokenEntity>> {
        const { tokenName, scopes } = body;

        try {
            const invalidScopes = this.scopeCatalogService.findInvalidScopes(scopes);
            if (invalidScopes.length > 0) {
                this.logger.warn(
                    `Rejected API token with invalid scopes: ${invalidScopes.join(', ')}`,
                );
                return fail(ERRORS.INVALID_API_TOKEN_SCOPE);
            }

            const uuid = randomUUID();

            const token = await this.signApiToken({
                uuid,
            });

            if (!token.isOk) {
                return fail(ERRORS.CREATE_API_TOKEN_ERROR);
            }

            const apiTokenEntity = new ApiTokenEntity({
                uuid,
                tokenName,
                token: token.response,
                scopes,
            });

            const newApiTokenEntity = await this.apiTokensRepository.create(apiTokenEntity);

            return ok(newApiTokenEntity);
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.CREATE_API_TOKEN_ERROR);
        }
    }

    public async delete(uuid: string): Promise<TResult<IApiTokenDeleteResponse>> {
        try {
            const result = await this.apiTokensRepository.deleteByUUID(uuid);

            await this.rawCacheService.del(`api:${uuid}`);

            return ok({ result });
        } catch (error) {
            this.logger.error(JSON.stringify(error));

            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    return fail(ERRORS.REQUESTED_TOKEN_NOT_FOUND);
                }
            }
            return fail(ERRORS.DELETE_API_TOKEN_ERROR);
        }
    }

    public async findAll(): Promise<TResult<FindAllApiTokensResponseModel>> {
        try {
            const result = await this.apiTokensRepository.findByCriteria({});

            return ok({
                apiKeys: result.map((item) => item),
                docs: {
                    isDocsEnabled: this.configService.getOrThrow('IS_DOCS_ENABLED'),
                    scalarPath: this.configService.get('SCALAR_PATH'),
                    swaggerPath: this.configService.get('SWAGGER_PATH'),
                },
            });
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.FIND_ALL_API_TOKENS_ERROR);
        }
    }

    public getAvailableScopes(): TResult<IGroupedScopeCatalog> {
        return ok(this.scopeCatalogService.getGroupedCatalog());
    }

    private async signApiToken(dto: SignApiTokenCommand): Promise<TResult<string>> {
        return this.commandBus.execute<SignApiTokenCommand, TResult<string>>(
            new SignApiTokenCommand(dto.uuid),
        );
    }
}
