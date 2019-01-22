import * as Koa from 'koa';
import * as KoaRouter from 'koa-router';
import * as joi from 'joi';
import * as koaBody from 'koa-bodyparser';
import { Description, Schema, SchemaMap, ValidationError } from 'joi';

export const enum Method {
	All = 'ALL',
	Delete = 'DELETE',
	Get = 'GET',
	Head = 'HEAD',
	Options = 'OPTIONS',
	Patch = 'PATCH',
	Post = 'POST',
	Put = 'PUT',
}
type MethodName = 'ALL' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';

export interface Context extends Koa.Context {
	input?: any;
	responseValidation?: any;
	validation?: any;
}

export type Handler = (ctx: Context, next?: () => any) => any;
export type Registrar<T> = (registrar: T) => any;

export interface YawkConfig {
	port?: number;
	prefix?: string;
	init?: boolean;
	metaRoute?: boolean;
}

export interface Route {
	path: string;
	method?: MethodName;
	private?: boolean;
	description?: string;
	handler: Handler;
	inputSchema?: Schema | SchemaMap;
	inputSchemaInfo?: Description;
	outputSchema?: Schema | SchemaMap;
	outputSchemaInfo?: Description;
}

export default class Yawk {
	private static defaultConfig: Partial<YawkConfig> = {
		port: 3000,
		init: true,
		metaRoute: true,
	};

	private static defaultRouteOptions: Partial<Route> = {
		method: Method.Get,
		private: false,
	};

	public app: Koa;

	private config: YawkConfig;
	private router: KoaRouter;
	private routes: Array<Route>;
	private routesInfo: Array<Route>;

	constructor(config: YawkConfig = {}, ...registrars: Array<Registrar<Yawk>>) {
		this.app = new Koa();
		this.config = { ...Yawk.defaultConfig, ...config };
		this.router = new KoaRouter({ prefix: this.config.prefix });
		this.routes = [];

		if (this.config.init) this.init(registrars);
	}

	public init(registrars: Array<Registrar<Yawk>> = []) {
		console.log('Initializing Yawk...');
		this.app.use(koaBody());

		console.log('Initializing registrars...');
		for (const registrar of registrars) registrar(this);

		console.log('Initializing routes...');
		if (this.config.metaRoute) {
			this.register({
				path: '/routes',
				method: Method.Options,
				description: 'Route info.',
				inputSchema: {},
				handler: () => {
					if (!this.routesInfo) {
						this.routesInfo = this.routes
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
					return this.routesInfo;
				},
			});
		}
		this.app.use(this.router.routes());
		this.app.use(this.router.allowedMethods());
	}

	public register(params: Route) {
		const route: Route = { ...Yawk.defaultRouteOptions, ...params };
		this.routes.push(route);
		this.router[route.method.toLowerCase()](route.path, async (ctx: Context, next) => {
			// Combine query and body in one place
			ctx.input = Object.assign({}, ctx.request.body, ctx.query);

			// Validate against input schema if present
			if ('inputSchema' in route) {
				try {
					ctx.validation = await joi.validate(ctx.input, route.inputSchema, { abortEarly: false });
				} catch (ex) {
					return error(ctx, 422, ex);
				}
			}

			try {
				const result = await route.handler(ctx, next);
				if (typeof result !== 'undefined') ctx.body = result;
			} catch (ex) {
				return error(ctx, 500, ex);
			}

			// Validate response against output schema if present
			if ('outputSchema' in route) {
				try {
					ctx.responseValidation = await joi.validate(ctx.body, route.outputSchema, { abortEarly: false });
				} catch (ex) {
					return error(ctx, 500, ex);
				}
			}
		});
	}

	public start() {
		console.log('Listening on port:', this.config.port);
		this.app.listen(this.config.port);
	}
}

function error(ctx: Context, status: number, err: Error | ValidationError) {
	ctx.status = status;
	ctx.body = {
		name: err.name,
		status,
		message: err.message,
		error: err.toString(),
		// TODO: show only if flag passed, defaulted to false
		stack: err.stack,
	};

	if ('details' in err) {
		ctx.body.error = err;
		ctx.body.message = err.details.map(({ message }) => message).join('; ');
		ctx.body.count = err.details.length;
		ctx.body.data = err.details;
	}
}
