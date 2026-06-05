import { z } from 'zod';

import { getEndpointDetails } from '../../../constants';
import { HOSTS_ROUTES, REST_API } from '../../../api';
import { UpdateHostCommand } from '../update.command';
import { HostsSchema } from '../../../models';

export namespace UpdateManyHostsCommand {
    export const url = REST_API.HOSTS.BULK.UPDATE;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        HOSTS_ROUTES.BULK.UPDATE,
        'patch',
        'Update many hosts',
    );

    export const RequestSchema = UpdateHostCommand.RequestSchema.omit({ uuid: true })
        .partial()
        .extend({
            uuids: z.array(z.string().uuid()).min(1, 'Must be at least 1 host UUID'),
        });
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.array(HostsSchema),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
