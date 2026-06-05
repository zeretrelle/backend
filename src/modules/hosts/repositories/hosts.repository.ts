import { Prisma } from '@prisma/client';
import { sql } from 'kysely';

import { IReorderHost } from 'src/modules/hosts/interfaces/reorder-host.interface';

import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { values } from '@common/helpers/kysely/values';
import { TxKyselyService } from '@common/database';
import { ICrud } from '@common/types/crud-port';
import { TSecurityLayers } from '@libs/contracts/constants';

import { HostWithRawInbound } from '../entities/host-with-inbound-tag.entity';
import { HostsEntity } from '../entities/hosts.entity';
import { HostsConverter } from '../hosts.converter';

const INCLUDE_RELATED = {
    nodes: {
        select: {
            nodeUuid: true,
        },
    },
    excludedInternalSquads: {
        select: {
            squadUuid: true,
        },
    },
} as const;

@Injectable()
export class HostsRepository implements ICrud<HostsEntity> {
    constructor(
        private readonly prisma: TransactionHost<TransactionalAdapterPrisma>,
        private readonly qb: TxKyselyService,
        private readonly hostsConverter: HostsConverter,
    ) {}

    public async create(entity: HostsEntity): Promise<HostsEntity> {
        const model = this.hostsConverter.fromEntityToPrismaModel(entity);
        const result = await this.prisma.tx.hosts.create({
            data: {
                ...model,
                xHttpExtraParams: model.xHttpExtraParams as Prisma.InputJsonValue,
                muxParams: model.muxParams as Prisma.InputJsonValue,
                sockoptParams: model.sockoptParams as Prisma.InputJsonValue,
                finalMask: model.finalMask as Prisma.InputJsonValue,
            },
            include: INCLUDE_RELATED,
        });

        return this.hostsConverter.fromPrismaModelToEntity(result);
    }

    public async findByUUID(uuid: string): Promise<HostsEntity | null> {
        const result = await this.prisma.tx.hosts.findUnique({
            where: { uuid },
            include: INCLUDE_RELATED,
        });
        if (!result) {
            return null;
        }
        return this.hostsConverter.fromPrismaModelToEntity(result);
    }

    public async update({
        uuid,
        ...data
    }: Partial<Omit<HostsEntity, 'nodes' | 'excludedInternalSquads'>>): Promise<HostsEntity> {
        const result = await this.prisma.tx.hosts.update({
            where: {
                uuid,
            },
            data: {
                ...data,
                xHttpExtraParams: data.xHttpExtraParams as Prisma.InputJsonValue,
                muxParams: data.muxParams as Prisma.InputJsonValue,
                sockoptParams: data.sockoptParams as Prisma.InputJsonValue,
                finalMask: data.finalMask as Prisma.InputJsonValue,
            },
            include: INCLUDE_RELATED,
        });

        return this.hostsConverter.fromPrismaModelToEntity(result);
    }

    public async updateMany({
        uuids,
        data,
    }: {
        uuids: string[];
        data: Partial<Omit<HostsEntity, 'nodes' | 'excludedInternalSquads'>>;
    }): Promise<number> {
        const result = await this.prisma.tx.hosts.updateMany({
            where: {
                uuid: {
                    in: uuids,
                },
            },
            data: {
                ...data,
                xHttpExtraParams: data.xHttpExtraParams as Prisma.InputJsonValue,
                muxParams: data.muxParams as Prisma.InputJsonValue,
                sockoptParams: data.sockoptParams as Prisma.InputJsonValue,
                finalMask: data.finalMask as Prisma.InputJsonValue,
            },
        });

        return result.count;
    }

    public async findByCriteria(
        dto: Omit<
            Partial<HostsEntity>,
            | 'xHttpExtraParams'
            | 'muxParams'
            | 'sockoptParams'
            | 'nodes'
            | 'excludedInternalSquads'
            | 'excludeFromSubscriptionTypes'
            | 'finalMask'
            | 'tags'
        >,
    ): Promise<HostsEntity[]> {
        const list = await this.prisma.tx.hosts.findMany({
            where: dto,
            include: INCLUDE_RELATED,
        });
        return this.hostsConverter.fromPrismaModelsToEntities(list);
    }

    public async findAll(): Promise<HostsEntity[]> {
        const list = await this.prisma.tx.hosts.findMany({
            orderBy: {
                viewPosition: 'asc',
            },
            include: INCLUDE_RELATED,
        });
        return this.hostsConverter.fromPrismaModelsToEntities(list);
    }

    public async deleteByUUID(uuid: string): Promise<boolean> {
        const result = await this.prisma.tx.hosts.delete({ where: { uuid } });
        return !!result;
    }

    public async deleteMany(uuids: string[]): Promise<boolean> {
        const result = await this.prisma.tx.hosts.deleteMany({ where: { uuid: { in: uuids } } });
        return !!result;
    }

    public async enableMany(uuids: string[]): Promise<boolean> {
        const result = await this.prisma.tx.hosts.updateMany({
            where: { uuid: { in: uuids } },
            data: { isDisabled: false },
        });
        return !!result;
    }

    public async disableMany(uuids: string[]): Promise<boolean> {
        const result = await this.prisma.tx.hosts.updateMany({
            where: { uuid: { in: uuids } },
            data: { isDisabled: true },
        });
        return !!result;
    }

    public async findActiveHostsByUserId(
        userId: bigint,
        returnDisabledHosts: boolean = false,
        returnHiddenHosts: boolean = false,
    ): Promise<HostWithRawInbound[]> {
        const hosts = await this.qb.kysely
            .selectFrom('hosts')
            .distinct()
            .innerJoin(
                'internalSquadInbounds',
                'internalSquadInbounds.inboundUuid',
                'hosts.configProfileInboundUuid',
            )
            .innerJoin(
                'internalSquadMembers',
                'internalSquadMembers.internalSquadUuid',
                'internalSquadInbounds.internalSquadUuid',
            )
            .innerJoin(
                'configProfileInbounds',
                'configProfileInbounds.uuid',
                'hosts.configProfileInboundUuid',
            )
            .leftJoin(
                'subscriptionTemplates',
                'subscriptionTemplates.uuid',
                'hosts.xrayJsonTemplateUuid',
            )

            .where((eb) =>
                eb.not(
                    eb.exists(
                        eb
                            .selectFrom('internalSquadHostExclusions')
                            .whereRef('internalSquadHostExclusions.hostUuid', '=', 'hosts.uuid')
                            .whereRef(
                                'internalSquadHostExclusions.squadUuid',
                                '=',
                                'internalSquadInbounds.internalSquadUuid',
                            )
                            .select(eb.val(1).as('one')),
                    ),
                ),
            )
            .$if(!returnDisabledHosts, (eb) => eb.where('hosts.isDisabled', '=', false))
            .$if(!returnHiddenHosts, (eb) => eb.where('hosts.isHidden', '=', false))
            .where('internalSquadMembers.userId', '=', userId)
            .selectAll('hosts')

            .select([
                'configProfileInbounds.rawInbound',
                'configProfileInbounds.tag as inboundTag',
                'subscriptionTemplates.templateJson as xrayJsonTemplate',
            ])
            .orderBy('hosts.viewPosition', 'asc')
            .execute();

        return hosts.map(
            (h) =>
                new HostWithRawInbound({
                    ...h,
                    securityLayer: h.securityLayer as TSecurityLayers,
                    xHttpExtraParams: h.xhttpExtraParams,
                }),
        );
    }

    public async reorderMany(dto: IReorderHost[]): Promise<boolean> {
        if (dto.length === 0) return true;

        const v = values(
            dto.map(({ uuid, viewPosition }) => ({
                uuid: sql<string>`${uuid}::uuid`,
                viewPosition: sql<number>`${viewPosition}::int`,
            })),
            'v',
        );

        await this.qb.kysely
            .updateTable('hosts as h')
            .from(v)
            .set((eb) => ({ viewPosition: eb.ref('v.viewPosition') }))
            .whereRef('h.uuid', '=', 'v.uuid')
            .execute();

        await this.prisma.tx
            .$executeRaw`SELECT setval('hosts_view_position_seq', (SELECT MAX(view_position) FROM hosts) + 1)`;

        return true;
    }

    public async findAllTags(): Promise<string[]> {
        const result = await this.qb.kysely
            .selectFrom('hosts')
            .select(sql<string>`unnest(tags)`.as('tag'))
            .distinct()
            .where('tags', 'is not', null)
            .orderBy('tag')
            .execute();

        return result.map((value) => value.tag);
    }

    public async addNodesToHost(hostUuid: string, nodes: string[]): Promise<boolean> {
        if (nodes.length === 0) {
            return true;
        }

        const result = await this.prisma.tx.hostsToNodes.createMany({
            data: nodes.map((node) => ({ hostUuid, nodeUuid: node })),
            skipDuplicates: true,
        });
        return !!result;
    }

    public async addNodesToHosts(hostUuids: string[], nodes: string[]): Promise<boolean> {
        if (hostUuids.length === 0 || nodes.length === 0) {
            return true;
        }
        const result = await this.prisma.tx.hostsToNodes.createMany({
            data: hostUuids.flatMap((hostUuid) =>
                nodes.map((node) => ({ hostUuid, nodeUuid: node })),
            ),
            skipDuplicates: true,
        });
        return !!result.count;
    }

    public async clearNodesFromHost(hostUuid: string): Promise<boolean> {
        const result = await this.prisma.tx.hostsToNodes.deleteMany({
            where: { hostUuid },
        });
        return !!result;
    }

    public async clearNodesFromHosts(hostUuids: string[]): Promise<boolean> {
        const result = await this.prisma.tx.hostsToNodes.deleteMany({
            where: { hostUuid: { in: hostUuids } },
        });
        return !!result;
    }

    public async addExcludedInternalSquadsToHost(
        hostUuid: string,
        squadUuids: string[],
    ): Promise<boolean> {
        if (squadUuids.length === 0) {
            return true;
        }

        const result = await this.prisma.tx.internalSquadHostExclusions.createMany({
            data: squadUuids.map((squad) => ({ hostUuid, squadUuid: squad })),
            skipDuplicates: true,
        });
        return !!result;
    }

    public async addExcludedInternalSquadsToHosts(
        hostUuids: string[],
        squadUuids: string[],
    ): Promise<boolean> {
        if (hostUuids.length === 0 || squadUuids.length === 0) {
            return true;
        }

        const result = await this.prisma.tx.internalSquadHostExclusions.createMany({
            data: hostUuids.flatMap((hostUuid) =>
                squadUuids.map((squad) => ({ hostUuid, squadUuid: squad })),
            ),
            skipDuplicates: true,
        });
        return !!result;
    }

    public async clearExcludedInternalSquadsFromHost(hostUuid: string): Promise<boolean> {
        const result = await this.prisma.tx.internalSquadHostExclusions.deleteMany({
            where: { hostUuid },
        });
        return !!result;
    }

    public async clearExcludedInternalSquadsFromHosts(hostUuids: string[]): Promise<boolean> {
        const result = await this.prisma.tx.internalSquadHostExclusions.deleteMany({
            where: { hostUuid: { in: hostUuids } },
        });
        return !!result;
    }
}
