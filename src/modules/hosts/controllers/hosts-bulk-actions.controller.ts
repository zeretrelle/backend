import { Body, Controller, HttpStatus, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { JwtDefaultGuard } from '@common/guards/jwt-guards/def-jwt-guard';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { RolesGuard } from '@common/guards/roles/roles.guard';
import { Endpoint } from '@common/decorators/base-endpoint';
import { Roles } from '@common/decorators/roles/roles';
import {
    BulkDisableHostsCommand,
    BulkEnableHostsCommand,
    BulkDeleteHostsCommand,
    UpdateManyHostsCommand,
} from '@libs/contracts/commands';
import { CONTROLLERS_INFO, HOSTS_CONTROLLER } from '@libs/contracts/api';
import { ROLE } from '@libs/contracts/constants';

import {
    BulkDeleteHostsRequestDto,
    BulkDeleteHostsResponseDto,
    BulkDisableHostsRequestDto,
    BulkDisableHostsResponseDto,
    BulkEnableHostsRequestDto,
    BulkEnableHostsResponseDto,
    UpdateManyHostsRequestDto,
    UpdateManyHostsResponseDto,
} from '../dtos/bulk-operations.dto';
import { HostsService } from '../hosts.service';
import { HostResponseModel } from '../models';

@ApiBearerAuth('Authorization')
@ApiTags(CONTROLLERS_INFO.HOSTS_BULK_ACTIONS.tag)
@Roles(ROLE.ADMIN, ROLE.API)
@UseGuards(JwtDefaultGuard, RolesGuard)
@UseFilters(HttpExceptionFilter)
@Controller(HOSTS_CONTROLLER)
export class HostsBulkActionsController {
    constructor(private readonly hostsService: HostsService) {}

    @ApiOkResponse({
        type: BulkDeleteHostsResponseDto,
        description: 'Hosts deleted successfully',
    })
    @Endpoint({
        command: BulkDeleteHostsCommand,
        httpCode: HttpStatus.OK,
    })
    async deleteHosts(
        @Body() body: BulkDeleteHostsRequestDto,
    ): Promise<BulkDeleteHostsResponseDto> {
        const result = await this.hostsService.deleteHosts(body.uuids);

        const data = errorHandler(result);
        return {
            response: data.map((host) => new HostResponseModel(host)),
        };
    }

    @ApiOkResponse({
        type: BulkDisableHostsResponseDto,
        description: 'Hosts disabled successfully',
    })
    @Endpoint({
        command: BulkDisableHostsCommand,
        httpCode: HttpStatus.OK,
    })
    async disableHosts(
        @Body() body: BulkDisableHostsRequestDto,
    ): Promise<BulkDisableHostsResponseDto> {
        const result = await this.hostsService.bulkDisableHosts(body.uuids);

        const data = errorHandler(result);
        return {
            response: data.map((host) => new HostResponseModel(host)),
        };
    }

    @ApiOkResponse({
        type: BulkEnableHostsResponseDto,
        description: 'Hosts enabled successfully',
    })
    @Endpoint({
        command: BulkEnableHostsCommand,
        httpCode: HttpStatus.OK,
    })
    async enableHosts(
        @Body() body: BulkEnableHostsRequestDto,
    ): Promise<BulkEnableHostsResponseDto> {
        const result = await this.hostsService.bulkEnableHosts(body.uuids);

        const data = errorHandler(result);
        return {
            response: data.map((host) => new HostResponseModel(host)),
        };
    }

    @ApiOkResponse({
        type: UpdateManyHostsResponseDto,
        description: 'Hosts updated successfully',
    })
    @Endpoint({
        command: UpdateManyHostsCommand,
        httpCode: HttpStatus.OK,
    })
    async setPortToHosts(
        @Body() body: UpdateManyHostsRequestDto,
    ): Promise<UpdateManyHostsResponseDto> {
        const result = await this.hostsService.updateManyHosts(body);

        const data = errorHandler(result);
        return {
            response: data.map((host) => new HostResponseModel(host)),
        };
    }
}
