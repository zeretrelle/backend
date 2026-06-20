export interface ICreateApiTokenRequest {
    tokenName: string;
    scopes: string[];
}

export interface ICreateApiTokenResponse {
    token: string;
    uuid: string;
    scopes: string[];
}
