import * as joi from 'joi';
import Yawk, { Method, Route } from '..';

export default function(yawk: Yawk, routes: Array<Route>) {
	let routesInfo: Array<object>;

	yawk.register({
		path: '/.well-known/routes',
		method: Method.Get,
		description: 'Route info.',
		handler: () => {
			if (!routesInfo) {
				routesInfo = routes
					.filter((route) => !route.private)
					.map((route) => {
						route = { ...route };
						delete route.private;
						if (route.inputSchema) {
							route.inputSchema = joi.describe(joi.compile(route.inputSchema));
						}
						if (route.outputSchema) {
							route.outputSchema = joi.describe(joi.compile(route.outputSchema));
						}
						return route;
					});
			}
			return routesInfo;
		},
	});
}
