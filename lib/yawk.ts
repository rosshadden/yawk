import * as Koa from 'koa';
import * as KoaRouter from 'koa-router';
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
	method: Method;
	handler: Handler;
	description?: string;
	private?: boolean;
}

export interface YawkConfig {
	port: number;
	prefix?: string;
}

export default class Yawk {
	public app: Koa;
	public routes: Array<Route>;

	private router: KoaRouter;

	constructor(private config: YawkConfig, ...registrars: Array<Registrar<Yawk>>) {
		this.app = new Koa();
		this.router = new KoaRouter({ prefix: config.prefix });
		this.routes = [];

		this.init(registrars);
	}

	public register(route: Route) {
		this.routes.push(route);
		this.router[route.method.toLowerCase()](route.path, async (ctx, next) => {
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
