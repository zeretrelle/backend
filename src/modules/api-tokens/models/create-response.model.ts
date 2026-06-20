import { ApiTokenEntity } from '../entities/api-token.entity';

export class CreateApiTokenResponseModel {
    public readonly createdAt: Date;
    public readonly token: string;
    public readonly tokenName: string;
    public readonly scopes: string[];
    public readonly updatedAt: Date;
    public readonly uuid: string;

    constructor(data: ApiTokenEntity) {
        this.token = data.token;
        this.uuid = data.uuid;
        this.scopes = data.scopes;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
        this.tokenName = data.tokenName;
    }
}
