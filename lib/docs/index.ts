import * as joi from 'joi';
import Yawk, { Method, Route } from '..';

export default function(yawk: Yawk, routes: Array<Route>) {
	let routesInfo: Array<object>;

	yawk.register({
		path: '/docs',
		method: Method.Get,
		description: 'Route info.',
		inputSchema: {},
		handler: () => {
			if (!routesInfo) {
				routesInfo = routes
					.filter((route) => !route.private)
					.map((route) => {
						route = { ...route };
						if (route.inputSchema) {
							route.inputSchemaInfo = joi.describe(joi.compile(route.inputSchema));
							delete route.inputSchema;
						}
						if (route.outputSchema) {
							route.outputSchemaInfo = joi.describe(joi.compile(route.outputSchema));
							delete route.outputSchema;
						}
						return route;
					});
			}
			return routesInfo;
		},
	});
}
