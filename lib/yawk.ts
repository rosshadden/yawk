import * as Koa from 'koa';
import * as KoaRouter from 'koa-router';
import * as joi from 'joi';
import * as koaBody from 'koa-bodyparser';

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

export interface Route {
	path: string;
	method?: Method;
	private?: boolean;
	description?: string;
	handler: Handler;
	schema?: any;
}

export interface YawkConfig {
	port: number;
	prefix?: string;
}

export default class Yawk {
	private static defaultRouteOptions: Partial<Route> = {
		method: Method.Get,
		private: false,
	};

	public app: Koa;
	public routes: Array<Route>;

	private router: KoaRouter;

	constructor(private config: YawkConfig, ...registrars: Array<Registrar<Yawk>>) {
		this.app = new Koa();
		this.router = new KoaRouter({ prefix: config.prefix });
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
					await joi.validate(ctx.query, route.schema, { abortEarly: false });
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
			ctx.server = this;
			return next();
		});

		console.log('Initializing registrars...');
		for (const registrar of registrars) registrar(this);

		console.log('Initializing API...');
		this.app.use(this.router.routes());
		this.app.use(this.router.allowedMethods());
	}
}
