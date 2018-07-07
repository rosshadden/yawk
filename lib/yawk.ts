import * as Koa from 'koa';
import * as KoaRouter from 'koa-router';
import * as joi from 'joi';
import * as koaBody from 'koa-bodyparser';
import { Description, Schema } from 'joi';

export enum Method {
	All = 'ALL',
	Delete = 'DELETE',
	Get = 'GET',
	Head = 'HEAD',
	Options = 'OPTIONS',
	Patch = 'PATCH',
	Post = 'POST',
	Put = 'PUT',
}

export type Handler = (ctx: Koa.Context, next?: () => any) => any;
export type Registrar<T> = (registrar: T) => any;

export interface YawkConfig {
	port?: number;
	prefix?: string;
	metaRoute?: boolean;
}

export interface Route {
	path: string;
	method?: Method;
	private?: boolean;
	description?: string;
	handler: Handler;
	schema?: Schema | Description;
}

export default class Yawk {
	private static defaultConfig: Partial<YawkConfig> = {
		port: 3000,
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

		this.init(registrars);
	}

	public register(params: Route) {
		const route: Route = { ...Yawk.defaultRouteOptions, ...params };
		this.routes.push(route);
		this.router[route.method.toLowerCase()](route.path, async (ctx, next) => {
			// Validate against schema if present
			if ('schema' in route) {
				try {
					ctx.validation = await joi.validate(ctx.query, route.schema, { abortEarly: false });
				} catch (ex) {
					ctx.status = 422;
					return ctx.body = {
						id: ex.name,
						status: ctx.status,
						message: ex.details.map(({ message }) => message).join('; '),
						count: ex.details.length,
						error: ex,
						data: ex.details,
					};
				}
			}

			const result = await route.handler(ctx, next);
			if (typeof result !== 'undefined') ctx.body = result;
		});
	}

	public start() {
		console.log('Listening on port:', this.config.port);
		this.app.listen(this.config.port);
	}

	private init(registrars: Array<Registrar<Yawk>>) {
		console.log('Initializing server...');
		this.app.use(koaBody());
		this.app.use((ctx, next) => {
			(ctx as any).server = this;
			return next();
		});

		console.log('Initializing registrars...');
		for (const registrar of registrars) registrar(this);

		console.log('Initializing routes...');
		if (this.config.metaRoute) {
			this.register({
				path: '/routes',
				description: 'Route info.',
				handler: () => {
					if (!this.routesInfo) {
						this.routesInfo = this.routes
							.filter((route) => !route.private)
							.map((route) => {
								route = { ...route };
								if (route.schema) route.schema = joi.describe(route.schema as Schema);
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
}
